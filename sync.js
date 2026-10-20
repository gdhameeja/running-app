// sync.js — Backups and updates: syncs runs and course progress to your own
// Supabase project, exports/imports everything as one JSON file, and checks
// GitHub Releases for a newer APK. Setup: docs/CLOUD_SYNC.md.
//
// Local-first: IndexedDB stays what the app reads from, and runs work offline
// as before. Every local write stamps `updatedAt` (script.js). A sync pushes
// finished runs and course progress changed since the last push, then lists
// what changed on the server since the last pull and downloads only rows
// newer than the copy on the phone, so a new phone gets everything back.
// Row-level security keeps each account's rows private, so the publishable
// key can live in the app.

const CloudSync = (() => {
    const STORE_KEY = "cloudSync";
    const REPO = "gdhameeja/running-app";
    const PUSH_CHUNK = 5;
    const FETCH_CHUNK = 10;
    const LIST_PAGE = 500;
    // Runs sync as soon as they're saved; otherwise (offline then, or changes
    // from another phone) a catch-up sync at most this often
    const CATCH_UP_MS = 12 * 3600000;
    const UPDATE_CHECK_MS = 6 * 3600000;

    let syncing = null;
    let soonTimer = null;
    let latestRelease = null;

    // { url, key, email, session: { access, refresh, expiresAt, userId }, lastPush, lastPull, lastCpPull, lastSyncAt, lastAttemptAt, lastError }
    function cfg() {
        try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { return {}; }
    }

    function save(patch) {
        const next = Object.assign(cfg(), patch);
        try { localStorage.setItem(STORE_KEY, JSON.stringify(next)); } catch (e) { /* storage unavailable */ }
        return next;
    }

    const configured = () => { const c = cfg(); return !!(c.url && c.key && c.session); };

    // ─── HTTP ────────────────────────────────────────────────────────────────

    function request(url, options = {}, timeoutMs = 30000) {
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), timeoutMs);
        return fetch(url, Object.assign({ signal: ctl.signal }, options)).then(res => {
            clearTimeout(timer);
            return res.text().then(text => {
                let body = null;
                try { body = text ? JSON.parse(text) : null; } catch (e) { body = text; }
                if (!res.ok) {
                    const msg = body && (body.msg || body.message || body.error_description || body.error) || `HTTP ${res.status}`;
                    throw Object.assign(new Error(msg), { status: res.status });
                }
                return body;
            });
        }, err => {
            clearTimeout(timer);
            throw new Error(err.name === "AbortError" ? "Timed out" : "No connection");
        });
    }

    function authCall(path, body) {
        const c = cfg();
        return request(`${c.url}/auth/v1/${path}`, {
            method: "POST",
            headers: { apikey: c.key, "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
    }

    function keepSession(res) {
        const session = {
            access: res.access_token, refresh: res.refresh_token,
            expiresAt: res.expires_at || Math.floor(Date.now() / 1000) + (res.expires_in || 3600),
            userId: res.user && res.user.id,
        };
        save({ session, lastError: null });
        return session;
    }

    // A valid access token, refreshed when it's about to expire
    function session() {
        const c = cfg();
        if (!c.session) return Promise.reject(new Error("Not signed in"));
        if (c.session.expiresAt - 60 > Date.now() / 1000) return Promise.resolve(c.session);
        return authCall("token?grant_type=refresh_token", { refresh_token: c.session.refresh })
            .then(keepSession)
            .catch(err => {
                if (err.status === 400 || err.status === 401) {
                    save({ session: null });
                    throw new Error("Signed out. Sign in again to keep syncing.");
                }
                throw err;
            });
    }

    function rest(path, options = {}) {
        return session().then(s => {
            const c = cfg();
            return request(`${c.url}/rest/v1/${path}`, Object.assign({}, options, {
                headers: Object.assign({ apikey: c.key, Authorization: `Bearer ${s.access}`, "Content-Type": "application/json" }, options.headers),
            }));
        });
    }

    // ─── Account ─────────────────────────────────────────────────────────────

    function connect(url, key, email) {
        save({ url: url.trim().replace(/\/+$/, ""), key: key.trim(), email: email.trim() });
    }

    function signIn(email, password) {
        return authCall("token?grant_type=password", { email, password }).then(res => {
            keepSession(res);
            // A different account has different rows: start the watermarks over
            save({ lastPush: 0, lastPull: null, lastCpPull: null });
            return sync();
        });
    }

    // Resolves true when signed in straight away, false when Supabase wants the email confirmed first
    function signUp(email, password) {
        return authCall("signup", { email, password }).then(res => {
            if (!res || !res.access_token) return false;
            keepSession(res);
            save({ lastPush: 0, lastPull: null, lastCpPull: null });
            return sync().then(() => true);
        });
    }

    function signOut() {
        save({ session: null, lastSyncAt: null, lastError: null });
    }

    // ─── Local store (writes here keep the server's `updatedAt`) ─────────────

    function putRaw(storeName, record) {
        return new Promise((resolve, reject) => {
            const req = db.transaction([storeName], "readwrite").objectStore(storeName).put(record);
            req.onsuccess = () => resolve();
            req.onerror = (e) => reject(e.target.error);
        });
    }

    function getAll(storeName) {
        return new Promise((resolve, reject) => {
            const req = db.transaction([storeName], "readonly").objectStore(storeName).getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    // Records from before sync existed have no `updatedAt`; fall back to when they happened
    const stamp = (r) => r.updatedAt || r.endTime || r.startTime || r.startDate || 1;

    // ─── Sync ────────────────────────────────────────────────────────────────

    const TABLES = {
        runs: { store: "runs", key: "runId", column: "run_id", ready: r => !!r.endTime },
        course_progress: { store: "courseProgress", key: "progressId", column: "progress_id", ready: () => true },
    };

    function push(table) {
        const t = TABLES[table];
        const since = cfg().lastPush || 0;
        return getAll(t.store).then(all => {
            const changed = all.filter(r => t.ready(r) && stamp(r) > since && !(isRunLive() && r.runId === currentRunId))
                .sort((a, b) => stamp(a) - stamp(b));
            let chain = Promise.resolve(0);
            for (let i = 0; i < changed.length; i += PUSH_CHUNK) {
                const chunk = changed.slice(i, i + PUSH_CHUNK);
                chain = chain.then(n => rest(`${table}?on_conflict=user_id,${t.column}`, {
                    method: "POST",
                    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
                    body: JSON.stringify(chunk.map(r => ({
                        user_id: cfg().session.userId, [t.column]: r[t.key], data: r, client_updated_at: stamp(r),
                    }))),
                }).then(() => n + chunk.length));
            }
            return chain.then(n => ({ n, newest: changed.length ? stamp(changed[changed.length - 1]) : since }));
        });
    }

    // Lists rows changed on the server since the last pull, then downloads the ones newer than ours
    function pull(table, watermarkKey) {
        const t = TABLES[table];
        let pulled = 0, newest = 0;
        const page = () => {
            const since = cfg()[watermarkKey];
            const filter = since ? `&updated_at=gt.${encodeURIComponent(since)}` : "";
            return rest(`${table}?select=${t.column},client_updated_at,updated_at${filter}&order=updated_at.asc&limit=${LIST_PAGE}`).then(rows => {
                if (!rows.length) return { pulled, newest };
                return getAll(t.store).then(local => {
                    const mine = new Map(local.map(r => [String(r[t.key]), stamp(r)]));
                    const want = rows.filter(r => !(mine.get(String(r[t.column])) >= r.client_updated_at) &&
                        !(table === "runs" && isRunLive() && Number(r.run_id) === currentRunId))
                        .map(r => r[t.column]);
                    let chain = Promise.resolve();
                    for (let i = 0; i < want.length; i += FETCH_CHUNK) {
                        const ids = want.slice(i, i + FETCH_CHUNK).map(id => table === "runs" ? id : `"${String(id).replace(/"/g, "")}"`);
                        chain = chain.then(() => rest(`${table}?select=data&${t.column}=in.(${ids.map(encodeURIComponent).join(",")})`))
                            .then(full => Promise.all(full.map(row => {
                                newest = Math.max(newest, stamp(row.data));
                                return putRaw(t.store, row.data);
                            })))
                            .then(() => { pulled += Math.min(FETCH_CHUNK, want.length - i); });
                    }
                    return chain.then(() => {
                        save({ [watermarkKey]: rows[rows.length - 1].updated_at });
                        return rows.length === LIST_PAGE ? page() : { pulled, newest };
                    });
                });
            });
        };
        return page();
    }

    function sync() {
        if (!configured() || !db) return Promise.resolve(null);
        if (syncing) return syncing;
        const startedAt = Date.now();
        save({ lastAttemptAt: startedAt });
        renderPanel("Syncing…");
        syncing = push("runs")
            .then(runs => push("course_progress").then(cp => ({ pushed: runs.n + cp.n, newest: Math.max(runs.newest, cp.newest) })))
            .then(p => {
                save({ lastPush: p.newest });
                return pull("runs", "lastPull").then(runs => pull("course_progress", "lastCpPull").then(cp => {
                    // What just came down is already in the cloud: don't send it back up.
                    // Anything changed here since the sync started is newer than startedAt.
                    const pulledNewest = Math.min(Math.max(runs.newest, cp.newest), startedAt);
                    save({ lastPush: Math.max(cfg().lastPush || 0, pulledNewest) });
                    return { pushed: p.pushed, pulled: runs.pulled + cp.pulled };
                }));
            })
            // A small write each sync: Supabase pauses free projects with too little activity
            .then(res => rest("rpc/heartbeat", { method: "POST", body: "{}" }).catch(() => {}).then(() => res))
            .then(res => {
                save({ lastSyncAt: startedAt, lastError: null });
                if (res.pulled) {
                    renderHomeRecent();
                    if (document.getElementById("tab-history").classList.contains("active")) renderHistory();
                }
                return res;
            })
            .catch(err => {
                save({ lastError: err.message || String(err) });
                return null;
            })
            .finally(() => {
                syncing = null;
                renderPanel();
            });
        return syncing;
    }

    // Sync in a moment (after a run is saved) if online; offline, the catch-up sync gets it later
    function soon(delayMs = 2000) {
        clearTimeout(soonTimer);
        soonTimer = setTimeout(() => { if (!isRunLive() && navigator.onLine !== false) sync(); }, delayMs);
    }

    // At most every 12 hours, counted from the last attempt so being offline doesn't retry constantly
    function catchUp() {
        if (!isRunLive() && Date.now() - (cfg().lastAttemptAt || 0) > CATCH_UP_MS) sync();
    }

    // ─── Export / import ─────────────────────────────────────────────────────

    function exportJson() {
        return Promise.all([getAll("runs"), getAll("courseProgress")]).then(([runs, courseProgress]) => {
            const text = JSON.stringify({ app: "run-tracker", format: 1, exportedAt: new Date().toISOString(), runs, courseProgress });
            const name = `run-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
            if (NativeTracker.available) {
                return NativeTracker.saveFile(name, text).then(where => `Saved ${runs.length} runs to ${where}`);
            }
            const a = document.createElement("a");
            a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
            a.download = name;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 10000);
            return `Exported ${runs.length} runs`;
        });
    }

    // Adds what's missing or newer in the file; never deletes anything
    function importJson(text) {
        const data = JSON.parse(text);
        if (!data || data.app !== "run-tracker" || !Array.isArray(data.runs)) throw new Error("Not a Run Tracker backup");
        return Promise.all([getAll("runs"), getAll("courseProgress")]).then(([runs, cps]) => {
            const newer = (list, key) => {
                const have = new Map(list.map(r => [r[key], stamp(r)]));
                return (rec) => rec && rec[key] != null && !(have.get(rec[key]) >= stamp(rec));
            };
            const addRuns = data.runs.filter(newer(runs, "runId"));
            const addCps = (data.courseProgress || []).filter(newer(cps, "progressId"));
            return Promise.all([...addRuns.map(r => putRaw("runs", r)), ...addCps.map(c => putRaw("courseProgress", c))]).then(() => {
                // Push everything again on the next sync, so the cloud has what came in
                if (addRuns.length || addCps.length) { save({ lastPush: 0 }); soon(); }
                renderHomeRecent();
                renderHistory();
                return `Imported ${addRuns.length} runs` + (addCps.length ? ` and ${addCps.length} course records` : "");
            });
        });
    }

    // ─── App updates (GitHub Releases) ───────────────────────────────────────

    function checkForUpdate(force = false) {
        if (!NativeTracker.available) return Promise.resolve(null);
        let last = 0;
        try { last = Number(localStorage.getItem("updateCheckedAt")) || 0; } catch (e) { /* storage unavailable */ }
        if (!force && Date.now() - last < UPDATE_CHECK_MS) return Promise.resolve(latestRelease);
        return Promise.all([NativeTracker.appInfo(), request(`https://api.github.com/repos/${REPO}/releases/latest`, {}, 15000)])
            .then(([app, rel]) => {
                try { localStorage.setItem("updateCheckedAt", String(Date.now())); } catch (e) { /* storage unavailable */ }
                const code = Number((/(\d+)$/.exec(rel.tag_name || "") || [])[1]);
                const apk = (rel.assets || []).find(a => /\.apk$/.test(a.name));
                latestRelease = apk && code > app.versionCode
                    ? { name: rel.name || rel.tag_name, url: apk.browser_download_url, notes: rel.body || "" } : null;
                if (latestRelease && !force) showToast(`Update available: ${latestRelease.name}. See History → Backup & updates.`, 5000);
                renderPanel();
                return latestRelease;
            });
    }

    // ─── Panel (History tab) ─────────────────────────────────────────────────

    let panelOpen = false;

    function ago(t) {
        const s = Math.round((Date.now() - t) / 1000);
        if (s < 60) return "just now";
        if (s < 3600) return `${Math.round(s / 60)} min ago`;
        if (s < 86400) return `${Math.round(s / 3600)} h ago`;
        return new Date(t).toLocaleDateString();
    }

    function statusLine(busy) {
        const c = cfg();
        if (busy) return ["sync", busy];
        if (!c.url || !c.key) return ["cloud_off", "Cloud backup is off"];
        if (!c.session) return ["cloud_off", c.lastError || "Signed out of cloud backup"];
        if (c.lastError) return ["sync_problem", `Sync failed: ${c.lastError}`];
        return ["cloud_done", c.lastSyncAt ? `Backed up ${ago(c.lastSyncAt)}` : "Not synced yet"];
    }

    function renderPanel(busy) {
        const el = document.getElementById("sync-panel");
        if (!el) return;
        const c = cfg();
        const [icon, text] = statusLine(busy);
        const update = latestRelease
            ? `<p class="sp-update">Update available: <b>${escapeHtml(latestRelease.name)}</b> <button class="btn-small" id="sp-get-update">Download</button></p>` : "";
        let account;
        if (!c.session) {
            account = `
                <p class="sp-note">Sync to your own free Supabase project. Setup takes 5 minutes: see <b>docs/CLOUD_SYNC.md</b> in the repo.</p>
                <input id="sp-url" type="url" placeholder="Project URL (https://….supabase.co)" value="${escapeHtml(c.url || "")}" autocomplete="off">
                <input id="sp-key" type="text" placeholder="Publishable (anon) key" value="${escapeHtml(c.key || "")}" autocomplete="off">
                <input id="sp-email" type="email" placeholder="Email" value="${escapeHtml(c.email || "")}" autocomplete="username">
                <input id="sp-password" type="password" placeholder="Password" autocomplete="current-password">
                <div class="sp-row"><button class="btn-small" id="sp-signin">Sign in</button><button class="btn-small" id="sp-signup">Create account</button></div>`;
        } else {
            account = `
                <p class="sp-note">Signed in as <b>${escapeHtml(c.email || "")}</b>. Each run syncs when it finishes; anything missed catches up within 12 hours.</p>
                <div class="sp-row"><button class="btn-small" id="sp-sync">Sync now</button><button class="btn-small" id="sp-signout">Sign out</button></div>`;
        }
        el.innerHTML = `
            <details class="sync-panel" ${panelOpen ? "open" : ""}>
                <summary><span class="material-icons">${icon}</span><span class="sp-status">${escapeHtml(text)}</span>${latestRelease ? '<span class="sp-dot">update</span>' : ""}</summary>
                <h4>Cloud backup</h4>
                ${account}
                <h4>Backup file</h4>
                <p class="sp-note">Everything in one JSON file, in case the cloud is ever unavailable. Import adds what's missing; it never deletes.</p>
                <div class="sp-row"><button class="btn-small" id="sp-export">Export JSON</button><button class="btn-small" id="sp-import">Import JSON</button></div>
                <input id="sp-file" type="file" accept="application/json,.json" style="display:none">
                ${NativeTracker.available ? `<h4>App</h4>${update || '<p class="sp-note" id="sp-version"></p>'}
                    <div class="sp-row"><button class="btn-small" id="sp-check-update">Check for updates</button></div>` : ""}
            </details>`;
        bindPanel(el);
    }

    function bindPanel(el) {
        const $ = (id) => el.querySelector("#" + id);
        el.querySelector("details").addEventListener("toggle", e => { panelOpen = e.target.open; });
        const withBusy = (btn, work) => {
            btn.disabled = true;
            Promise.resolve().then(work).catch(err => showToast(err.message || String(err), 4000)).finally(() => renderPanel());
        };
        const account = (fn) => {
            const url = $("sp-url").value, key = $("sp-key").value, email = $("sp-email").value, password = $("sp-password").value;
            if (!/^https:\/\//.test(url.trim()) || !key.trim() || !email.trim() || !password) {
                showToast("Fill in the project URL, key, email and password.", 3000);
                return null;
            }
            connect(url, key, email);
            return fn(email.trim(), password);
        };
        if ($("sp-signin")) $("sp-signin").addEventListener("click", e => withBusy(e.target, () => {
            const p = account(signIn);
            return p && p.then(res => showToast(res ? `Signed in and synced: ${res.pushed} runs up, ${res.pulled} down.`
                : "Signed in, but the sync failed. The reason is at the top of this panel.", 4000));
        }));
        if ($("sp-signup")) $("sp-signup").addEventListener("click", e => withBusy(e.target, () => {
            const p = account(signUp);
            return p && p.then(now => showToast(now ? "Account created. Your runs are syncing." :
                "Account created. Confirm the email Supabase sent you, then tap Sign in.", 5000));
        }));
        if ($("sp-sync")) $("sp-sync").addEventListener("click", e => withBusy(e.target, () => sync().then(res => {
            if (res) showToast(`Synced: ${res.pushed} up, ${res.pulled} down.`, 2500);
        })));
        if ($("sp-signout")) $("sp-signout").addEventListener("click", () => {
            if (confirm("Sign out of cloud backup? Your runs stay on this phone.")) { signOut(); renderPanel(); }
        });
        $("sp-export").addEventListener("click", e => withBusy(e.target, () => exportJson().then(msg => showToast(msg, 4000))));
        $("sp-import").addEventListener("click", () => $("sp-file").click());
        $("sp-file").addEventListener("change", e => {
            const file = e.target.files[0];
            if (!file) return;
            file.text().then(importJson).then(msg => showToast(msg, 4000)).catch(err => showToast(`Import failed: ${err.message}`, 4000));
        });
        if ($("sp-check-update")) $("sp-check-update").addEventListener("click", e => withBusy(e.target, () =>
            checkForUpdate(true).then(rel => { if (!rel) showToast("You're on the latest version.", 2500); })));
        if ($("sp-get-update")) $("sp-get-update").addEventListener("click", () => NativeTracker.openUrl(latestRelease.url));
        if ($("sp-version")) NativeTracker.appInfo().then(a => { $("sp-version").textContent = `Version ${a.versionName}`; }).catch(() => {});
    }

    // ─── Start-up ────────────────────────────────────────────────────────────

    function init() {
        renderPanel();
        // The catch-up sync also keeps a free Supabase project from pausing (heartbeat)
        setTimeout(() => { catchUp(); checkForUpdate().catch(() => {}); }, 3000);
        document.addEventListener("visibilitychange", () => { if (!document.hidden) catchUp(); });
    }

    return { init, sync, soon, exportJson, importJson, checkForUpdate, signIn, signUp, signOut, configured };
})();

document.addEventListener("DOMContentLoaded", () => {
    // After script.js has opened the database
    const wait = setInterval(() => { if (db) { clearInterval(wait); CloudSync.init(); } }, 200);
});
