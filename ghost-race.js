// ghost-race.js — Choosing a ghost: your PBs, a target time, any past run, or
// your best on a route you've run before. The race itself is in script.js.
//
// A ghost "spec" is small and saved with the run:
//   { type: "run",  runId, targetM, label }   replay that run over targetM metres
//   { type: "pace", targetM, timeMs, label }  an even pace to a target time

// Builds the ghost a spec describes. Resolves with { series, splits, pace, ... }.
function buildGhost(spec) {
    const finish = (series) => {
        const t = RunAnalysis.timeAtDistance(series, spec.targetM);
        if (t == null || !(t > 0)) throw new Error("the ghost's run is shorter than the race distance");
        return {
            spec, label: spec.label, targetM: spec.targetM, series,
            splits: RunAnalysis.sparseSeries(series),
            pace: t / 1000 / (spec.targetM / 1000),
        };
    };
    if (spec.type === "pace") {
        return Promise.resolve().then(() => finish(RunAnalysis.evenPaceSeries(spec.targetM, spec.timeMs)));
    }
    return getRunById(spec.runId).then(run => {
        if (!run) throw new Error("that run has been deleted");
        let series = RunAnalysis.seriesForRun(run);
        if (!series) {
            // No timing data: an even pace at the run's average
            series = RunAnalysis.evenPaceSeries(run.distance, run.time * 1000);
        } else if (series[series.length - 1].distance < run.distance - 1) {
            // Older runs' splits stop at the last 100 m; add the actual finish
            series = series.concat([{ distance: run.distance, time: run.time * 1000 }]);
        }
        return finish(series);
    });
}

// Your fastest run (by pace) covering each standard distance.
function getBestRunsForGhost(runs) {
    const ghosts = {};
    [1, 3, 5, 10].forEach(km => {
        let best = null, bestPace = Infinity;
        runs.forEach(r => {
            if (!r.endTime || r.distance < km * 1000 || !(r.time > 0)) return;
            const pace = r.time / (r.distance / 1000);
            if (pace < bestPace) { bestPace = pace; best = r; }
        });
        ghosts[km] = best && {
            run: best, pace: bestPace,
            timeSec: bestPace * km,
            date: new Date(best.startTime).toLocaleDateString(),
            simulated: !RunAnalysis.seriesForRun(best),
        };
    });
    return ghosts;
}

const routeSignatureCache = new Map();

function loadRouteNames() {
    try { return JSON.parse(localStorage.getItem("routeNames") || "{}") || {}; } catch (e) { return {}; }
}

function saveRouteName(id, name) {
    const names = loadRouteNames();
    if (name) names[id] = name; else delete names[id];
    try { localStorage.setItem("routeNames", JSON.stringify(names)); } catch (e) { /* storage unavailable */ }
}

// Routes run at least twice, newest activity first, each ranked and named.
function findRoutes(runs) {
    const names = loadRouteNames();
    const groups = RunAnalysis.groupRoutes(runs, routeSignatureCache).filter(g => g.runs.length >= 2);
    const defaults = {};
    return groups.map(g => {
        const ranked = RunAnalysis.rankRoute(g);
        const km = (ranked.distance / 1000).toFixed(1);
        let name = names[g.id];
        if (!name) {
            const base = `${km} km ${g.sig.loop ? "loop" : "route"}`;
            defaults[base] = (defaults[base] || 0) + 1;
            name = defaults[base] > 1 ? `${base} #${defaults[base]}` : base;
        }
        return { id: g.id, name, loop: g.sig.loop, ranked, lastRun: Math.max(...g.runs.map(r => r.startTime)) };
    }).sort((a, b) => b.lastRun - a.lastRun);
}

function routeFor(routes, runId) {
    for (const route of routes) {
        const i = route.ranked.entries.findIndex(e => e.run.runId === runId);
        if (i >= 0) return { route, rank: i + 1 };
    }
    return null;
}

function ordinal(n) {
    const s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function shortDate(t) {
    return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "2-digit" });
}

// ─── Ghost Race tab ──────────────────────────────────────────────────────────

const TARGET_DISTANCES = [
    { label: "1K", m: 1000 }, { label: "3K", m: 3000 }, { label: "5K", m: 5000 },
    { label: "10K", m: 10000 }, { label: "Half", m: 21097.5 }, { label: "Marathon", m: 42195 },
];

