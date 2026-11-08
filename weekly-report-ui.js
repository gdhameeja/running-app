// weekly-report-ui.js — The weekly report screen, the card on the home screen that
// says one is ready, and the Monday notification. The numbers are in weekly-report.js.
//
// A report is a record in the course progress store, so it syncs and backs up with
// everything else: { progressId: "week-report-2026-11-02", weekStart, feeling, note,
// paused, seenAt, report }. The latest week is worked out afresh each time it's
// opened, since a late sync or watch data can change it; older ones stay as they were.

const WeekReport = (() => {
    const PREFIX = "week-report-";
    const REMIND_KEY = "weekReportReminder";
    const REMIND_HOUR = 8;
    const FEELINGS = { easy: "Easy", right: "About right", hard: "Hard", much: "Too much" };
    const QUESTIONS = ["What got in the way, if anything?", "Any niggle worth watching?", "What went better than you expected?", "What do you want from next week?"];

    let record = null;
    let review = false;

    const screen = () => document.getElementById("report-screen");
    const shown = () => screen().style.display !== "none";
    const idFor = (start) => PREFIX + WeeklyReport.dayKey(start);
    const latestWeek = (now = Date.now()) => WeeklyReport.addWeeks(WeeklyReport.monday(now), -1);

    function allRecords() {
        return new Promise((resolve, reject) => {
            const range = IDBKeyRange.bound(PREFIX, PREFIX + "￿");
            const req = db.transaction(["courseProgress"]).objectStore("courseProgress").getAll(range);
            req.onsuccess = () => resolve(req.result);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    function store() {
        return saveCourseProgress(record).then(() => CloudSync.soon());
    }

    // The newest week is always recalculated; `start` picks an older one to read back
    function load(start, fresh = false) {
        return Promise.all([allRecords(), getAllRuns()]).then(([records, runs]) => {
            const mine = records.find(r => r.progressId === idFor(start));
            record = mine || { progressId: idFor(start), weekStart: start };
            if (!fresh && start !== latestWeek() && record.report) return record;
            return Enrich.dailyHealth().then(health => {
                const paused = new Set(records.filter(r => r.paused).map(r => r.weekStart));
                record.report = WeeklyReport.build({ sessions: runs, start, health, paused });
                return record;
            });
        });
    }

    // ─── The screen ──────────────────────────────────────────────────────────

    const dateText = (t) => new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" });
    const weekText = (start) => `${dateText(start)} – ${dateText(WeeklyReport.addWeeks(start, 1) - 86400000)}`;

    function questionHtml() {
        return `<div class="wr-card wr-ask">
            <h3>How was your week?</h3>
            <div class="wr-feelings">${Object.keys(FEELINGS).map(k => `<button class="feel-btn" data-feeling="${k}">${FEELINGS[k]}</button>`).join("")}</div>
            <button class="link-btn" id="wr-skip">Skip</button>
        </div>`;
    }

    function rowsHtml(rows) {
        return `<table class="wr-table"><tr><th></th><th>This week</th><th>Usually</th></tr>
            ${rows.map(r => `<tr><td>${escapeHtml(r.label)}${r.note ? `<small>${escapeHtml(r.note)}</small>` : ""}</td>
                <td><b>${escapeHtml(r.value)}</b></td><td>${r.usual == null ? "–" : r.close ? "about the same" : escapeHtml(r.usual)}</td></tr>`).join("")}
        </table>`;
    }

    function basedOnHtml(r) {
        const s = r.source;
        const parts = [s.runs ? `Heart rate on ${s.runsWithHr} of ${s.runs} runs` : ""];
        if (s.watch) parts.push(`sleep on ${s.sleepNights} of 7 nights`, `resting heart rate on ${s.restingDays} of 7 days`);
        else parts.push("no watch connected");
        return parts.filter(Boolean).join(" · ");
    }

    function reportHtml() {
        const r = record.report;
        const question = QUESTIONS[Math.round(r.weekStart / 604800000) % QUESTIONS.length];
        const asked = record.feeling ? `<p class="wr-said">You said: ${escapeHtml(FEELINGS[record.feeling] || record.feeling)}</p>` : "";
        const pause = `<button class="link-btn" id="wr-pause">${record.paused ? "Count this week after all" : "Ill or away? Leave this week out"}</button>`;
        const foot = `<p class="wr-based">${escapeHtml(basedOnHtml(r))}</p>${pause}`;
        const note = `<label class="wr-note">${escapeHtml(question)}<textarea id="wr-note" rows="2">${escapeHtml(record.note || "")}</textarea></label>`;
        if (r.light) return `<div class="wr-card">${asked}<p>${escapeHtml(r.line)}</p></div>${note}${foot}`;
        const o = r.observation;
        return `${asked}<div class="wr-card"><p class="wr-line">${escapeHtml(r.line)}</p>
                ${r.wentWell ? `<p class="wr-good"><span class="material-icons">star</span>${escapeHtml(r.wentWell)}</p>` : ""}
            </div>
            <div class="wr-card">${rowsHtml(r.rows)}
                <p class="wr-minor">Active ${r.active.active} of the last ${r.active.counted} weeks · ${r.activeMinutes} active minutes (a guide is 150–300)</p>
            </div>
            ${o ? `<div class="wr-card"><h3>To notice</h3><p>${escapeHtml(o.text)}</p>
                <details class="wr-why"><summary>Why this?</summary><p>${escapeHtml(o.why)}</p></details></div>` : ""}
            ${(o && o.next) || r.longest ? `<div class="wr-card"><h3>Next week</h3>
                ${o && o.next ? `<p>${escapeHtml(o.next)}</p>` : ""}
                ${r.longest && !(o && o.rule === "long-run") ? `<p>Your longest run lately is ${r.longest.km.toFixed(1)} km, so about ${r.longest.top.toFixed(1)} km is the top of your usual range.</p>` : ""}
            </div>` : ""}
            ${r.review ? `<div class="wr-card"><h3>Four weeks against the four before</h3>
                <table class="wr-table wr-review">${r.review.map(x => `<tr><td>${escapeHtml(x.label)}</td><td>${escapeHtml(x.text)}</td></tr>`).join("")}</table>
                <p class="wr-minor">One week can't show a change in fitness, so it's only judged here. Pace allows for hills and heat.</p></div>` : ""}
            ${note}${foot}`;
    }

    function render() {
        const ask = !record.feeling && !record.skipped && !record.report.light;
        screen().innerHTML = `<div class="rd-bar">
                <button class="rd-back" id="wr-back" aria-label="Back"><span class="material-icons">arrow_back</span></button>
                <div class="rd-title">Your week · ${weekText(record.weekStart)}</div>
            </div><div class="rd-body">${ask ? questionHtml() : reportHtml()}</div>`;
        screen().style.display = "flex";
        bind();
    }

    function bind() {
        const el = screen();
        const on = (id, ev, fn) => { const b = el.querySelector("#" + id); if (b) b.addEventListener(ev, fn); };
        on("wr-back", "click", () => close(false));
        el.querySelectorAll("[data-feeling]").forEach(b => b.addEventListener("click", () => {
            record.feeling = b.dataset.feeling;
            store().then(render);
        }));
        on("wr-skip", "click", () => { record.skipped = true; store().then(render); });
        on("wr-note", "change", (e) => { record.note = e.target.value.trim() || undefined; store(); });
        on("wr-pause", "click", () => {
            record.paused = !record.paused;
            const start = record.weekStart;
            store().then(() => load(start, true)).then(store).then(render).then(renderCards);
        });
    }

    function open(start = latestWeek()) {
        return load(start).then(() => {
            record.seenAt = record.seenAt || Date.now();
            return store();
        }).then(() => {
            try { if (!(history.state && history.state.weekReport)) history.pushState({ weekReport: true }, ""); } catch (e) { /* not allowed here */ }
            render();
            renderCards();
        }).catch(err => alert("Couldn't open that report: " + (err && err.message || err)));
    }

    function close(fromHistory) {
        screen().style.display = "none";
        if (!fromHistory && history.state && history.state.weekReport) history.back();
        renderList();
    }

    window.addEventListener("popstate", () => {
        if (shown() && !(history.state && history.state.weekReport)) close(true);
    });

    // ─── Home card and the list on Stats ─────────────────────────────────────

    // Shows until you've opened it, once a finished week has something in it
    function renderCards() {
        const el = document.getElementById("home-report");
        if (!el) return Promise.resolve();
        const start = latestWeek();
        return Promise.all([allRecords(), getAllRuns()]).then(([records, runs]) => {
            const seen = records.some(r => r.progressId === idFor(start) && r.seenAt);
            const any = WeeklyReport.tally(runs.filter(r => r.endTime), start).sessions.length > 0;
            if (seen || !any) { el.innerHTML = ""; return; }
            el.innerHTML = `<button class="wr-ready"><span class="material-icons">insights</span>
                <span><b>Your week is ready</b><small>${weekText(start)}</small></span></button>`;
            el.querySelector("button").addEventListener("click", () => open(start));
        });
    }

    function renderList() {
        const el = document.getElementById("week-reports");
        if (!el) return Promise.resolve();
        const latest = latestWeek();
        return Promise.all([allRecords(), getAllRuns()]).then(([records, runs]) => {
            const weeks = new Set(records.filter(r => r.report).map(r => r.weekStart));
            if (WeeklyReport.tally(runs.filter(r => r.endTime), latest).sessions.length) weeks.add(latest);
            const list = [...weeks].sort((a, b) => b - a).slice(0, 12);
            if (!list.length) { el.innerHTML = ""; return; }
            const remind = NativeTracker.available
                ? `<label class="wr-remind"><input type="checkbox" id="wr-remind" ${remindOn() ? "checked" : ""}> Tell me on Monday mornings</label>` : "";
            el.innerHTML = `<h3>Weekly reports</h3>${list.map(w => `<button class="btn-small wr-open" data-week="${w}">${weekText(w)}</button>`).join("")}${remind}`;
            el.querySelectorAll(".wr-open").forEach(b => b.addEventListener("click", () => open(Number(b.dataset.week))));
            const box = el.querySelector("#wr-remind");
            if (box) box.addEventListener("change", () => setRemind(box.checked));
        });
    }

    // ─── The Monday notification ─────────────────────────────────────────────

    function remindOn() {
        try { return localStorage.getItem(REMIND_KEY) !== "off"; } catch (e) { return true; }
    }

    function setRemind(on) {
        try { localStorage.setItem(REMIND_KEY, on ? "on" : "off"); } catch (e) { /* storage unavailable */ }
        schedule();
    }

    function nextMonday(now = Date.now()) {
        const d = new Date(WeeklyReport.monday(now));
        d.setHours(REMIND_HOUR);
        return d.getTime() > now ? d.getTime() : WeeklyReport.addWeeks(d.getTime(), 1);
    }

    // The phone forgets alarms when it restarts, so every launch sets it again
    function schedule() {
        if (!NativeTracker.available) return;
        (remindOn() ? NativeTracker.reportReminder(nextMonday()) : NativeTracker.reportReminderOff()).catch(() => {});
    }

    function init() {
        schedule();
        renderCards();
    }

    return { init, open, renderCards, renderList, latestWeek, nextMonday };
})();
