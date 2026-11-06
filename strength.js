// strength.js — The gym screen: pick a workout, follow the suggested sets, and a
// voice handles rest timers and timed holds. Suggestions come from StrengthPlanner.
// Finished sessions are records in the `runs` store (activity "strength",
// distance 0), so history, sync, backup and delete all work as they do for runs.
// Your workouts sync as one record in the course progress store. On Android the
// voice runs in WorkoutService, so it carries on with the screen locked.

const Gym = (() => {
    const ROUTINES_ID = "strength-routines";
    const DRAFT_KEY = "gymDraft";

    let routines = null;
    let past = [];
    let session = null;
    let editing = null;
    let ticker = null;
    let webTimers = [];

    const screen = () => document.getElementById("gym-screen");
    const copy = (x) => JSON.parse(JSON.stringify(x));

    // ─── Stored things ───────────────────────────────────────────────────────

    function loadRoutines() {
        return new Promise((resolve, reject) => {
            const req = db.transaction(["courseProgress"]).objectStore("courseProgress").get(ROUTINES_ID);
            req.onsuccess = () => resolve(req.result ? req.result.routines : copy(StrengthPlanner.DEFAULT_ROUTINES));
            req.onerror = (e) => reject(e.target.error);
        });
    }

    function saveRoutines() {
        return saveCourseProgress({ progressId: ROUTINES_ID, routines }).then(() => CloudSync.soon());
    }

    // Survives the app being closed mid-workout
    function saveDraft() {
        try {
            if (session) localStorage.setItem(DRAFT_KEY, JSON.stringify(session));
            else localStorage.removeItem(DRAFT_KEY);
        } catch (e) { /* storage unavailable */ }
    }

    function loadDraft() {
        try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch (e) { return null; }
    }

    // ─── Voice ───────────────────────────────────────────────────────────────

    function clearWebTimers() {
        webTimers.forEach(clearTimeout);
        webTimers = [];
    }

    function say(cues, label) {
        if (NativeTracker.available) { NativeTracker.workoutCues(cues, label).catch(() => {}); return; }
        clearWebTimers();
        webTimers = cues.map(c => setTimeout(() => speakText(c.text), c.inMs));
    }

    function stopVoice() {
        clearWebTimers();
        if (NativeTracker.available) NativeTracker.workoutStop().catch(() => {});
    }

    // ─── The session ─────────────────────────────────────────────────────────

    const current = () => session.items[session.at];
    const setsDone = (item) => item.done.length;
    const isHold = (item) => item.target.unit === "s";
    const label = (item) => item.target.variation || item.ex.name;

    function plannedWeight(item) {
        return item.done.length ? item.done[item.done.length - 1].weight : item.target.weight;
    }

    // What comes after the set being done now, or null at the end
    function following() {
        const item = current();
        if (setsDone(item) + 1 < item.target.sets) return item;
        return session.items[session.at + 1] || null;
    }

    function spoken(item) {
        return StrengthPlanner.spokenSet(label(item), item.target.reps, plannedWeight(item) || 0, item.target.unit);
    }

    function restFor(rest, next) {
        return StrengthPlanner.restCues(rest, spoken(next), { nextIsHold: isHold(next) });
    }

    function intro(item) {
        return isHold(item) ? `${spoken(item)} Tap start when you're ready.` : spoken(item);
    }

    function start(routine) {
        if (isRunLive()) { alert("Finish your run before starting a workout."); return; }
        const feel = todayFeel();
        session = {
            title: routine.title, startTime: Date.now(), at: 0, restEndsAt: null, holdEndsAt: null,
            items: routine.exercises.map(ex => ({
                ex, target: StrengthPlanner.target(ex, past, feel.feel || feel.suggested || "normal"), done: [],
            })),
        };
        saveDraft();
        if (NativeTracker.available) NativeTracker.workoutStart(routine.title).catch(() => {});
        requestWakeLock();
        say([{ inMs: 0, text: `${routine.title}. First: ${intro(current())}` }], routine.title);
        render();
    }

    // Records a set and moves on to the rest. A hold's rest was already spoken
    // with the hold, unless you stopped early, and runs from when the hold ended.
    function recordSet(weight, reps, { from = Date.now(), silent = false } = {}) {
        const item = current();
        const next = following();
        item.done.push({ weight, reps, target: item.target.reps });
        session.holdEndsAt = null;
        if (!next) return finish();
        if (next !== item) session.at++;
        const rest = item.ex.restSec;
        session.restEndsAt = from + rest * 1000;
        saveDraft();
        if (!silent) say(restFor(rest, next), `Next: ${label(next)}`);
    }

    function logSet(weight, reps) {
        const done = recordSet(weight, reps);
        if (session) render();
        return done;
    }

    // The voice takes it from here: through the hold and on into the rest
    function startHold() {
        const item = current();
        const seconds = item.target.reps;
        const next = following();
        session.holdEndsAt = Date.now() + seconds * 1000;
        saveDraft();
        const cues = StrengthPlanner.holdCues(seconds, label(item));
        const rest = next ? StrengthPlanner.after(restFor(item.ex.restSec, next), seconds * 1000) : [];
        say(cues.concat(rest), label(item));
        render();
    }

    function stopHold() {
        const left = (session.holdEndsAt - Date.now()) / 1000;
        const done = recordSet(0, Math.max(0, Math.round(current().target.reps - left)));
        if (session) render();
        return done;
    }

    // Catches up with the clock, which may have run on with the screen off.
    // Returns true if anything moved on.
    function settle() {
        if (!session) return false;
        const now = Date.now();
        if (session.holdEndsAt && now >= session.holdEndsAt) {
            const ended = session.holdEndsAt;
            recordSet(0, current().target.reps, { from: ended, silent: true });
            settle();
            return true;
        }
        if (session.restEndsAt && now >= session.restEndsAt) {
            session.restEndsAt = null;
            saveDraft();
            return true;
        }
        return false;
    }

    function skipRest() {
        session.restEndsAt = null;
        saveDraft();
        say([{ inMs: 0, text: isHold(current()) ? intro(current()) : `Go. ${spoken(current())}` }], label(current()));
        render();
    }

    function addRest(seconds) {
        session.restEndsAt += seconds * 1000;
        saveDraft();
        const left = Math.round((session.restEndsAt - Date.now()) / 1000);
        say(restFor(left, current()).slice(1), `Next: ${label(current())}`);
    }

    function skipExercise() {
        if (session.at + 1 >= session.items.length) return finish();
        session.at++;
        session.restEndsAt = null;
        saveDraft();
        say([{ inMs: 0, text: intro(current()) }], label(current()));
        render();
    }

    // Easier or Harder, before the first set of an exercise
    function changeLevel(by) {
        const item = current();
        const t = StrengthPlanner.change(item.ex, item.target, by);
        if (!t) return;
        item.target = t;
        saveDraft();
        say([{ inMs: 0, text: intro(item) }], label(item));
        render();
    }

    function finish() {
        const s = session;
        const exercises = s.items.filter(i => i.done.length).map(i => ({
            id: i.ex.id, name: i.ex.name, variation: i.target.variation || undefined, level: i.ex.ladder ? i.target.level : undefined,
            levels: i.ex.ladder ? i.ex.ladder.length : undefined, unit: i.target.unit, sets: i.done,
        }));
        session = null;
        saveDraft();
        clearInterval(ticker);
        releaseWakeLock();
        if (!exercises.length) { stopVoice(); close(); return Promise.resolve(); }
        const end = Date.now();
        speakFinal();
        return saveRun({
            runId: s.startTime, activity: "strength", title: s.title, startTime: s.startTime, endTime: end,
            distance: 0, time: (end - s.startTime) / 1000, pace: 0, timeSeries: [], exercises,
            feel: todayFeel().feel || undefined,
        }).then(() => {
            CloudSync.soon();
            renderHomeRecent();
            return openPicker();
        }).then(() => showToast("Workout saved.", 2500));
    }

    function speakFinal() {
        stopVoice();
        speakText("Workout done. Good work.");
    }

    // ─── Screens ─────────────────────────────────────────────────────────────

    function targetText(t) {
        const amount = t.unit === "s" ? `${t.sets} × ${t.reps} s` : `${t.sets} × ${t.reps}`;
        return t.weight == null ? `${amount} · pick a weight` : t.weight > 0 ? `${amount} · ${t.weight} kg` : amount;
    }

    function pickerHtml() {
        const feel = todayFeel();
        const f = feel.feel || feel.suggested || "normal";
        return `<div class="gym-list">${routines.map((r, i) => `
            <div class="gym-card">
                <div class="gym-card-head"><b>${escapeHtml(r.title)}</b><button class="btn-small gym-edit" data-i="${i}">Edit</button></div>
                <ul class="gym-plan">${r.exercises.map(ex => {
                    const t = StrengthPlanner.target(ex, past, f);
                    return `<li><span>${escapeHtml(t.variation || ex.name)}</span><b>${targetText(t)}</b><small>${escapeHtml(t.why || "")}</small></li>`;
                }).join("")}</ul>
                <button class="up-next-start gym-start" data-i="${i}" ${r.exercises.length ? "" : "disabled"}><span class="material-icons">play_arrow</span> Start</button>
            </div>`).join("")}
            <button class="btn-small" id="gym-add-routine">Add a workout</button>
        </div>`;
    }

    function editorHtml() {
        const r = routines[editing];
        const unused = StrengthPlanner.PRESETS.filter(p => !r.exercises.some(e => e.id === p.id));
        return `<div class="gym-list"><div class="gym-card">
            <label class="gym-field">Name <input id="gym-title" value="${escapeHtml(r.title)}" maxlength="30"></label>
            <ul class="gym-plan gym-editing">${r.exercises.map((ex, i) => `<li><span>${escapeHtml(ex.name)}</span>
                <small>${ex.sets} sets · ${ex.repLow}–${ex.repHigh} ${ex.unit === "s" ? "seconds" : "reps"} · ${ex.restSec} s rest</small>
                <button class="btn-small gym-remove" data-i="${i}" aria-label="Remove ${escapeHtml(ex.name)}"><span class="material-icons">close</span></button></li>`).join("")}</ul>
            <label class="gym-field">Add an exercise
                <select id="gym-preset"><option value="">Choose…</option>${StrengthPlanner.GROUPS.map(g => {
                    const inGroup = unused.filter(p => p.group === g);
                    return inGroup.length ? `<optgroup label="${escapeHtml(g)}">${inGroup.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("")}</optgroup>` : "";
                }).join("")}<option value="custom">Other…</option></select>
            </label>
            <div class="sp-row"><button class="btn-small" id="gym-edit-done">Done</button><button class="btn-small btn-danger" id="gym-delete-routine">Delete workout</button></div>
        </div></div>`;
    }

    function setHtml() {
        const item = current();
        const n = setsDone(item) + 1;
        const w = plannedWeight(item);
        const weighted = item.ex.stepKg > 0;
        const canChange = item.ex.ladder && n === 1;
        const level = item.target.level;
        const head = `<div class="gym-progress">Exercise ${session.at + 1} of ${session.items.length} · Set ${n} of ${item.target.sets}</div>
            <div class="gym-name">${escapeHtml(label(item))}</div>
            ${item.ex.ladder ? `<div class="gym-progress">Step ${level + 1} of ${item.ex.ladder.length} · ${escapeHtml(item.ex.name)}</div>` : ""}
            ${item.target.why && n === 1 ? `<p class="gym-why">${escapeHtml(item.target.why)}</p>` : ""}
            ${canChange ? `<div class="sp-row"><button class="btn-small" id="gym-easier" ${level > 0 ? "" : "disabled"}>Easier</button><button class="btn-small" id="gym-harder" ${level < item.ex.ladder.length - 1 ? "" : "disabled"}>Harder</button></div>` : ""}`;
        const leave = `<div class="sp-row"><button class="btn-small" id="gym-skip">Skip exercise</button><button class="btn-small" id="gym-finish">Finish workout</button></div>`;
        if (isHold(item)) {
            return `<div class="gym-now">${head}
                <div class="gym-clock">${item.target.reps} s</div>
                <button class="start-btn" id="gym-hold"><span class="material-icons">play_arrow</span> Start hold</button>
                ${leave}</div>`;
        }
        return `<div class="gym-now">${head}
            <div class="gym-inputs">
                ${weighted ? `<label>kg<input id="gym-weight" type="number" inputmode="decimal" min="0" step="0.5" value="${w == null ? "" : w}"></label>` : ""}
                <label>reps<div class="gym-stepper"><button id="gym-less" aria-label="One rep fewer">−</button><input id="gym-reps" type="number" inputmode="numeric" min="0" value="${item.target.reps}"><button id="gym-more" aria-label="One rep more">+</button></div></label>
            </div>
            <button class="start-btn" id="gym-done"><span class="material-icons">check</span> Set done</button>
            ${leave}</div>`;
    }

    function holdHtml() {
        const item = current();
        return `<div class="gym-now">
            <div class="gym-progress">Set ${setsDone(item) + 1} of ${item.target.sets}</div>
            <div class="gym-name">${escapeHtml(label(item))}</div>
            <div class="gym-clock" id="gym-clock"></div>
            <button class="btn-small" id="gym-hold-stop">Stop early</button>
        </div>`;
    }

    function restHtml() {
        const item = current();
        const what = isHold(item) ? `${item.target.reps} seconds`
            : `${item.target.reps} reps${plannedWeight(item) > 0 ? ` at ${plannedWeight(item)} kg` : ""}`;
        return `<div class="gym-now">
            <div class="gym-progress">Rest</div>
            <div class="gym-clock" id="gym-clock"></div>
            <p class="gym-why">Next: <b>${escapeHtml(label(item))}</b>, ${what}</p>
            <div class="sp-row"><button class="btn-small" id="gym-rest-more">+30 s</button><button class="btn-small" id="gym-rest-skip">Skip rest</button></div>
        </div>`;
    }

    function updateClock() {
        if (!session) return;
        if (settle()) { render(); return; }
        const ends = session.holdEndsAt || session.restEndsAt;
        const el = document.getElementById("gym-clock");
        if (ends && el) el.textContent = formatTime(Math.ceil((ends - Date.now()) / 1000));
    }

    function render() {
        const el = screen();
        settle();
        const title = session ? session.title : editing != null ? "Edit workout" : "Gym";
        const body = session ? (session.holdEndsAt ? holdHtml() : session.restEndsAt ? restHtml() : setHtml()) : editing != null ? editorHtml() : pickerHtml();
        el.innerHTML = `<div class="rd-bar">
                <button class="rd-back" id="gym-back" aria-label="Back"><span class="material-icons">arrow_back</span></button>
                <div class="rd-title">${escapeHtml(title)}</div>
            </div><div class="rd-body">${body}</div>`;
        el.style.display = "flex";
        clearInterval(ticker);
        if (session && (session.restEndsAt || session.holdEndsAt)) {
            ticker = setInterval(updateClock, 250);
            updateClock();
        }
        bind(el);
    }

    function bind(el) {
        const on = (id, fn) => { const b = el.querySelector("#" + id); if (b) b.addEventListener("click", fn); };
        on("gym-back", () => {
            if (editing != null) { editing = null; return saveRoutines().then(render); }
            close(); // a workout in progress keeps going; the Gym button reopens it
        });
        el.querySelectorAll(".gym-start").forEach(b => b.addEventListener("click", () => start(routines[Number(b.dataset.i)])));
        el.querySelectorAll(".gym-edit").forEach(b => b.addEventListener("click", () => { editing = Number(b.dataset.i); render(); }));
        on("gym-add-routine", () => {
            routines.push({ id: String(Date.now()), title: `Workout ${routines.length + 1}`, exercises: [] });
            editing = routines.length - 1;
            render();
        });
        el.querySelectorAll(".gym-remove").forEach(b => b.addEventListener("click", () => {
            routines[editing].exercises.splice(Number(b.dataset.i), 1);
            render();
        }));
        const title = el.querySelector("#gym-title");
        if (title) title.addEventListener("input", () => { routines[editing].title = title.value.trim() || "Workout"; });
        const preset = el.querySelector("#gym-preset");
        if (preset) preset.addEventListener("change", () => {
            let ex = StrengthPlanner.PRESETS.find(p => p.id === preset.value);
            if (preset.value === "custom") {
                const name = prompt("Exercise name");
                if (!name || !name.trim()) return render();
                const timed = confirm("Is this a timed hold, like a plank? OK for yes, Cancel if you count reps.");
                ex = StrengthPlanner.custom(name.slice(0, 40), { timed, weights: !timed && confirm("Do you use weights for this? OK for yes, Cancel for bodyweight.") });
            }
            if (ex) routines[editing].exercises.push(copy(ex));
            render();
        });
        on("gym-edit-done", () => { editing = null; saveRoutines().then(render); });
        on("gym-delete-routine", () => {
            if (!confirm("Delete this workout? Your past sessions stay.")) return;
            routines.splice(editing, 1);
            editing = null;
            saveRoutines().then(render);
        });

        const reps = el.querySelector("#gym-reps");
        const step = (d) => { reps.value = Math.max(0, (Number(reps.value) || 0) + d); };
        on("gym-easier", () => changeLevel(-1));
        on("gym-harder", () => changeLevel(1));
        on("gym-hold", startHold);
        on("gym-hold-stop", stopHold);
        on("gym-less", () => step(-1));
        on("gym-more", () => step(1));
        on("gym-done", () => {
            const input = el.querySelector("#gym-weight");
            const weight = input ? parseFloat(input.value) : 0;
            if (input && !(weight >= 0)) { showToast("Enter the weight you lifted.", 2500); input.focus(); return; }
            logSet(weight, Math.max(0, Math.round(Number(reps.value) || 0)));
        });
        on("gym-skip", skipExercise);
        on("gym-finish", () => { if (confirm("Finish this workout?")) finish(); });
        on("gym-rest-more", () => addRest(30));
        on("gym-rest-skip", skipRest);
    }

    function openPicker() {
        return Promise.all([routines ? routines : loadRoutines(), getAllRuns()]).then(([r, runs]) => {
            routines = r;
            past = runs.filter(x => x.activity === "strength");
            render();
        });
    }

    function open() {
        if (isRunLive()) { alert("Finish your run before starting a workout."); return Promise.resolve(); }
        return openPicker();
    }

    function close() {
        clearInterval(ticker);
        screen().style.display = "none";
        renderHomeRecent();
        renderButton();
    }

    function renderButton() {
        const label = document.querySelector("#open-gym .btn-label");
        if (label) label.textContent = session ? "Back to workout" : "Gym";
    }

    // A workout the app lost: carry on with it, or keep what was done
    function init() {
        const draft = loadDraft();
        if (!draft || !draft.items) return;
        session = draft;
        const did = draft.items.reduce((n, i) => n + i.done.length, 0);
        if (confirm(`You have an unfinished workout (${did} sets done). Carry on with it?`)) {
            if (NativeTracker.available) NativeTracker.workoutStart(draft.title).catch(() => {});
            openPicker();
        } else {
            finish();
        }
        renderButton();
    }

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden && session) { requestWakeLock(); updateClock(); }
    });

    return { open, init };
})();