function renderGhostRaceTab() {
    getAllRuns().then(allRuns => {
        const runs = allRuns.filter(r => r.endTime && r.distance > 0);
        const ghosts = getBestRunsForGhost(runs);
        const container = document.getElementById("ghost-race-content");
        container.innerHTML = `
            <p class="ghost-intro">Race your best, a target time, any past run, or your record on a route you've run before.</p>
            <section class="gr-section">
                <h3>Your PBs</h3>
                <div class="ghost-grid" id="gr-pbs"></div>
            </section>
            <section class="gr-section">
                <h3>Target time</h3>
                <div class="gr-card gr-target">
                    <div class="gr-target-row">
                        <label>Distance
                            <select id="gr-target-dist">
                                ${TARGET_DISTANCES.map(d => `<option value="${d.m}" ${d.m === 5000 ? "selected" : ""}>${d.label}</option>`).join("")}
                                <option value="custom">Other…</option>
                            </select>
                        </label>
                        <label id="gr-custom-wrap" style="display:none;">km
                            <input id="gr-custom-km" type="number" min="0.2" max="100" step="0.1" inputmode="decimal" placeholder="7.5">
                        </label>
                        <label>Time
                            <input id="gr-target-time" type="text" inputmode="numeric" placeholder="2500" autocomplete="off" enterkeyhint="done">
                        </label>
                    </div>
                    <div class="gr-target-pace" id="gr-target-pace">Type the time, e.g. 2459 for 24:59</div>
                    <div class="gr-chips" id="gr-target-chips"></div>
                    <button class="ghost-start-btn" id="gr-target-start" disabled>Race this target</button>
                    <p class="gr-note">The ghost runs an even pace all the way.</p>
                </div>
            </section>
            <section class="gr-section">
                <h3>Race a past run</h3>
                <div id="gr-past"></div>
            </section>
            <section class="gr-section">
                <h3>Your routes</h3>
                <div id="gr-routes"><p class="gr-note">Finding routes you've run more than once…</p></div>
            </section>`;

        renderPbCards(ghosts);
        initTargetForm(ghosts);
        renderPastRuns(runs);
        // Route matching compares every run's path, so let the rest paint first
        setTimeout(() => renderRoutes(runs), 30);
    });
}

function renderPbCards(ghosts) {
    const grid = document.getElementById("gr-pbs");
    [1, 3, 5, 10].forEach(km => {
        const g = ghosts[km];
        const card = document.createElement("div");
        card.className = "ghost-card " + (g ? "available" : "unavailable");
        card.innerHTML = g ? `
            <div class="ghost-card-icon">👻</div>
            <div class="ghost-distance">${km}K</div>
            ${g.simulated ? '<div class="ghost-sim-badge">Even pace (no splits)</div>' : ""}
            <div class="ghost-pace">${formatPace(g.pace)} /km</div>
            <div class="ghost-time">${formatPace(g.timeSec)} total</div>
            <div class="ghost-date">${g.date}</div>
            <button class="ghost-start-btn">Race ghost</button>` : `
            <div class="ghost-card-icon">👻</div>
            <div class="ghost-distance">${km}K</div>
            <div class="ghost-pace">—</div>
            <div class="ghost-date">No run this long yet</div>`;
        if (g) {
            card.querySelector("button").addEventListener("click", () =>
                startGhostRaceMode({ type: "run", runId: g.run.runId, targetM: km * 1000, label: `${km}K PB` }));
        }
        grid.appendChild(card);
    });
}

function initTargetForm(ghosts) {
    const distSel = document.getElementById("gr-target-dist");
    const customWrap = document.getElementById("gr-custom-wrap");
    const customKm = document.getElementById("gr-custom-km");
    const timeIn = document.getElementById("gr-target-time");
    const paceEl = document.getElementById("gr-target-pace");
    const btn = document.getElementById("gr-target-start");

    const targetM = () => distSel.value === "custom"
        ? Math.round(parseFloat(customKm.value) * 1000) : parseFloat(distSel.value);

    function update() {
        customWrap.style.display = distSel.value === "custom" ? "" : "none";
        const m = targetM();
        const ms = RunAnalysis.parseDuration(timeIn.value);
        btn.disabled = true;
        if (!(m >= 200 && m <= 100000)) { paceEl.textContent = "Pick a distance between 0.2 and 100 km"; return; }
        if (ms == null) {
            paceEl.textContent = timeIn.value.trim() ? "That isn't a time. Try 2459 for 24:59 or 14500 for 1:45:00" : "Type the time, e.g. 2459 for 24:59";
            paceEl.className = "gr-target-pace" + (timeIn.value.trim() ? " bad" : "");
            return;
        }
        const pace = ms / 1000 / (m / 1000);
        const asTime = formatDurationLabel(ms);
        if (pace < 150 || pace > 1200) {
            paceEl.textContent = `${asTime} is ${formatPace(pace)} /km. Pick something between 2:30 and 20:00 /km.`;
            paceEl.className = "gr-target-pace bad";
            return;
        }
        paceEl.textContent = `${RunAnalysis.formatDistance(m)} in ${asTime}: ghost pace ${formatPace(pace)} /km`;
        paceEl.className = "gr-target-pace";
        btn.disabled = false;
    }
    distSel.addEventListener("change", update);
    customKm.addEventListener("input", update);
    timeIn.addEventListener("input", update);
    btn.addEventListener("click", () => {
        const m = targetM(), ms = RunAnalysis.parseDuration(timeIn.value);
        const t = formatDurationLabel(ms);
        startGhostRaceMode({ type: "pace", targetM: m, timeMs: ms, label: `${RunAnalysis.formatDistance(m)} in ${t}` });
    });

    // Suggestions: shave a bit off each PB
    const chips = document.getElementById("gr-target-chips");
    [1, 3, 5, 10].forEach(km => {
        const g = ghosts[km];
        if (!g) return;
        const shave = Math.max(5, Math.round(g.timeSec * 0.02 / 5) * 5);
        const goal = Math.max(1, Math.round(g.timeSec - shave));
        const chip = document.createElement("button");
        chip.className = "gr-chip";
        chip.textContent = `${km}K in ${formatTime(goal)}`;
        chip.title = `${shave} s faster than your ${km}K PB`;
        chip.addEventListener("click", () => {
            distSel.value = String(km * 1000);
            timeIn.value = formatTime(goal);
            update();
        });
        chips.appendChild(chip);
    });
}

