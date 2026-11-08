// training-plan.js — Your week, and what today is for. Pure, so tests.js loads it;
// today-ui.js shows it. reports/Running app enhancement ideas.md has the research.
// What it comes down to:
//  - Mostly easy running, one quality session a week (two with four or more runs),
//    and a long run. No intensity model clearly wins for 3-4 runs a week, so this
//    keeps the simple, low-risk shape.
//  - The long run grows against your own longest run of the last 30 days and never
//    plans more than 10% past it: single runs past that were the clearest injury
//    signal in 5,200 runners (Frandsen 2025). Week-to-week totals weren't.
//  - Four-week blocks: three building, one easier. A race date brings a taper of
//    the two weeks before it, volume down to 80% then 60%, the quick stuff kept.
//  - Paces come from your predicted 5K and only move when you agree to it.
//    Easy running is by effort, never pace. Heat slows the paced parts.
//  - A missed session is gone, not owed. Tired, unwell or back from a break:
//    today gets easier, said plainly, no guilt.
//  - A weekly target with one skip allowed, and a streak of weeks with freezes
//    you earn, rather than a daily streak (Sharif & Shu 2017; Milkman 2021).
//
// The plan is a record in the course progress store, so it syncs and backs up:
//   { progressId: "training-plan", goal, runDays, gymDays, runWalk, raceDate,
//     startedAt, p5, p5At, weeks: { "2026-11-09": { runDays, gymDays } }, sickUntil, remind }
// Days are 0 (Monday) to 6 (Sunday).

