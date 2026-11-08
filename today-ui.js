// today-ui.js — The top of the home screen: what today is for, your week at a
// glance, the plan's settings and your shoes. The planning is in training-plan.js.
//
// Records in the course progress store (so they sync and back up):
//   "training-plan"  see training-plan.js
//   "shoes"          { list: [{ id, name, addedAt, startKm, limitKm, retired }], current }

const Today = (() => {
    const SHOES_ID = "shoes";
    const SHOE_LIMIT_KM = 700;
    const SICK_DAYS = 5;
    const ICONS = { quality: "bolt", long: "route", easy: "directions_run", race: "emoji_events", gym: "fitness_center", rest: "" };
    const LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

    let plan = null;
    let shoes = null;
    let weather = null;
    let lastRuns = [];
    let selected = null; // a day tapped in the week strip
    let rendering = null, again = false;

    const P = () => TrainingPlan;
    const R = () => WeeklyReport;
    const el = () => document.getElementById("home-today");
    const dayName = (t) => P().DAY_NAMES[(new Date(t).getDay() + 6) % 7];

    // ─── Records ─────────────────────────────────────────────────────────────

    function getRecord(id) {
        return new Promise((resolve, reject) => {
            const req = db.transaction(["courseProgress"]).objectStore("courseProgress").get(id);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    function save(record) {
        return saveCourseProgress(record).then(() => CloudSync.soon());
    }

    function load() {
        return Promise.all([getRecord(P().ID), getRecord(SHOES_ID), getAllRuns()]).then(([p, s, runs]) => {
            plan = p;
            shoes = s;
            lastRuns = runs.filter(r => r.endTime);
            return lastRuns;
        });
    }

    // Signs of fatigue from last week's report, which tell today to go easy
    function signals() {
        return getRecord("week-report-" + R().dayKey(WeekReport.latestWeek())).then(rec => {
            const rule = rec && rec.report && rec.report.observation && rec.report.observation.rule;
            return { drift: rule === "effort" || rule === "rest-and-feel", restingUp: rule === "rest-and-feel" };
        }).catch(() => ({}));
    }

    function context(runs, sig) {
        const f = todayFeel();
        return {
            runs, now: Date.now(), weather, signals: sig,
            feel: f.feel || f.suggested || "normal",
            p5: (plan && plan.p5) || RunAnalysis.fiveKPace(runs, Date.now()),
        };
    }

    // ─── Shoes ───────────────────────────────────────────────────────────────

    function shoeKm(shoe, runs) {
        return (shoe.startKm || 0) + runs.filter(r => r.shoe === shoe.id && r.activity !== "strength").reduce((a, r) => a + r.distance / 1000, 0);
    }

    // The shoes a new run or walk is in (null for the gym, or with none set up)
    function shoeFor(activity) {
        if (activity === "strength" || !shoes || !shoes.current) return null;
        const s = shoes.list.find(x => x.id === shoes.current && !x.retired);
        return s ? s.id : null;
    }

    function shoeNote(run, runs) {
        if (!run.shoe || !shoes) return null;
        const s = shoes.list.find(x => x.id === run.shoe);
        if (!s) return null;
        const km = shoeKm(s, runs);
        const limit = s.limitKm || SHOE_LIMIT_KM;
        return km >= limit ? `👟 Your ${s.name} have done ${Math.round(km)} km: about time for a new pair.` : null;
    }

    // ─── The card ────────────────────────────────────────────────────────────

    function render() {
        const box = el();
        if (!box || !db) return Promise.resolve();
        if (rendering) { again = true; return rendering; }
        rendering = Promise.all([load(), signals()]).then(([runs, sig]) => {
            if (!plan) { box.innerHTML = setupHtml(); bindSetup(box); return; }
            const ctx = context(runs, sig);
            // The paces start from your 5K now, then move only when you say so
            if (!plan.p5 && ctx.p5) { plan.p5 = ctx.p5; plan.p5At = ctx.now; save(plan); }
            const monday = R().monday(ctx.now);
            const days = P().week(plan, monday, ctx);
            const paused = new Set();
            const st = P().streak(plan, runs, ctx.now, paused);
            box.innerHTML = cardHtml(days, ctx, st, runs);
            bindCard(box, days, ctx);
            schedule(ctx);
        }).catch(err => console.error("Today card:", err)).finally(() => {
            rendering = null;
            // Something changed while this one was drawing: draw again
            if (again) { again = false; render(); }
        });
        return rendering;
    }

    function setupHtml() {
        return `<div class="today-card today-setup">
            <h3>Plan your week</h3>
            <p>Say how often you want to run and do strength, and the app tells you what each day is for: easy runs, one harder session, a long run that grows safely, and your full-body workouts. It adjusts to how your runs go.</p>
            <div class="sp-row"><button class="up-next-start" id="today-quick"><span class="material-icons">check</span> Use the suggested week</button></div>
            <button class="link-btn" id="today-setup">Choose my own days</button>
        </div>`;
    }

    function bindSetup(box) {
        box.querySelector("#today-quick").addEventListener("click", () => { plan = P().defaults(Date.now()); save(plan).then(render); });
        box.querySelector("#today-setup").addEventListener("click", () => openPlan());
    }

    function stripHtml(days, ctx) {
        const todayKey = R().dayKey(ctx.now);
        return `<div class="today-week">${days.map(d => {
            const p = d.plan;
            const kind = p.kind === "run" ? p.role : p.kind;
            const did = d.done.runs.length || d.done.gyms.length;
            const planned = p.kind !== "rest";
            const key = R().dayKey(d.day);
            const cls = ["tw-day", key === todayKey ? "today" : "", did ? "done" : "", key === selected ? "picked" : "", d.day < ctx.now && planned && !did && key !== todayKey ? "missed" : ""].filter(Boolean).join(" ");
            const icon = did ? "check" : ICONS[kind] || "";
            const two = p.kind === "run" && p.gymToo;
            return `<button class="${cls}" data-day="${key}" aria-label="${d.name}: ${escapeHtml(p.title)}">
                <small>${LETTERS[d.dow]}</small><span class="material-icons">${icon || "remove"}</span>${two && !did ? '<i class="tw-plus">+</i>' : ""}</button>`;
        }).join("")}</div>`;
    }

    function sessionHtml(d, ctx, isToday) {
        const p = d.plan;
        const head = `<small class="today-when">${isToday ? "Today" : d.name} · ${escapeHtml(p.blockText || "")}</small>`;
        const why = p.why ? `<details class="today-why"><summary>Why this?</summary><p>${escapeHtml(p.why)}</p></details>` : "";
        const notes = (p.notes || []).filter(n => !/Foot core/.test(n) || isToday).map(n => `<li>${escapeHtml(n)}</li>`).join("");
        const runDone = d.done.runs.length > 0, gymDone = d.done.gyms.length > 0;
        let action = "";
        if (isToday && p.kind === "run" && !runDone) {
            const hide = p.role === "easy" || p.role === "long";
            action = `<button class="up-next-start" id="today-start"><span class="material-icons">play_arrow</span> Start: ${escapeHtml(p.title)}</button>
                ${hide ? `<label class="today-just"><input type="checkbox" id="today-justrun"> Just run: hide pace and distance</label>` : ""}`;
        } else if (isToday && p.kind === "gym" && !gymDone) {
            action = `<button class="up-next-start" id="today-gym"><span class="material-icons">fitness_center</span> Start <span id="today-gym-name">your workout</span></button>`;
        }
        let gymLine = "";
        if (p.kind === "run" && p.gymToo) {
            gymLine = gymDone ? `<p class="today-done-line">✓ Strength done too.</p>`
                : `<p class="today-also">Also today: strength, a few hours after the run if you can.${isToday ? ` <button class="btn-small" id="today-gym">Start <span id="today-gym-name">workout</span></button>` : ""}</p>`;
        }
        const done = (p.kind === "run" && runDone) || (p.kind === "gym" && gymDone);
        const doneLine = done ? `<p class="today-done-line">✓ Done. ${p.kind === "run" ? `${(d.done.runs[0].distance / 1000).toFixed(1)} km in ${formatDuration(d.done.runs[0].time)}.` : "Nice work."}</p>` : "";
        return `${head}<h3 class="${done ? "today-title done" : "today-title"}">${escapeHtml(p.kind === "gym" ? "Strength" : p.title)}</h3>
            ${p.kind === "gym" ? `<p id="today-gym-about">${escapeHtml(p.about)}</p>` : `<p>${escapeHtml(p.about)}</p>`}
            ${doneLine}${notes ? `<ul class="today-notes">${notes}</ul>` : ""}${why}${action}${gymLine}`;
    }

    function cardHtml(days, ctx, st, runs) {
        const todayKey = R().dayKey(ctx.now);
        const today = days.find(d => R().dayKey(d.day) === todayKey);
        const shown = (selected && days.find(d => R().dayKey(d.day) === selected)) || today;
        const isToday = shown === today;
        const parts = [];

        const sick = plan.sickUntil && plan.sickUntil > ctx.now;
        if (sick) {
            parts.push(`<div class="today-banner"><b>Taking it easy until ${dayName(plan.sickUntil)}.</b> Short easy runs only if your symptoms are above the neck; chest, aches or a fever mean rest. <button class="btn-small" id="today-better">I'm better</button></div>`);
        }
        const last = runs.filter(r => !r.activity || (r.activity === "strength" && !r.light)).reduce((m, r) => Math.max(m, r.startTime), 0);
        if (last && ctx.now - last >= 6 * 86400000 && !sick) {
            parts.push(`<div class="today-banner welcome">👋 <b>Welcome back.</b> Nothing to make up: today starts gentle and the plan carries on from here.</div>`);
        }
        const sug = P().paceSuggestion(plan, runs, ctx.now);
        if (sug) {
            parts.push(`<div class="today-banner">${sug.faster
                ? `📈 Your runs put your 5K at <b>${formatPace(sug.p5)} /km</b>; the plan still uses ${formatPace(sug.was)}. Use the quicker paces?`
                : `Your recent runs put your 5K at <b>${formatPace(sug.p5)} /km</b>, slower than the plan's ${formatPace(sug.was)}. Ease the paces?`}
                <div class="sp-row"><button class="btn-small" id="today-pace-yes">Yes</button><button class="btn-small" id="today-pace-no">Not now</button></div></div>`);
        }
        if (shoes) {
            const worn = shoes.list.find(s => s.id === shoes.current && !s.retired && shoeKm(s, runs) >= (s.limitKm || SHOE_LIMIT_KM));
            if (worn) parts.push(`<div class="today-banner">👟 Your ${escapeHtml(worn.name)} have done ${Math.round(shoeKm(worn, runs))} km. About time for a new pair: add them under Plan &amp; shoes.</div>`);
        }

        const target = `<p class="today-streak"><b>${st.done} of ${st.target}</b> this week${st.done >= st.target ? " ✓" : st.kept ? " · that keeps your streak" : ` · ${st.keepAt} keep${st.keepAt === 1 ? "s" : ""} your streak going`}${st.streak ? ` · 🔥 ${st.streak}-week streak` : ""}${st.freezes ? ` · ${st.freezes} freeze${st.freezes > 1 ? "s" : ""}` : ""}</p>`;

        let extras = "";
        if (isToday) {
            const ranEasy = today.done.runs.length && today.plan.role !== "quality";
            const foot = today.done.extras.some(x => x.title === "Foot core");
            if (ranEasy && !foot) extras += `<p class="today-also">Five minutes of foot core now? It cut running injuries by more than half in a year-long trial. <button class="btn-small" id="today-foot">Start foot core</button></p>`;
            const tests = runs.filter(r => r.activity === "strength" && r.title === "Calf test");
            const gyms = runs.filter(r => r.activity === "strength" && !r.light).length;
            const lastTest = tests.reduce((m, r) => Math.max(m, r.startTime), 0);
            if (gyms >= 4 && ctx.now - lastTest > 28 * 86400000 && today.plan.kind === "gym") {
                extras += `<p class="today-also">The monthly calf test is due: two sets, as many single-leg calf raises as you can. <button class="btn-small" id="today-calftest">Do it</button></p>`;
            }
            // A rest day after a missed run: not owed, but on offer
            const planned = days.filter(d => d.day < ctx.now && d.plan.kind === "run").length;
            const ran = days.filter(d => d.day <= ctx.now && d.done.runs.length).length;
            if (today.plan.kind === "rest" && ran < planned && !today.done.runs.length) {
                extras += `<p class="today-also">Missed a run this week? It isn't owed. If you feel like it, an easy 20-30 minutes fits today. <button class="btn-small" id="today-easy">Easy run</button></p>`;
            }
        }
        const next = !isToday ? "" : (() => {
            const later = days.find(d => d.day > today.day && d.plan.kind !== "rest");
            return later ? `<p class="today-next">Next: ${later.name} · ${escapeHtml(later.plan.kind === "gym" ? "Strength" : later.plan.title)}</p>` : "";
        })();

        return `<div class="today-card">
            ${stripHtml(days, ctx)}${target}${parts.join("")}
            <div class="today-main">${sessionHtml(shown, ctx, isToday)}${extras}${next}</div>
            <div class="today-links">
                <button class="link-btn" id="today-plan">Plan &amp; shoes</button>
                ${sick ? "" : `<button class="link-btn" id="today-sick">Not feeling 100%?</button>`}
            </div>
        </div>`;
    }

    function bindCard(box, days, ctx) {
        const on = (id, fn) => { const b = box.querySelector("#" + id); if (b) b.addEventListener("click", fn); };
        box.querySelectorAll(".tw-day").forEach(b => b.addEventListener("click", () => {
            selected = b.dataset.day === R().dayKey(ctx.now) || b.dataset.day === selected ? null : b.dataset.day;
            render();
        }));
        const today = days.find(d => R().dayKey(d.day) === R().dayKey(ctx.now));
        on("today-start", () => {
            const p = today.plan;
            const just = box.querySelector("#today-justrun");
            nextJustRun = !!(just && just.checked);
            if (p.session) startGuidedSession(p.session, "plan", null, null);
            else document.getElementById("start").click();
        });
        on("today-gym", () => Gym.openAndStart("next"));
        on("today-foot", () => Gym.openAndStart("foot"));
        on("today-calftest", () => Gym.openAndStart("calftest"));
        on("today-easy", () => startGuidedSession(P().easySession(25, !!plan.runWalk, ctx.now), "plan", null, null));
        on("today-plan", () => openPlan());
        on("today-sick", () => {
            if (!confirm(`Take it easy for ${SICK_DAYS} days? Runs become short and easy, strength waits. Tap "I'm better" any time.`)) return;
            plan.sickUntil = Date.now() + SICK_DAYS * 86400000;
            save(plan).then(render);
        });
        on("today-better", () => { plan.sickUntil = null; save(plan).then(render); });
        on("today-pace-yes", () => {
            const s = P().paceSuggestion(plan, lastRuns, Date.now());
            if (s) { plan.p5 = s.p5; plan.p5At = Date.now(); }
            save(plan).then(render).then(() => showToast("Paces updated.", 2000));
        });
        on("today-pace-no", () => { plan.p5SnoozeUntil = Date.now() + 14 * 86400000; save(plan).then(render); });
        if (box.querySelector("#today-gym-name")) {
            Gym.nextUp().then(n => {
                if (!n) return;
                box.querySelectorAll("#today-gym-name").forEach(x => { x.textContent = n.title; });
                const about = box.querySelector("#today-gym-about");
                if (about) about.textContent = `${n.title}: ${n.names.join(", ")}.`;
            }).catch(() => {});
        }
    }

    // ─── Reminders ───────────────────────────────────────────────────────────

    // One alarm, always pointing at the next planned session you haven't done
    function schedule(ctx) {
        if (!NativeTracker.available || !NativeTracker.planReminder) return;
        const next = plan && plan.remind ? P().nextReminder(plan, ctx) : null;
        (next ? NativeTracker.planReminder(next.at, next.title, next.text) : NativeTracker.planReminderOff()).catch(() => {});
    }

    // ─── The plan screen ─────────────────────────────────────────────────────

    const screen = () => document.getElementById("plan-screen");
    let draft = null, draftWeek = null;

    // `week`: a Monday to change just that week's days; otherwise your usual week
    function openPlan({ week = null } = {}) {
        return load().then(() => {
            draft = JSON.parse(JSON.stringify(plan || P().defaults(Date.now())));
            draftWeek = week;
            try { if (!(history.state && history.state.planScreen)) history.pushState({ planScreen: true }, ""); } catch (e) { /* not allowed here */ }
            renderPlan();
        });
    }

    function closePlan(fromHistory) {
        screen().style.display = "none";
        if (!fromHistory && history.state && history.state.planScreen) history.back();
        render();
    }

    window.addEventListener("popstate", () => {
        if (screen() && screen().style.display !== "none" && !(history.state && history.state.planScreen)) closePlan(true);
    });

    function days() {
        if (!draftWeek) return { runDays: draft.runDays, gymDays: draft.gymDays };
        return P().weekDays(draft, draftWeek);
    }

    function setDays(runDays, gymDays) {
        if (!draftWeek) { draft.runDays = runDays; draft.gymDays = gymDays; return; }
        draft.weeks = draft.weeks || {};
        draft.weeks[R().dayKey(draftWeek)] = { runDays, gymDays };
    }

    function dayChips(kind, chosen) {
        return `<div class="plan-days">${P().DAY_NAMES.map((n, i) => `<button class="plan-day${chosen.includes(i) ? " on" : ""}" data-kind="${kind}" data-d="${i}">${n.slice(0, 3)}</button>`).join("")}</div>`;
    }

    function renderPlan() {
        const d = days();
        const roles = P().roles(d.runDays, draft.goal);
        const long = Object.keys(roles).find(k => roles[k] === "long");
        const warn = long != null && d.gymDays.includes((Number(long) + 6) % 7)
            ? `<p class="plan-warn">Strength the day before your long run leaves tired legs for it. Another day would be better.</p>` : "";
        const shape = d.runDays.length ? [...d.runDays].sort((a, b) => a - b).map(x => `${P().DAY_NAMES[x].slice(0, 3)}: ${{ long: "long run", quality: "harder session", quality2: "harder session", easy: "easy run" }[roles[x]]}`).join(" · ") : "No runs";
        const runs = lastRuns;
        const shoeList = shoes ? shoes.list.filter(s => !s.retired) : [];
        const raceGoal = ["5k", "10k", "half"].includes(draft.goal);
        screen().innerHTML = `<div class="rd-bar">
                <button class="rd-back" id="plan-back" aria-label="Back"><span class="material-icons">arrow_back</span></button>
                <div class="rd-title">${draftWeek ? `This week · ${new Date(draftWeek).toLocaleDateString(undefined, { day: "numeric", month: "short" })}` : "Plan & shoes"}</div>
            </div><div class="rd-body">
            ${draftWeek ? `<p class="gym-why">Changes these days for this week only. Your usual week stays as it is.</p>` : `
            <h3>What for?</h3>
            <div class="plan-goals">${Object.keys(P().GOALS).map(k => `<button class="plan-goal${draft.goal === k ? " on" : ""}" data-goal="${k}">${escapeHtml(P().GOALS[k].label)}</button>`).join("")}</div>
            ${raceGoal ? `<label class="gym-field">Race day (optional) <input type="date" id="plan-race" value="${draft.raceDate ? new Date(draft.raceDate).toISOString().slice(0, 10) : ""}"></label>
                <p class="gym-why">With a date, the two weeks before it ease off (a taper) so you start fresh.</p>` : ""}`}
            <h3>Run days</h3>
            ${dayChips("run", d.runDays)}
            <p class="gym-why">${escapeHtml(shape)}</p>
            <h3>Strength days</h3>
            ${dayChips("gym", d.gymDays)}
            <p class="gym-why">Two a week is the usual guide. On a run day, do it a few hours after the run.</p>${warn}
            ${draftWeek ? "" : `
            <label class="plan-toggle"><input type="checkbox" id="plan-runwalk" ${draft.runWalk ? "checked" : ""}> Run-walk: run 4 minutes, walk 1, on easy and long runs</label>
            ${NativeTracker.available ? `<label class="plan-toggle"><input type="checkbox" id="plan-remind" ${draft.remind ? "checked" : ""}> Remind me on plan days (once, only if it isn't done)</label>` : ""}
            <h3>Shoes</h3>
            ${shoeList.length ? `<ul class="plan-shoes">${shoeList.map(s => `<li><label><input type="radio" name="plan-shoe" value="${s.id}" ${shoes.current === s.id ? "checked" : ""}> ${escapeHtml(s.name)}</label>
                <span>${Math.round(shoeKm(s, runs))} of ${s.limitKm || SHOE_LIMIT_KM} km</span><button class="btn-small" data-retire="${s.id}">Retire</button></li>`).join("")}</ul>
                <p class="gym-why">New runs and walks count towards the ticked pair.</p>` : `<p class="gym-why">Add your shoes to track how far they've gone. Most last 500-800 km.</p>`}
            <button class="btn-small" id="plan-add-shoe">Add shoes</button>`}
            <div class="sp-row plan-save"><button class="up-next-start" id="plan-save">Save</button></div>
            </div>`;
        screen().style.display = "flex";
        bindPlan();
    }

    function bindPlan() {
        const s = screen();
        const on = (id, ev, fn) => { const b = s.querySelector("#" + id); if (b) b.addEventListener(ev, fn); };
        on("plan-back", "click", () => closePlan(false));
        s.querySelectorAll("[data-goal]").forEach(b => b.addEventListener("click", () => {
            draft.goal = b.dataset.goal;
            if (P().GOALS[draft.goal].runWalk) draft.runWalk = true;
            renderPlan();
        }));
        s.querySelectorAll(".plan-day").forEach(b => b.addEventListener("click", () => {
            const d = days();
            const list = b.dataset.kind === "run" ? [...d.runDays] : [...d.gymDays];
            const i = Number(b.dataset.d);
            const next = list.includes(i) ? list.filter(x => x !== i) : list.concat(i).sort((a, c) => a - c);
            if (b.dataset.kind === "run") setDays(next, d.gymDays); else setDays(d.runDays, next);
            renderPlan();
        }));
        on("plan-race", "change", (e) => { draft.raceDate = e.target.value ? new Date(e.target.value + "T09:00").getTime() : null; });
        on("plan-runwalk", "change", (e) => { draft.runWalk = e.target.checked; });
        on("plan-remind", "change", (e) => { draft.remind = e.target.checked; });
        s.querySelectorAll("input[name=plan-shoe]").forEach(r => r.addEventListener("change", () => {
            shoes.current = r.value;
            save(shoes);
        }));
        s.querySelectorAll("[data-retire]").forEach(b => b.addEventListener("click", () => {
            const shoe = shoes.list.find(x => x.id === b.dataset.retire);
            if (!shoe || !confirm(`Retire your ${shoe.name}? Their runs keep them; new runs won't.`)) return;
            shoe.retired = Date.now();
            if (shoes.current === shoe.id) shoes.current = null;
            save(shoes).then(renderPlan);
        }));
        on("plan-add-shoe", "click", () => {
            const name = prompt("Which shoes? (e.g. Pegasus 41)");
            if (!name || !name.trim()) return;
            const already = Number(prompt("How many km have they done already? (0 if new)", "0")) || 0;
            const shoe = { id: String(Date.now()), name: name.trim().slice(0, 40), addedAt: Date.now(), startKm: Math.max(0, already), limitKm: SHOE_LIMIT_KM };
            shoes = shoes || { progressId: SHOES_ID, list: [], current: null };
            shoes.list.push(shoe);
            shoes.current = shoe.id;
            save(shoes).then(renderPlan);
        });
        on("plan-save", "click", () => {
            const d = days();
            if (!d.runDays.length && !d.gymDays.length) { alert("Pick at least one day."); return; }
            const fresh = !plan;
            plan = draft;
            save(plan).then(() => {
                closePlan(false);
                showToast(fresh ? "Your plan is set. The top of the Run tab shows what each day is for." : "Plan saved.", 3500);
            });
        });
    }

    // ─── For the weekly report ───────────────────────────────────────────────

    // This week's plan as lines, from what's already loaded: [{ name, text }], or null without a plan
    function weekLines(monday) {
        if (!plan) return null;
        const ctx = { runs: lastRuns, now: Date.now(), p5: plan.p5, weather: null, feel: "normal" };
        return P().week(plan, monday, ctx).filter(d => d.plan.kind !== "rest")
            .map(d => ({ name: d.name, text: d.plan.kind === "gym" ? "Strength" : d.plan.title + (d.plan.gymToo ? " + strength" : "") }));
    }

    function init() {
        render();
        Enrich.todayWeather().then(w => { if (w) { weather = w; render(); } }).catch(() => {});
        document.addEventListener("visibilitychange", () => { if (!document.hidden) render(); });
    }

    // Your shoes, for the run details page: [{ id, name }]
    const shoeList = () => (shoes ? shoes.list : []).map(s => ({ id: s.id, name: s.name, retired: !!s.retired }));

    return { init, render, openPlan, shoeFor, shoeNote, shoeList, weekLines, comebackFor: (t) => P().comeback(lastRuns, t), hasPlan: () => !!plan };
})();
