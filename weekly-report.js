// weekly-report.js — What a finished week adds up to. Pure, so tests.js loads it;
// weekly-report-ui.js shows it. reports/Weekly running performance report.md has
// the research and sources. What it comes down to:
//  - One week can't prove a change in fitness: with about 3 runs a week it takes
//    an 8% shift to see one, and real gains are 1-3%. So a week is counted and
//    compared with your own usual, and fitness is only ever judged between 4-week
//    blocks, every fourth report, in words that say how sure it is. "No clear
//    change" is the usual honest answer.
//  - No scores, no readiness, no injury risk, no status labels, no VO2max, no
//    streaks: none of them hold up for one person with a cheap watch.
//  - Load is how hard x how long (Foster's session RPE). The one caution about
//    load is a run much longer than anything in the last 30 days (Frandsen 2025).
//  - At most one observation a week, the first of RULES to apply. Those that infer
//    something need it to last or be backed up, since six signals checked weekly
//    would otherwise raise a false alarm most weeks.
//  - Every threshold is a starting point, not a finding about you.

const WeeklyReport = (() => {
    const VERSION = 1;
    const DAY_MS = 86400000;
    const MIN_LOGGED_DAYS = 2;
    const BLOCK_WEEKS = 4;
    const LONG_RATIO = 1.1, BIG_JUMP = 2, LONG_EXCESS_M = 500;
    const USUAL_BAND = 0.15, HIGH_LOAD = 0.3;
    const BRISK_SPM = 100;
    // Assumed noise until there's a history to measure it from
    const PACE_SIGMA = 0.05, PACE_HR_SIGMA = 0.04;
    const PAIN = /\b(pain\w*|sore\w*|niggl\w*|hurt\w*|ache\w*|aching|injur\w*|twinge\w*|tweak\w*|strain\w*|shin ?splints?)\b/i;
    const NO_PAIN = /\b(no|not|without|zero|any)\s+(\w+\s+)?(pain\w*|sore\w*|niggl\w*|hurt\w*|ache\w*|aching|injur\w*|twinge\w*|tweak\w*|strain\w*)/i;

    const ra = () => typeof RunAnalysis !== "undefined" ? RunAnalysis : require("./analysis.js");
    const sp = () => typeof StrengthPlanner !== "undefined" ? StrengthPlanner : require("./strength-plan.js");

    // ─── Time ────────────────────────────────────────────────────────────────

    function monday(t) {
        const d = new Date(t);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - (d.getDay() + 6) % 7);
        return d.getTime();
    }

    // Not n x 7 days: a week with a clock change is an hour longer or shorter
    function addWeeks(t, n) {
        const d = new Date(t);
        d.setDate(d.getDate() + 7 * n);
        return d.getTime();
    }

    function dayKey(t) {
        const d = new Date(t);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }

    // ─── Small statistics ────────────────────────────────────────────────────

    function median(xs) {
        if (!xs.length) return null;
        const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
        return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    }

    const mean = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

    // y = a + b x by least squares; null if x doesn't vary
    function fitLine(points) {
        const mx = mean(points.map(p => p[0])), my = mean(points.map(p => p[1]));
        const sxx = points.reduce((s, p) => s + (p[0] - mx) ** 2, 0);
        if (!(sxx > 0)) return null;
        const b = points.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0) / sxx;
        return { a: my - b * mx, b };
    }

    // How sure a change between two blocks is, from the medians of n1 and n2
    // measurements with noise sigma: 0 no clear change, 1 probably, 2 clearly.
    function tier(change, n1, n2, sigma) {
        const se = 1.25 * sigma * Math.sqrt(1 / n1 + 1 / n2);
        const size = Math.abs(change) / se;
        return size >= 2 ? 2 : size >= 1.4 ? 1 : 0;
    }

    // ─── One session ─────────────────────────────────────────────────────────

    const isRun = (s) => !s.activity;
    const minutes = (s) => (s.time || 0) / 60;
    const load = (s) => s.rpe > 0 ? s.rpe * minutes(s) : 0;

    // Minutes of a walk at 100 steps a minute or more, a minute at a time, so a
    // traffic light costs one minute and not the walk. `steps`: [[ms, steps so far]].
    function briskMinutes(walk) {
        const st = walk.steps;
        if (!st || st.length < 2) return 0;
        let brisk = 0, i = 0;
        for (let j = 1; j < st.length; j++) {
            const dt = st[j][0] - st[i][0];
            if (dt < 60000) continue;
            if ((st[j][1] - st[i][1]) * 60000 / dt >= BRISK_SPM) brisk += dt / 60000;
            i = j;
        }
        return brisk;
    }

    // As if flat and cool (m/s)
    function adjustedSpeed(run) {
        return run.distance * ra().hillFactor(run) / run.time * (1 + ra().heatSlowdown(run.weather));
    }

    // An ordinary run at an even effort: the only kind worth comparing with each other
    function steady(run) {
        if (!isRun(run) || run.guided || run.ghost || !(run.time >= 1200) || !(run.distance >= 1500)) return false;
        if (run.pace < ra().MIN_PACE || run.pace > 900) return false;
        if (run.weather && run.weather.windKmh >= 18) return false;
        const series = ra().seriesForRun(run);
        const splits = ra().kmSplits(series, run.distance, run.time * 1000).filter(s => !s.partial).map(s => s.paceSec);
        if (splits.length < 3) return true;
        const m = mean(splits);
        return Math.sqrt(mean(splits.map(x => (x - m) ** 2))) / m <= 0.08;
    }

    // A run's heart rate with the wrist sensor's nonsense taken out: its median, or
    // null unless samples cover 60% of its five-minute stretches
    function cleanHeartRate(run, rest) {
        const samples = run.hr && run.hr.samples;
        if (!samples || !samples.length) return null;
        const good = samples.filter(([, bpm]) => bpm >= (rest || 50) + 20 && bpm <= 220);
        const bins = new Set(good.map(([t]) => Math.floor(t / 300000)));
        const total = Math.max(1, Math.ceil((run.endTime - run.startTime) / 300000));
        return bins.size / total >= 0.6 ? median(good.map(s => s[1])) : null;
    }

    // ─── A week ──────────────────────────────────────────────────────────────

    function tally(sessions, start) {
        const end = addWeeks(start, 1);
        const inWeek = sessions.filter(s => s.startTime >= start && s.startTime < end);
        const runs = inWeek.filter(isRun);
        const walks = inWeek.filter(s => s.activity === "walk");
        const gyms = inWeek.filter(s => s.activity === "strength");
        const rated = runs.filter(r => r.rpe > 0);
        const patterns = {};
        gyms.forEach(g => (g.exercises || []).forEach(e => {
            const p = sp().patternOf(e.id);
            patterns[p] = (patterns[p] || 0) + e.sets.length;
        }));
        return {
            start, end, sessions: inWeek, runs, walks, gyms, patterns,
            days: new Set(inWeek.map(s => dayKey(s.startTime))).size,
            km: runs.reduce((a, r) => a + r.distance, 0) / 1000,
            runMin: runs.reduce((a, r) => a + minutes(r), 0),
            load: runs.reduce((a, r) => a + load(r), 0),
            ratedRuns: rated.length,
            ratedMin: rated.reduce((a, r) => a + minutes(r), 0),
            moderate: rated.filter(r => r.rpe >= 5 && r.rpe <= 6).length,
            walkMin: walks.reduce((a, r) => a + minutes(r), 0),
            walkKm: walks.reduce((a, r) => a + r.distance, 0) / 1000,
            briskMin: walks.reduce((a, r) => a + briskMinutes(r), 0),
            strengthDays: new Set(gyms.map(g => dayKey(g.startTime))).size,
            tired: inWeek.filter(s => s.feel === "tired").length,
        };
    }

    const valid = (t, paused) => t.days >= MIN_LOGGED_DAYS && !paused.has(t.start);

    // Up to the last four normal weeks before this one; it never counts towards its own usual
    function usualWeeks(sessions, start, paused) {
        const out = [];
        for (let i = 1; i <= 12 && out.length < BLOCK_WEEKS; i++) {
            const t = tally(sessions, addWeeks(start, -i));
            if (valid(t, paused)) out.push(t);
        }
        return out;
    }

    // ─── Signals ─────────────────────────────────────────────────────────────

    // The longest run before `t`, over the last 30 days
    function longestBefore(sessions, t) {
        return Math.max(0, ...sessions.filter(s => isRun(s) && s.startTime < t && s.startTime >= t - 30 * DAY_MS).map(s => s.distance));
    }

    // The run of the week that went furthest past what came before it
    function longRun(week, sessions) {
        let top = null;
        week.runs.forEach(r => {
            const before = longestBefore(sessions, r.startTime);
            if (!before || r.distance - before < LONG_EXCESS_M) return;
            const ratio = r.distance / before;
            if (ratio > LONG_RATIO && (!top || ratio > top.ratio)) top = { run: r, before, ratio };
        });
        return top;
    }

    // Did the last two weeks' steady runs feel harder than their pace says they
    // should? Expected effort comes from the 10 weeks before them. Needs no heart
    // rate. Returns the median difference in points of RPE, or null.
    function effortDrift(sessions, end) {
        const rated = sessions.filter(s => s.rpe > 0 && s.startTime < end && steady(s));
        const split = end - 14 * DAY_MS;
        const past = rated.filter(s => s.startTime < split && s.startTime >= end - 84 * DAY_MS);
        const recent = rated.filter(s => s.startTime >= split);
        if (past.length < 10 || recent.length < 3) return null;
        const line = fitLine(past.map(s => [Math.log(adjustedSpeed(s)), s.rpe]));
        if (!line || !(line.b > 0)) return null; // quicker isn't feeling harder: nothing to go on
        const halfway = end - 7 * DAY_MS;
        if (!recent.some(s => s.startTime < halfway) || !recent.some(s => s.startTime >= halfway)) return null;
        return { drift: median(recent.map(s => s.rpe - (line.a + line.b * Math.log(adjustedSpeed(s))))), n: recent.length };
    }

    // One value a day: { day: bpm }
    function restingByDay(resting) {
        const days = new Map();
        (resting || []).forEach(([t, bpm]) => { const k = dayKey(t); days.set(k, (days.get(k) || []).concat(bpm)); });
        return new Map([...days].map(([k, v]) => [k, median(v)]));
    }

    const daysBack = (end, from, to) => {
        const out = [];
        for (let i = from; i < to; i++) out.push(dayKey(end - (i + 0.5) * DAY_MS));
        return out;
    };

    // Against the four weeks before: { rise: 3 of the last 5 days unusually high, shift, n }
    function restingHeartRate(resting, end) {
        const by = restingByDay(resting);
        const pick = (keys) => keys.filter(k => by.has(k)).map(k => by.get(k));
        const base = pick(daysBack(end, 7, 35));
        const week = pick(daysBack(end, 0, 7));
        if (base.length < 14) return { n: week.length, known: false };
        const usual = median(base);
        const spread = Math.max(2, median(base.map(x => Math.abs(x - usual))) * 1.4826);
        const high = pick(daysBack(end, 0, 5)).filter(x => x > usual + 2 * spread).length;
        return {
            known: true, n: week.length, usual, week: median(week), rise: high >= 3,
            shift: week.length >= 5 ? median(week) - usual : null,
        };
    }

    // Each morning's sleep in minutes, naps added to the day they ended on
    function sleepByDay(sleep) {
        const days = new Map();
        (sleep || []).forEach(([a, b]) => { const k = dayKey(b); days.set(k, (days.get(k) || 0) + (b - a) / 60000); });
        return days;
    }

    function sleepSummary(sleep, end) {
        const by = sleepByDay(sleep);
        const pick = (keys) => keys.filter(k => by.has(k)).map(k => by.get(k));
        const week = pick(daysBack(end, 0, 7)), base = pick(daysBack(end, 7, 35));
        const known = week.length >= 5 && base.length >= 14;
        return { n: week.length, known, week: median(week), usual: median(base), change: known ? median(week) - median(base) : null };
    }

    // ─── Went well ───────────────────────────────────────────────────────────

    function wentWell(week, sessions, usual) {
        const before = sessions.filter(s => s.startTime < week.start);
        // A step up the ladder: reps drop when you move up, so this is the one to celebrate
        for (const g of week.gyms) {
            for (const e of g.exercises || []) {
                if (e.level == null) continue;
                const past = before.filter(s => s.activity === "strength").flatMap(s => (s.exercises || []).filter(x => x.id === e.id && x.level != null));
                if (past.length && e.level > Math.max(...past.map(x => x.level))) return `You moved up to ${e.variation}.`;
            }
        }
        for (const km of [10, 5, 3, 1]) {
            const best = (list) => Math.min(Infinity, ...list.filter(isRun)
                .map(r => ra().runBestEffort(r, km * 1000)).filter(e => e && e.timeMs / 1000 / km >= ra().MIN_PACE).map(e => e.timeMs));
            const old = best(before), now = best(week.runs);
            if (old < Infinity && now < old) return `A new ${km}K best: ${clock(now / 1000)}.`;
        }
        const longest = Math.max(0, ...week.runs.map(r => r.distance));
        const earlier = before.filter(isRun).map(r => r.distance);
        if (longest >= 3000 && earlier.length >= 5 && longest > Math.max(...earlier)) return `Your longest run yet: ${(longest / 1000).toFixed(1)} km.`;
        for (const g of week.gyms) {
            for (const e of g.exercises || []) {
                const name = e.variation || e.name;
                const past = before.filter(s => s.activity === "strength").flatMap(s => (s.exercises || []).filter(x => x.id === e.id && (x.variation || x.name) === name));
                if (!past.length || !e.sets.length) continue;
                const top = Math.max(...e.sets.map(s => s.reps));
                if (top > Math.max(...past.flatMap(x => x.sets.map(s => s.reps)))) {
                    return `Your best set of ${name} yet: ${top}${e.unit === "s" ? " seconds" : " reps"}.`;
                }
            }
        }
        if (usual.length >= 3 && week.walkMin > Math.max(30, ...usual.map(u => u.walkMin))) return `Your most walking in weeks: ${Math.round(week.walkMin)} minutes.`;
        return null;
    }

    // ─── What to say ─────────────────────────────────────────────────────────

    function clock(seconds) {
        const s = Math.round(seconds);
        return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    }

    const weekday = (t) => new Date(t).toLocaleDateString(undefined, { weekday: "long" });
    const plural = (n, one) => `${n} ${one}${n === 1 ? "" : "s"}`;

    function duration(min) {
        const m = Math.round(min);
        return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
    }

    const sleepText = (min) => { const q = Math.round(min / 15) * 15; return `${Math.floor(q / 60)} h ${String(q % 60).padStart(2, "0")}`; };

    function mentionedPain(week) {
        for (const s of week.sessions) {
            const note = s.note || "";
            if (PAIN.test(note) && !NO_PAIN.test(note)) return s;
        }
        return null;
    }

    function patternGone(week, sessions) {
        const seen = (t) => new Set(Object.keys(t.patterns));
        const recent = [0, -1, -2].map(i => tally(sessions, addWeeks(week.start, i)));
        if (!recent[0].gyms.length) return null; // no gym at all is a different matter
        const now = new Set(recent.flatMap(t => [...seen(t)]));
        for (let i = 3; i < 12; i++) {
            for (const p of seen(tally(sessions, addWeeks(week.start, -i)))) {
                if (p !== "other" && !now.has(p)) return p;
            }
        }
        return null;
    }

    // In order: the first that applies is the week's one observation.
    // { why } says what it's based on, for the "why" under it.
    const RULES = [
        (c) => {
            const s = mentionedPain(c.week);
            return s && {
                rule: "pain", text: `You wrote this on ${weekday(s.startTime)}: "${s.note.slice(0, 120)}"`,
                next: "Easy or short runs until it settles, and see someone if it stays.", why: "From your notes this week.",
            };
        },
        (c) => c.rhr.rise && (c.week.tired > 0 || (c.effort && c.effort.drift >= 1)) && {
            rule: "rest-and-feel", text: `Your resting heart rate has been up for several days, and you've felt it too. Common causes: illness, poor sleep, alcohol, heat, travel.`,
            next: "A light week would fit, or tap \"Ill or away\" to leave this week out.",
            why: `Resting heart rate ${Math.round(c.rhr.week)} bpm against your usual ${Math.round(c.rhr.usual)}.`,
        },
        (c) => c.long && {
            rule: "long-run",
            text: c.long.ratio > BIG_JUMP
                ? `${weekday(c.long.run.startTime)}'s ${(c.long.run.distance / 1000).toFixed(1)} km was a big jump: about double anything in the 30 days before. Most runs like this are fine.`
                : `${weekday(c.long.run.startTime)}'s ${(c.long.run.distance / 1000).toFixed(1)} km was your longest in 30 days, by ${Math.round((c.long.ratio - 1) * 100)}%. Most runs like this are fine.`,
            next: `You could hold your long run near ${(c.long.run.distance / 1000).toFixed(0)} km for a week or two.`,
            why: `Longest in the 30 days before: ${(c.long.before / 1000).toFixed(1)} km. Runs more than 10% past that were linked with a higher chance of overuse injury in a study of 5,205 runners, though most injuries came with no jump at all.`,
        },
        (c) => c.effort && c.effort.drift >= 1 && {
            rule: "effort", text: `Runs have felt about ${c.effort.drift >= 1.5 ? "two points" : "a point"} harder than usual at the same pace, for two weeks.`,
            next: "One easier week could help, or look at sleep and heat.",
            why: `From ${plural(c.effort.n, "steady run")}, with hills and heat allowed for.`,
        },
        (c) => (c.rhr.rise || c.rhr.shift >= 3) && {
            rule: "rest-alone", text: `Your resting heart rate is about ${Math.round(c.rhr.week - c.rhr.usual)} bpm above usual, and nothing else has changed. It may mean nothing.`,
            next: "Nothing to change. Just notice how you feel.",
            why: `${Math.round(c.rhr.week)} bpm this week against ${Math.round(c.rhr.usual)} over the four weeks before.`,
        },
        (c) => c.sleep.known && c.sleep.change <= -45 && {
            rule: "sleep", text: `You've slept about ${sleepText(-c.sleep.change)} less a night than usual.`,
            next: "Nothing to change in your training. It may explain how the week felt.",
            why: `A typical night was ${sleepText(c.sleep.week)} against ${sleepText(c.sleep.usual)}. Watches are rough at this, so it's the week that counts, never one night.`,
        },
        (c) => {
            if (c.usual.length < 3) return null;
            const mean4 = mean(c.usual.map(c.measure));
            const change = c.measure(c.week) / mean4 - 1;
            return mean4 > 0 && change > HIGH_LOAD && {
                rule: "load", text: `This week's running was ${Math.round(change * 100)}% above your usual.`,
                next: c.week.tired ? "Since you felt tired, an easier week could fit." : null,
                why: `Compared with the mean of your last ${plural(c.usual.length, "normal week")}.`,
            };
        },
        (c) => {
            const weeks = [0, -1, -2].map(i => tally(c.sessions, addWeeks(c.week.start, i)));
            return weeks.every(t => t.ratedRuns >= 3 && t.moderate / t.ratedRuns >= 0.75) && {
                rule: "all-moderate", text: "Most of your runs have landed at 5 or 6 for three weeks.",
                next: "You could try making one run clearly easy.", why: "From your \"How hard was that?\" ratings.",
            };
        },
        (c) => {
            const gymBefore = [1, 2, 3, 4, 5, 6, 7, 8].some(i => tally(c.sessions, addWeeks(c.week.start, -i)).gyms.length);
            if (c.week.strengthDays < 2 && (c.week.gyms.length || gymBefore)) {
                return {
                    rule: "strength", text: c.week.strengthDays ? "One strength day this week." : "No strength days this week.",
                    next: "Two a week is the usual guide: Tuesday and Friday, say.", why: "WHO suggests muscle strengthening on 2 or more days a week.",
                };
            }
            const gone = patternGone(c.week, c.sessions);
            return gone && {
                rule: "pattern", text: `Nothing for ${sp().PATTERN_NAMES[gone]} in three weeks.`,
                next: "You could add one exercise for it, or leave it if you meant to drop it.", why: "From your workouts.",
            };
        },
    ];

    // ─── Every fourth report: the only place fitness gets judged ─────────────

    const inBlock = (sessions, end, weeks) => sessions.filter(s => s.startTime < addWeeks(end, weeks) && s.startTime >= addWeeks(end, weeks - BLOCK_WEEKS));

    function blockChange(sessions, end, measure, sigma) {
        const take = (list) => list.filter(steady).map(measure).filter(x => x != null);
        const now = take(inBlock(sessions, end, 0)), before = take(inBlock(sessions, end, -BLOCK_WEEKS));
        if (now.length < 6 || before.length < 6) return { n: Math.min(now.length, before.length), level: null };
        const change = Math.log(median(now) / median(before));
        return { n: now.length, change, level: tier(change, now.length, before.length, sigma) };
    }

    // In words, and only "clearly" if last week's comparison says the same
    function sureness(sessions, end, measure, sigma, what, up, down) {
        const b = blockChange(sessions, end, measure, sigma);
        if (b.level == null) return { label: what, text: "Not enough steady runs yet to compare" };
        if (b.level === 0) return { label: what, text: `No clear change (${plural(b.n, "run")})` };
        const last = blockChange(sessions, addWeeks(end, -1), measure, sigma);
        const sure = b.level === 2 && last.level === 2 && Math.sign(last.change) === Math.sign(b.change);
        return { label: what, text: `${sure ? "Clearly" : "Probably"} ${b.change > 0 ? up : down}, about ${Math.round(Math.abs(b.change) * 100)}% (${plural(b.n, "run")})` };
    }

    function ladderLine(sessions, end) {
        const levels = new Map();
        sessions.filter(s => s.activity === "strength" && s.startTime < end).sort((a, b) => a.startTime - b.startTime)
            .forEach(s => (s.exercises || []).forEach(e => {
                if (e.level == null || !e.levels) return;
                const was = levels.get(e.id);
                levels.set(e.id, { name: e.name, variation: e.variation, level: e.level, of: e.levels, first: was && s.startTime >= addWeeks(end, -BLOCK_WEEKS) ? was.first : e.level, at: s.startTime });
            }));
        return [...levels.values()].filter(l => l.at >= addWeeks(end, -8)).map(l => ({
            label: l.name, text: `${l.variation}, step ${l.level + 1} of ${l.of}${l.level > l.first ? " (moved up)" : ""}`,
        }));
    }

    function review(c) {
        const end = c.week.end;
        const rest = c.rhr.known ? c.rhr.usual : null;
        const rows = [
            sureness(c.sessions, end, adjustedSpeed, PACE_SIGMA, "Steady-run pace", "quicker", "slower"),
            sureness(c.sessions, end, (r) => {
                const hr = cleanHeartRate(r, rest);
                return hr ? adjustedSpeed(r) / (rest ? hr - rest : hr) : null;
            }, PACE_HR_SIGMA, "Pace for your heart rate", "better", "lower"),
            ...ladderLine(c.sessions, end),
        ];
        if (c.rhr.known) rows.push({ label: "Resting heart rate", text: `${Math.round(c.rhr.week != null ? c.rhr.week : c.rhr.usual)} bpm (usually ${Math.round(c.rhr.usual)})` });
        if (c.sleep.known) rows.push({ label: "Typical night", text: `${sleepText(c.sleep.week)} (usually ${sleepText(c.sleep.usual)})` });
        return rows;
    }

    // Weeks are numbered from a fixed Monday, so every fourth one is a block review
    const isBlockWeek = (start) => Math.round((start - monday(0)) / (7 * DAY_MS)) % BLOCK_WEEKS === 0;

    // ─── The report ──────────────────────────────────────────────────────────

    function numbers(week, usual, useLoad) {
        const row = (label, value, of, text) => {
            const usualValue = usual.length >= 3 ? mean(usual.map(of)) : null;
            const close = usualValue != null && usualValue > 0 && Math.abs(value / usualValue - 1) <= USUAL_BAND;
            return { label, value: text(value), usual: usualValue == null ? null : text(usualValue), close };
        };
        const whole = (x) => String(Math.round(x));
        const rows = [row("Run km", week.km, t => t.km, x => x.toFixed(1))];
        rows.push(useLoad
            ? Object.assign(row("Run load", week.load, t => t.load, x => (Math.round(x / 10) * 10).toLocaleString()), { note: `how hard × minutes · ${week.ratedRuns} of ${plural(week.runs.length, "run")} rated` })
            : row("Run minutes", week.runMin, t => t.runMin, whole));
        rows.push(row("Strength days", week.strengthDays, t => t.strengthDays, x => usual.length && x % 1 ? x.toFixed(1) : whole(x)));
        rows.push(Object.assign(row("Walk minutes", week.walkMin, t => t.walkMin, whole),
            week.briskMin >= 1 ? { note: `${Math.round(week.briskMin)} brisk` } : {}));
        return rows;
    }

    // Active weeks in the last 8: a measure that a bad week dents and can't wipe out
    function consistency(sessions, start, paused) {
        let active = 0, counted = 0;
        for (let i = 0; i < 8; i++) {
            const w = addWeeks(start, -i);
            if (paused.has(w)) continue;
            counted++;
            if (tally(sessions, w).sessions.length) active++;
        }
        return { active, counted };
    }

    function summary(w) {
        const parts = [];
        if (w.runs.length) parts.push(plural(w.runs.length, "run"));
        if (w.strengthDays) parts.push(plural(w.strengthDays, "strength day"));
        if (w.walks.length) parts.push(plural(w.walks.length, "walk"));
        const total = w.sessions.reduce((a, s) => a + minutes(s), 0);
        const km = w.km + w.walkKm;
        return `${parts.join(", ")}. ${km >= 0.05 ? `${km.toFixed(1)} km, ` : ""}${duration(total)} in total.`;
    }

    // sessions: finished records from the runs store. health: { sleep, resting } or
    // null. paused: Mondays you marked as ill or away. Everything is about the week
    // starting `start`; nothing after it is looked at.
    function build({ sessions, start, health = null, paused = new Set() }) {
        const end = addWeeks(start, 1);
        const known = sessions.filter(s => s.endTime && s.startTime < end);
        const week = tally(known, start);
        const usual = usualWeeks(known, start, paused);
        const base = { v: VERSION, weekStart: start, weekEnd: end, paused: paused.has(start) };
        const sleep = sleepSummary(health && health.sleep, end);
        const rhr = restingHeartRate(health && health.resting, end);
        const source = {
            sleepNights: sleep.n, restingDays: rhr.n,
            runsWithHr: week.runs.filter(r => r.hr && r.hr.samples && r.hr.samples.length).length, runs: week.runs.length,
            watch: !!health,
        };
        if (!week.sessions.length) return Object.assign(base, { light: true, line: "Nothing logged this week. It happens.", source });
        if (base.paused) return Object.assign(base, { light: true, line: `${summary(week)} Left out of your comparisons, as you asked.`, source });
        if (week.days < MIN_LOGGED_DAYS) return Object.assign(base, { light: true, line: `A light week. ${summary(week)}`, source });

        // Load needs the ratings: without most of them it would mostly measure how often you tapped
        const rated = (t) => t.runMin > 0 && t.ratedMin >= 0.75 * t.runMin;
        const useLoad = rated(week) && (usual.length < 3 || usual.every(rated));
        const context = {
            week, usual, sessions: known, paused, sleep, rhr,
            measure: useLoad ? (t) => t.load : (t) => t.runMin,
            long: longRun(week, known), effort: effortDrift(known, end),
        };
        let observation = null;
        for (const rule of RULES) { observation = rule(context) || null; if (observation) break; }

        const longest = longestBefore(known, end);
        const active = consistency(known, start, paused);
        const adjusted = week.briskMin + 2 * week.runMin;
        return Object.assign(base, {
            light: false, line: summary(week), wentWell: wentWell(week, known, usual),
            rows: numbers(week, usual, useLoad), active,
            observation, longest: longest >= 1000 ? { km: longest / 1000, top: longest * LONG_RATIO / 1000 } : null,
            activeMinutes: Math.round(adjusted), review: isBlockWeek(start) ? review(context) : null, source,
        });
    }

    return { VERSION, monday, addWeeks, dayKey, median, tier, tally, load, briskMinutes, steady, cleanHeartRate, longRun, effortDrift, restingHeartRate, sleepSummary, consistency, isBlockWeek, build };
})();

if (typeof module !== "undefined") module.exports = WeeklyReport;