function formatDurationLabel(ms) {
    const s = Math.round(ms / 1000);
    return s >= 3600 ? `${Math.floor(s / 3600)}:${formatTime(s % 3600).padStart(5, "0")}` : formatTime(s);
}

function renderPastRuns(runs) {
    const el = document.getElementById("gr-past");
    const eligible = runs.filter(r => r.distance >= 300).sort((a, b) => b.startTime - a.startTime);
    if (!eligible.length) { el.innerHTML = '<p class="gr-note">No runs yet.</p>'; return; }
    let shown = 8;
    const draw = () => {
        el.innerHTML = eligible.slice(0, shown).map((r, i) => `
            <div class="gr-run-row">
                <div class="gr-run-main">
                    <div class="gr-run-title">${i === 0 ? "Last run · " : ""}${shortDate(r.startTime)}</div>
                    <div class="gr-run-meta">${(r.distance / 1000).toFixed(2)} km · ${formatTime(Math.round(r.time))} · ${formatPace(r.pace)} /km${r.track ? "" : " · splits only"}</div>
                </div>
                <button class="btn-small gr-details" data-id="${r.runId}">Details</button>
                <button class="btn-small gr-race" data-id="${r.runId}">Race</button>
            </div>`).join("") +
            (eligible.length > shown ? '<button class="btn-small gr-more">Show more</button>' : "");
        el.querySelectorAll(".gr-race").forEach(b => b.addEventListener("click", () => {
            const run = eligible.find(r => r.runId === Number(b.dataset.id));
            const targetM = Math.floor(run.distance / 10) * 10;
            startGhostRaceMode({ type: "run", runId: run.runId, targetM, label: `Run of ${shortDate(run.startTime)}` });
        }));
        el.querySelectorAll(".gr-details").forEach(b => b.addEventListener("click", () => openRunDetail(Number(b.dataset.id))));
        const more = el.querySelector(".gr-more");
        if (more) more.addEventListener("click", () => { shown += 8; draw(); });
    };
    draw();
}

function renderRoutes(runs) {
    const el = document.getElementById("gr-routes");
    if (!el) return;
    const routes = findRoutes(runs);
    if (!routes.length) {
        el.innerHTML = '<p class="gr-note">Run the same route twice (same start, same way round) and it shows up here with a leaderboard.</p>';
        return;
    }
    el.innerHTML = "";
    routes.forEach(route => {
        const { distance, entries } = route.ranked;
        const best = entries[0];
        const card = document.createElement("div");
        card.className = "gr-card gr-route";
        card.innerHTML = `
            <div class="gr-route-head">
                <div>
                    <div class="gr-route-name">${escapeHtml(route.name)}</div>
                    <div class="gr-run-meta">${(distance / 1000).toFixed(2)} km ${route.loop ? "loop" : "route"} · ${entries.length} runs</div>
                </div>
                <button class="btn-small gr-rename" title="Rename"><span class="material-icons">edit</span></button>
            </div>
            <ol class="gr-board">
                ${entries.slice(0, 5).map((e, i) => `
                    <li data-id="${e.run.runId}">
                        <span class="gr-medal">${["🥇", "🥈", "🥉"][i] || i + 1}</span>
                        <span class="gr-board-date">${shortDate(e.run.startTime)}</span>
                        <span class="gr-board-time">${formatTime(Math.round(e.timeMs / 1000))}</span>
                        <span class="gr-board-pace">${formatPace(e.timeMs / 1000 / (distance / 1000))} /km</span>
                    </li>`).join("")}
            </ol>
            ${entries.length > 5 ? `<p class="gr-note">+ ${entries.length - 5} slower</p>` : ""}
            <button class="ghost-start-btn">Race your best here (${formatTime(Math.round(best.timeMs / 1000))})</button>`;
        card.querySelectorAll(".gr-board li").forEach(li =>
            li.addEventListener("click", () => openRunDetail(Number(li.dataset.id))));
        card.querySelector(".gr-rename").addEventListener("click", () => {
            const name = prompt("Name this route", route.name);
            if (name === null) return;
            saveRouteName(route.id, name.trim().slice(0, 40));
            renderRoutes(runs);
        });
        card.querySelector(".ghost-start-btn").addEventListener("click", () =>
            startGhostRaceMode({ type: "run", runId: best.run.runId, targetM: distance, label: `Best on ${route.name}` }));
        el.appendChild(card);
    });
}