// Every set of a session, for its details page
function strengthDetailHtml(run) {
    return (run.exercises || []).map(e => {
        const weighted = e.sets.some(s => s.weight > 0);
        const unit = e.unit === "s" ? " s" : "";
        return `<h3>${escapeHtml(e.variation || e.name)}</h3>
        <table class="rd-table"><tr><th>Set</th>${weighted ? "<th>kg</th>" : ""}<th>${e.unit === "s" ? "Held" : "Reps"}</th><th></th></tr>
        ${e.sets.map((s, i) => `<tr><td>${i + 1}</td>${weighted ? `<td>${s.weight}</td>` : ""}<td>${s.reps}${unit}</td><td>${s.reps >= s.target ? "✓" : `target ${s.target}${unit}`}</td></tr>`).join("")}
        </table>`;
    }).join("");
}

function strengthStatsHtml(runs) {
    const rows = StrengthPlanner.progress(runs);
    if (!rows.length) return "";
    const latest = (p) => p.weight > 0 ? `${p.weight} kg × ${p.reps}` : p.unit === "s" ? `${p.reps} s` : `${p.reps} reps`;
    const level = (p) => p.weight > 0 ? `est. 1RM ${Math.round(p.best)} kg${p.sessions > 1 && Math.round(p.change) ? ` (${p.change > 0 ? "+" : ""}${Math.round(p.change)})` : ""}`
        : p.levels ? `Step ${p.level + 1} of ${p.levels}` : "";
    return `<h3>Strength</h3><table class="rd-table">
        <tr><th>Exercise</th><th>Latest</th><th></th></tr>
        ${rows.map(p => `<tr><td>${escapeHtml(p.variation || p.name)}</td><td>${latest(p)}</td><td>${level(p)}</td></tr>`).join("")}
    </table>`;
}

function walkStatsHtml(runs, now = Date.now()) {
    const walks = runs.filter(r => r.activity === "walk");
    if (!walks.length) return "";
    const week = walks.filter(r => now - r.startTime < 7 * 86400000);
    const km = (list) => (list.reduce((a, r) => a + r.distance, 0) / 1000).toFixed(1);
    const steps = week.reduce((a, r) => a + (r.steps && r.steps.length ? r.steps[r.steps.length - 1][1] : 0), 0);
    return `<h3>Walking</h3><p class="gr-note"><b>${km(week)} km</b> in the last 7 days (${week.length} walk${week.length === 1 ? "" : "s"}${steps ? `, ${steps.toLocaleString()} steps` : ""}) · ${km(walks)} km all time</p>`;
}