const TrainingPlan = (() => {
    const ID = "training-plan";
    const DAY = 86400000;
    const LONG_SPIKE = 1.1;
    const COMEBACK_DAYS = 7, WELCOME_BACK_DAYS = 6;
    const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

    const GOALS = {
        fitter: { label: "Run more, feel fitter", quality: ["strides", "cruise", "intervals"], longCapKm: 14, easy: [20, 50] },
        "5k": { label: "A faster 5K", quality: ["intervals", "strides", "cruise"], longCapKm: 12, easy: [20, 45] },
        "10k": { label: "A faster 10K", quality: ["cruise", "intervals", "strides"], longCapKm: 16, easy: [25, 50] },
        half: { label: "A half marathon", quality: ["cruise", "strides", "tempo"], longCapKm: 20, easy: [25, 60] },
        start: { label: "Start running (run-walk)", quality: [], longCapKm: 6, easy: [15, 35], runWalk: true },
    };

    const ra = () => typeof RunAnalysis !== "undefined" ? RunAnalysis : require("./analysis.js");
    const wr = () => typeof WeeklyReport !== "undefined" ? WeeklyReport : require("./weekly-report.js");
    const pace = (s) => { const t = Math.round(s); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };
    const spoken = (s) => { const t = Math.round(s), m = Math.floor(t / 60), r = t % 60; return r ? `${m} ${r < 10 ? "oh " + r : r} per kilometre` : `${m} minutes per kilometre`; };
    const round5 = (x) => Math.round(x / 5) * 5;
    const median = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

    // ─── The week's shape ────────────────────────────────────────────────────

    const RUN_DAYS = { 2: [1, 5], 3: [1, 3, 6], 4: [1, 3, 5, 6], 5: [0, 1, 3, 5, 6], 6: [0, 1, 2, 3, 5, 6] };

    // Strength days: off running days if possible, never the day before the long run
    function gymDaysFor(runDays, n) {
        const long = Math.max(...runDays);
        const before = (long + 6) % 7;
        const order = [0, 4, 2, 5, 3, 6, 1];
        const free = order.filter(d => !runDays.includes(d) && d !== before);
        const easyRunDays = order.filter(d => runDays.includes(d) && d !== long && d !== before);
        return free.concat(easyRunDays).slice(0, n).sort((a, b) => a - b);
    }

    function defaults(now = Date.now(), { runs = 3, gym = 2, goal = "fitter" } = {}) {
        const runDays = RUN_DAYS[runs] || RUN_DAYS[3];
        return {
            progressId: ID, v: 1, goal, runDays, gymDays: gymDaysFor(runDays, gym),
            runWalk: !!(GOALS[goal] && GOALS[goal].runWalk), raceDate: null,
            startedAt: wr().monday(now), p5: null, p5At: null, weeks: {}, sickUntil: null, remind: true,
        };
    }

    // This week's days: your usual ones, unless you changed this week
    function weekDays(plan, monday) {
        const w = plan.weeks && plan.weeks[wr().dayKey(monday)];
        return { runDays: (w && w.runDays) || plan.runDays, gymDays: (w && w.gymDays) || plan.gymDays };
    }

    // What each run day of a week is for: { day: "long" | "quality" | "easy" }
    function roles(runDays, goal) {
        const days = [...runDays].sort((a, b) => a - b);
        const out = {};
        if (!days.length) return out;
        const long = days[days.length - 1];
        days.forEach(d => { out[d] = "easy"; });
        out[long] = "long";
        const g = GOALS[goal] || GOALS.fitter;
        if (!g.quality.length || days.length < 2) return out;
        // Quality furthest from the long run, then a second one with four or more runs
        const gap = (a, b) => Math.min(Math.abs(a - b), 7 - Math.abs(a - b));
        const rest = days.filter(d => d !== long).sort((a, b) => gap(b, long) - gap(a, long) || a - b);
        out[rest[0]] = "quality";
        if (days.length >= 4) {
            const second = rest.slice(1).find(d => gap(d, rest[0]) >= 2 && gap(d, long) >= 1);
            if (second != null) out[second] = "quality2";
        }
        return out;
    }

    // ─── Where you are ───────────────────────────────────────────────────────

    const isRun = (r) => r.endTime && !r.activity;
    const counts = (r) => r.endTime && (!r.activity || (r.activity === "strength" && !r.light));

    // From your runs before `now`: what a usual run is, and the long-run ceiling
    function baseline(runs, now) {
        const done = runs.filter(r => isRun(r) && r.startTime < now);
        const recent = done.filter(r => r.startTime >= now - 42 * DAY && r.distance >= 1000);
        const last30 = done.filter(r => r.startTime >= now - 30 * DAY);
        const lastRun = done.reduce((m, r) => Math.max(m, r.startTime), 0);
        const typicalMin = median(recent.map(r => r.time / 60));
        const typicalPace = median(recent.filter(r => r.pace > 0).map(r => r.pace));
        return {
            typicalMin, typicalPace,
            longest30: Math.max(0, ...last30.map(r => r.distance)),
            daysSinceRun: lastRun ? (now - lastRun) / DAY : null,
            any: done.length > 0,
        };
    }

    // Paces in s/km from a 5K pace: threshold about 8% slower, intervals about 5K
    // pace, easy 30-40% slower (Daniels' tables, roughly). Null without a 5K.
    function paces(p5) {
        if (!p5) return null;
        return { easy: [round5(p5 * 1.28), round5(p5 * 1.42)], threshold: round5(p5 * 1.08), tempo: round5(p5 * 1.08 + 10), interval: round5(p5 * 0.99) };
    }

    // ─── Sessions, in the guided-run format (courses.js) ─────────────────────

    const seg = (type, minutes, role, say, extra = {}) => Object.assign({ type, duration: minutes, role, pace: null, label: extra.label || "", intensity: extra.intensity || "", say }, extra);

    function easySegments(minutes, runWalk, label = "Easy") {
        if (!runWalk) {
            return [seg("run", minutes, "easy", `${label} run, ${minutes} minutes. Slow enough to chat: effort 3 or 4 out of 10.`,
                { label, intensity: "Easy: you could chat" })];
        }
        // Run 4, walk 1: the run-walk that was as quick as running, with less soreness
        const out = [];
        let left = minutes, i = 0;
        while (left > 0) {
            const run = Math.min(4, left);
            out.push(seg("run", run, "easy", i === 0 ? `Run-walk, ${minutes} minutes. Run ${run} minutes, easy.` : `Run ${run} minutes, easy.`, { label: "Run easy", intensity: "Easy: you could chat" }));
            left -= run;
            if (left > 0) { const walk = Math.min(1, left); out.push(seg("walk", walk, "recover", "Walk for a minute.", { label: "Walk", intensity: "Walk" })); left -= walk; }
            i++;
        }
        return out;
    }

    function stridesSession(easyMin, runWalk) {
        const segs = easySegments(Math.max(10, easyMin - 8), runWalk);
        for (let i = 0; i < 6; i++) {
            segs.push(seg("stride", 20 / 60, "surge", i === 0 ? "Strides. 20 seconds quick and relaxed, not a sprint. Go!" : "Stride! Quick and relaxed.", { label: "Stride", intensity: "Quick and relaxed" }));
            segs.push(seg("jog", 1, "recover", "Walk or jog easy.", { label: "Easy", intensity: "Walk or jog" }));
        }
        segs.push(seg("cooldown", 2, "cooldown", "Easy for two minutes. Done.", { label: "Cool down", intensity: "Easy" }));
        return segs;
    }

    function repsSession(n, repMin, recMin, p, name, feelWords) {
        const segs = [seg("warmup", 10, "easy", `${name}. Warm up: 10 minutes easy.`, { label: "Warm up", intensity: "Easy" })];
        for (let i = 1; i <= n; i++) {
            const at = p ? ` at ${spoken(p)}` : "";
            segs.push(seg(name === "Intervals" ? "sprint" : "run", repMin, "cruise",
                `Rep ${i} of ${n}. ${repMin} minutes${at}. ${feelWords}.`,
                { label: `Rep ${i}`, intensity: p ? `${pace(p)} /km · ${feelWords.toLowerCase()}` : feelWords, pace: p || null }));
            if (i < n) segs.push(seg("jog", recMin, "recover", `Easy jog, ${recMin === 1 ? "a minute" : `${recMin} minutes`}.`, { label: "Easy", intensity: "Jog or walk" }));
        }
        segs.push(seg("cooldown", 5, "cooldown", "Cool down: five minutes easy. That's the work done.", { label: "Cool down", intensity: "Easy" }));
        return segs;
    }

    const minutesOf = (segs) => Math.round(segs.reduce((a, s) => a + s.duration, 0));

    function qualitySession(type, blockWeek, p, easyMin, runWalk, slower) {
        const k = blockWeek === 3 ? 0 : blockWeek; // the easier week repeats week one
        const heat = (x) => x && Math.round(x * (1 + slower) / 5) * 5;
        if (type === "strides") {
            const segs = stridesSession(easyMin, runWalk);
            return { title: "Easy run with strides", segs, about: `${minutesOf(segs)} min: easy, then six 20-second strides. Quick legs, no strain.`, why: "Strides keep speed in your legs at almost no cost." };
        }
        if (type === "cruise") {
            const n = 3 + k, t = heat(p && p.threshold);
            const segs = repsSession(n, 5, 1, t, "Cruise intervals", "Comfortably hard");
            return { title: `Cruise intervals: ${n} × 5 min`, segs, about: `${minutesOf(segs)} min: ${n} × 5 minutes ${t ? `at ${pace(t)} /km` : "comfortably hard (7 of 10)"}, a minute's jog between.`, why: "Threshold running: hard enough to raise the pace you can hold, easy enough to do every week." };
        }
        if (type === "tempo") {
            const m = 15 + 5 * k, t = heat(p && p.tempo);
            const segs = repsSession(1, m, 0, t, "Tempo", "Steady and strong");
            return { title: `Tempo: ${m} min`, segs, about: `${minutesOf(segs)} min: ${m} minutes ${t ? `at ${pace(t)} /km` : "steady and strong (6-7 of 10)"}.`, why: "Long steady running just under threshold, for the half." };
        }
        const n = 4 + k, i = heat(p && p.interval);
        const segs = repsSession(n, 3, 2, i, "Intervals", "Hard but even");
        return { title: `Intervals: ${n} × 3 min`, segs, about: `${minutesOf(segs)} min: ${n} × 3 minutes ${i ? `at ${pace(i)} /km` : "hard but even (8 of 10)"}, two minutes easy between.`, why: "Around 5K pace: the session that moves your 5K most." };
    }

    // ─── One day ─────────────────────────────────────────────────────────────

    // Week number since the plan began, the block, and where the race is
    function weekInfo(plan, monday) {
        const index = Math.max(0, Math.round((monday - plan.startedAt) / (7 * DAY)));
        let toRace = null;
        if (plan.raceDate) toRace = Math.round((wr().monday(plan.raceDate) - monday) / (7 * DAY));
        return { index, block: Math.floor(index / 4) + 1, blockWeek: index % 4, toRace: toRace != null && toRace >= 0 ? toRace : null };
    }

    // What `day` (a time on that day) holds: { kind: "run"|"gym"|"rest", role, title, about, why, minutes, session, notes[] }
    // ctx: { runs, now, p5, weather, feel, signals: { tired, drift, restingUp }, today: bool }
    function dayPlan(plan, day, ctx) {
        const R = wr();
        const monday = R.monday(day);
        const dow = (new Date(day).getDay() + 6) % 7;
        const days = weekDays(plan, monday);
        const role = roles(days.runDays, plan.goal)[dow];
        const gym = days.gymDays.includes(dow);
        const goal = GOALS[plan.goal] || GOALS.fitter;
        const w = weekInfo(plan, monday);
        const notes = [];
        const base = baseline(ctx.runs || [], Math.min(day, ctx.now));
        const runWalk = !!plan.runWalk;
        const sick = plan.sickUntil && plan.sickUntil > day;
        const isToday = !!ctx.today;

        // Volume: build, build, build, easier; then the taper
        let scale = w.blockWeek === 3 ? 0.8 : 1 + 0.05 * w.blockWeek;
        let blockText = w.blockWeek === 3 ? `Block ${w.block}, easier week` : `Block ${w.block}, week ${w.blockWeek + 1} of 3`;
        if (w.toRace === 2) { scale = 0.8; blockText = "Two weeks to race day: easing off"; }
        if (w.toRace === 1) { scale = 0.6; blockText = "Race week next: a lighter week"; }
        if (w.toRace === 0) { scale = 0.5; blockText = "Race week"; }

        const [lo, hi] = goal.easy;
        const typical = base.typicalMin || (base.any ? 25 : lo + 5);
        const easyMin = Math.round(Math.min(hi, Math.max(lo, typical * scale)) / 5) * 5;
        const p = paces(ctx.p5);
        const slower = ra().heatSlowdown(isToday ? ctx.weather : null);

        const raceToday = plan.raceDate && R.dayKey(plan.raceDate) === R.dayKey(day);
        if (raceToday) {
            return { kind: "run", role: "race", title: "Race day", about: "Start easy for the first kilometre, then settle in. Good luck!", why: "Everything this block built up to.", minutes: null, session: null, notes, blockText, gymToo: false };
        }
        if (w.toRace === 0 && role === "long") {
            // The race is this week's long run
            return { kind: "rest", title: "Rest", about: "The race is your long run this week.", why: "Fresh legs for race day.", notes, blockText };
        }

        if (role) {
            let kind = role === "quality2" ? "quality" : role;
            let out;
            const comeback = isToday && base.daysSinceRun != null && base.daysSinceRun >= COMEBACK_DAYS;
            if (sick) {
                const m = Math.min(20, Math.round(easyMin / 2 / 5) * 5 || 15);
                out = { title: `Short easy run, ${m} min`, segs: easySegments(m, true, "Easy"), about: `Only if your symptoms are all above the neck (a runny nose, a sore throat). Chest, aches or a fever: rest instead.`, why: "Running while unwell: easy and short, or not at all." };
                kind = "easy";
            } else if (comeback && kind !== "easy") {
                const m = Math.min(easyMin, 25);
                out = { title: `Easy run, ${m} min`, segs: easySegments(m, runWalk), about: `${m} minutes, slow enough to chat.`, why: `Your first run in ${Math.floor(base.daysSinceRun)} days: an easy one to get going again. The plan picks up from here.` };
                kind = "easy";
            } else if (kind === "quality" && isToday && (ctx.feel === "tired" || (ctx.signals && (ctx.signals.drift || ctx.signals.restingUp)))) {
                out = { title: `Easy run, ${easyMin} min`, segs: easySegments(easyMin, runWalk), about: `${easyMin} minutes, slow enough to chat.`, why: ctx.feel === "tired" ? "You said you're tired, so today's harder session is an easy run instead." : "Your weekly report saw signs of fatigue, so the harder session is easy this time." };
                kind = "easy";
            } else if (kind === "quality") {
                const list = goal.quality;
                const type = w.toRace != null && w.toRace <= 1 ? "strides" : list[(w.index + (role === "quality2" ? 1 : 0)) % list.length];
                out = qualitySession(type, w.blockWeek, p, easyMin, runWalk, slower);
                if (!p && type !== "strides") notes.push("Paces will come from your predicted 5K once you have a run of 1.5 km or more.");
                if (slower > 0.005) notes.push(`Paces are ${Math.round(slower * 100)}% easier for today's heat.`);
            } else if (kind === "long") {
                const easyPace = (p && (p.easy[0] + p.easy[1]) / 2) || (base.typicalPace ? base.typicalPace * 1.05 : 420);
                let km;
                if (base.longest30 >= 1000) {
                    // Never more than 10% past the longest run of the last 30 days
                    const grow = w.toRace != null && w.toRace <= 2 ? scale : w.blockWeek === 3 ? 0.85 : 1.08;
                    km = Math.min(goal.longCapKm, base.longest30 / 1000 * Math.min(grow, LONG_SPIKE));
                    km = Math.max(2, Math.floor(km * 2) / 2);
                }
                const m = km ? Math.round(km * easyPace / 60 / 5) * 5 : Math.round(Math.min(hi, (base.typicalMin || lo + 10) * 1.3) / 5) * 5;
                out = { title: km ? `Long run, about ${km} km` : `Long run, ${m} min`, segs: easySegments(m, runWalk, "Long"),
                    about: `${km ? `About ${m} minutes. ` : ""}Easy the whole way: slow enough to chat.`,
                    why: km ? `Your longest in the last 30 days is ${(base.longest30 / 1000).toFixed(1)} km. Runs more than 10% past that were the clearest injury signal in a study of 5,200 runners, so it grows a little at a time.` : "Time on your feet, easy. It turns into a distance once you have a few runs." };
            } else {
                out = { title: `Easy run, ${easyMin} min`, segs: easySegments(easyMin, runWalk), about: `${easyMin} minutes, slow enough to chat (3-4 out of 10).`, why: "Most of your running should feel easy. It's where the fitness is built." };
            }
            if (kind === "easy" && !sick) notes.push("Foot core (5 min) fits well after this one.");
            const session = { title: out.title, type: "plan", description: out.about, segments: out.segs, plan: { role: kind, day: R.dayKey(day) } };
            return { kind: "run", role: kind, title: out.title, about: out.about, why: out.why, minutes: minutesOf(out.segs), session, notes, blockText, gymToo: gym && !sick };
        }
        if (gym) {
            if (sick) return { kind: "rest", title: "Rest", about: "Strength can wait until you're better.", why: "Rest helps you get over it sooner.", notes, blockText };
            return { kind: "gym", title: "Strength", about: "Your next full-body workout.", why: "Two strength days a week: fewer injuries and better running economy.", notes, blockText };
        }
        return { kind: "rest", title: "Rest day", about: "Nothing planned. A walk is always good.", why: "Rest is when the training turns into fitness.", notes, blockText };
    }

    // ─── Done or not ─────────────────────────────────────────────────────────

    const sameDay = (a, b) => wr().dayKey(a) === wr().dayKey(b);

    // What you did on a day: { runs, gyms, extras }
    function doneOn(sessions, day) {
        const on = sessions.filter(s => s.endTime && sameDay(s.startTime, day));
        return {
            runs: on.filter(s => !s.activity), walks: on.filter(s => s.activity === "walk"),
            gyms: on.filter(s => s.activity === "strength" && !s.light), extras: on.filter(s => s.activity === "strength" && s.light),
        };
    }

    // The seven days of a week: [{ day, dow, name, plan, done }]
    function week(plan, monday, ctx) {
        const out = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(monday); d.setDate(d.getDate() + i); d.setHours(12);
            const t = d.getTime();
            out.push({ day: t, dow: i, name: DAY_NAMES[i], plan: dayPlan(plan, t, Object.assign({}, ctx, { today: sameDay(t, ctx.now) })), done: doneOn(ctx.runs || [], t) });
        }
        return out;
    }

    // Sessions planned in a week (runs + strength days)
    function weekTarget(plan, monday) {
        const d = weekDays(plan, monday);
        return d.runDays.length + d.gymDays.length;
    }

    // { done, target, keepAt, streak, freezes, kept } — weeks kept with at most one
    // session short; a missed week uses a freeze if you have one (one earned per
    // four kept weeks, two at most). Weeks marked "Ill or away" don't count.
    function streak(plan, sessions, now, paused = new Set()) {
        const R = wr();
        const thisMonday = R.monday(now);
        const count = (m) => sessions.filter(s => counts(s) && s.startTime >= m && s.startTime < R.addWeeks(m, 1)).length;
        let run = 0, freezes = 0, keptCount = 0;
        for (let m = R.monday(plan.startedAt); m < thisMonday; m = R.addWeeks(m, 1)) {
            if (paused.has(m)) continue;
            const target = weekTarget(plan, m);
            if (!target) continue;
            if (count(m) >= target - 1) {
                run++; keptCount++;
                if (keptCount % 4 === 0) freezes = Math.min(2, freezes + 1);
            } else if (freezes > 0) {
                freezes--;
            } else {
                run = 0;
            }
        }
        const target = weekTarget(plan, thisMonday), done = count(thisMonday);
        const kept = target > 0 && done >= target - 1;
        return { done, target, keepAt: Math.max(1, target - 1), streak: run + (kept ? 1 : 0), freezes, kept };
    }

    // True if the session at `t` is your first in WELCOME_BACK_DAYS or more
    function comeback(sessions, t) {
        const before = sessions.filter(s => counts(s) && s.startTime < t - 60000);
        if (!before.length) return false;
        const last = Math.max(...before.map(s => s.startTime));
        return t - last >= WELCOME_BACK_DAYS * DAY;
    }

    // Paces move only with your say-so: { faster | slower, p5, was } or null
    function paceSuggestion(plan, runs, now) {
        if (!plan.p5) return null;
        if (plan.p5SnoozeUntil && plan.p5SnoozeUntil > now) return null;
        const current = ra().fiveKPace(runs, now);
        if (!current) return null;
        const since = runs.filter(r => r.endTime && r.guided && r.guided.plan && r.guided.plan.role === "quality" && r.startTime > (plan.p5At || 0));
        if (current < plan.p5 * 0.98 && since.length >= 2) return { faster: true, p5: current, was: plan.p5 };
        if (current > plan.p5 * 1.05) return { slower: true, p5: current, was: plan.p5 };
        return null;
    }

    // When you usually start (minutes after midnight), from your last sessions; 18:00 if unknown
    function usualTime(sessions) {
        const ts = sessions.filter(counts).sort((a, b) => b.startTime - a.startTime).slice(0, 10)
            .map(s => { const d = new Date(s.startTime); return d.getHours() * 60 + d.getMinutes(); });
        const m = median(ts);
        return m == null ? 18 * 60 : Math.round(m / 15) * 15;
    }

    // The next planned session not yet done, from now on, with a reminder time: { at, title } or null
    function nextReminder(plan, ctx) {
        const minutes = usualTime(ctx.runs || []);
        for (let i = 0; i < 8; i++) {
            const d = new Date(ctx.now); d.setDate(d.getDate() + i); d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
            const at = d.getTime();
            if (at <= ctx.now) continue;
            const p = dayPlan(plan, at, Object.assign({}, ctx, { today: i === 0 }));
            if (p.kind === "rest") continue;
            const done = doneOn(ctx.runs || [], at);
            if ((p.kind === "run" && done.runs.length) || (p.kind === "gym" && done.gyms.length)) continue;
            return { at, title: p.kind === "gym" ? "Strength today" : p.title, text: p.about };
        }
        return null;
    }

    // An easy run on its own, for a day with nothing planned
    function easySession(minutes, runWalk, day) {
        return { title: `Easy run, ${minutes} min`, type: "plan", description: `${minutes} minutes, slow enough to chat.`, segments: easySegments(minutes, runWalk), plan: { role: "easy", day: wr().dayKey(day), extra: true } };
    }

    return {
        ID, GOALS, easySession, DAY_NAMES, LONG_SPIKE, defaults, gymDaysFor, weekDays, roles, baseline, paces,
        dayPlan, week, weekInfo, doneOn, weekTarget, streak, comeback, paceSuggestion, usualTime, nextReminder,
    };
})();

if (typeof module !== "undefined") module.exports = TrainingPlan;
