// stats.js — What the Stats tab shows, worked out from your sessions. Pure, so
// tests.js loads it; stats-ui.js draws it. Every number comes from your own runs,
// workouts and walks; nothing is compared with anyone else except fitness age.
// Patterns ("mornings are quicker") are only shown with enough runs behind them,
// and always say how many.

const Stats = (() => {
    const DAY = 86400000;
    const ra = () => typeof RunAnalysis !== "undefined" ? RunAnalysis : require("./analysis.js");
    const wr = () => typeof WeeklyReport !== "undefined" ? WeeklyReport : require("./weekly-report.js");
    const sp = () => typeof StrengthPlanner !== "undefined" ? StrengthPlanner : require("./strength-plan.js");

    const isRun = (s) => s.endTime && !s.activity;
    const isGym = (s) => s.endTime && s.activity === "strength" && !s.light;
    const isWalk = (s) => s.endTime && s.activity === "walk";
    const median = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
    const sum = (xs) => xs.reduce((a, b) => a + b, 0);
    const minutesOfDay = (t) => { const d = new Date(t); return d.getHours() * 60 + d.getMinutes(); };

    // ─── Periods ─────────────────────────────────────────────────────────────

    const PERIODS = { "4w": { label: "4 weeks", days: 28 }, "3m": { label: "3 months", days: 91 }, "1y": { label: "Year", days: 364 } };

    // This period and the one before it, ending now
    function range(period, now = Date.now()) {
        const days = (PERIODS[period] || PERIODS["4w"]).days;
        const end = now, start = now - days * DAY;
        return { start, end, prevStart: start - days * DAY, days };
    }

    const within = (s, a, b) => s.startTime >= a && s.startTime < b;

    function totals(sessions, a, b) {
        const runs = sessions.filter(s => isRun(s) && within(s, a, b));
        const gyms = sessions.filter(s => isGym(s) && within(s, a, b));
        const walks = sessions.filter(s => isWalk(s) && within(s, a, b));
        return {
            runs: runs.length, km: sum(runs.map(r => r.distance)) / 1000, runMin: sum(runs.map(r => r.time)) / 60,
            workouts: gyms.length, walks: walks.length, walkKm: sum(walks.map(r => r.distance)) / 1000,
            hours: sum(runs.concat(gyms, walks).map(r => r.time || 0)) / 3600,
        };
    }

    // The headline cards: this period against the one before
    function headline(sessions, period, now = Date.now()) {
        const r = range(period, now);
        const cur = totals(sessions, r.start, r.end), prev = totals(sessions, r.prevStart, r.start);
        const change = (a, b) => b > 0 ? Math.round((a / b - 1) * 100) : null;
        return { cur, prev, km: change(cur.km, prev.km), runs: change(cur.runs, prev.runs), workouts: change(cur.workouts, prev.workouts), hours: change(cur.hours, prev.hours) };
    }

    // ─── Activity calendar ───────────────────────────────────────────────────

    // Weeks (Monday first) of days back to a year ago: [[{ key, t, runs, gyms, walks, km, future }]]
    function calendar(sessions, now = Date.now(), weeks = 53) {
        const W = wr();
        const byDay = new Map();
        sessions.filter(s => s.endTime && !(s.activity === "strength" && s.light)).forEach(s => {
            const k = W.dayKey(s.startTime);
            const d = byDay.get(k) || { runs: 0, gyms: 0, walks: 0, km: 0 };
            if (isRun(s)) { d.runs++; d.km += s.distance / 1000; } else if (isGym(s)) d.gyms++; else if (isWalk(s)) d.walks++;
            byDay.set(k, d);
        });
        const first = W.addWeeks(W.monday(now), -(weeks - 1));
        const out = [];
        for (let w = 0; w < weeks; w++) {
            const col = [];
            for (let i = 0; i < 7; i++) {
                const d = new Date(W.addWeeks(first, w)); d.setDate(d.getDate() + i); d.setHours(12);
                const k = W.dayKey(d.getTime());
                col.push(Object.assign({ key: k, t: d.getTime(), future: d.getTime() > now }, byDay.get(k) || { runs: 0, gyms: 0, walks: 0, km: 0 }));
            }
            out.push(col);
        }
        return out;
    }

    // Days in a row with something done: { longest, current, from }
    function dayStreaks(sessions, now = Date.now()) {
        const W = wr();
        const days = [...new Set(sessions.filter(s => isRun(s) || isGym(s) || isWalk(s)).map(s => W.dayKey(s.startTime)))].sort();
        const noon = (k) => new Date(k + "T12:00").getTime();
        let longest = 0, from = null, run = 0, runFrom = null;
        days.forEach((k, i) => {
            run = i && Math.round((noon(k) - noon(days[i - 1])) / DAY) === 1 ? run + 1 : 1;
            if (run === 1) runFrom = k;
            if (run > longest) { longest = run; from = runFrom; }
        });
        const today = W.dayKey(now), yesterday = W.dayKey(now - DAY);
        const last = days[days.length - 1];
        return { longest, from, current: last === today || last === yesterday ? run : 0 };
    }

    // ─── Records ─────────────────────────────────────────────────────────────

    // [{ key, label, value, runId, at }] — each links to its run where there is one
    function records(sessions, now = Date.now()) {
        const R = ra(), W = wr();
        const runs = sessions.filter(isRun);
        const out = [];
        const add = (key, label, value, run) => out.push({ key, label, value, runId: run ? run.runId : null, at: run ? run.startTime : null });
        const top = (list, f) => list.reduce((best, r) => (f(r) != null && (!best || f(r) > f(best))) ? r : best, null);
        if (!runs.length) return out;

        const longest = top(runs, r => r.distance);
        add("longest", "Longest run", `${(longest.distance / 1000).toFixed(1)} km`, longest);

        const weeks = new Map();
        runs.forEach(r => { const m = W.monday(r.startTime); weeks.set(m, (weeks.get(m) || []).concat(r)); });
        let bestWeek = null;
        weeks.forEach((list, m) => { const km = sum(list.map(r => r.distance)) / 1000; if (!bestWeek || km > bestWeek.km) bestWeek = { m, km, list }; });
        add("week", "Biggest week", `${bestWeek.km.toFixed(1)} km`, top(bestWeek.list, r => r.distance));

        // Fastest whole kilometre split, ignoring car-speed nonsense
        let fast = null;
        runs.forEach(r => {
            R.kmSplits(R.seriesForRun(r), r.distance, r.time * 1000).filter(s => !s.partial && s.paceSec >= R.MIN_PACE)
                .forEach(s => { if (!fast || s.paceSec < fast.pace) fast = { pace: s.paceSec, run: r }; });
        });
        if (fast) add("km", "Fastest km", `${clock(fast.pace)} /km`, fast.run);

        const climb = top(runs.filter(r => r.elevation && r.elevation.gain > 0), r => r.elevation.gain);
        if (climb) add("climb", "Most climbing", `${climb.elevation.gain} m`, climb);

        const hot = top(runs.filter(r => r.weather && (r.weather.feelsC != null || r.weather.tempC != null) && r.distance >= 2000), r => r.weather.feelsC != null ? r.weather.feelsC : r.weather.tempC);
        if (hot) add("hot", "Hottest run", `${Math.round(hot.weather.feelsC != null ? hot.weather.feelsC : hot.weather.tempC)}°C feels-like`, hot);

        const early = runs.reduce((best, r) => !best || minutesOfDay(r.startTime) < minutesOfDay(best.startTime) ? r : best, null);
        const m = minutesOfDay(early.startTime);
        add("early", "Earliest start", `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`, early);

        const st = dayStreaks(sessions, now);
        if (st.longest >= 2) out.push({ key: "streak", label: "Most days in a row", value: `${st.longest} days`, runId: null, at: st.from ? new Date(st.from + "T12:00").getTime() : null });

        let burst = null;
        sessions.filter(s => s.funResults).forEach(r => (r.funResults.bursts || []).forEach(([, pace]) => { if (pace >= R.MIN_PACE && (!burst || pace < burst.pace)) burst = { pace, run: r }; }));
        if (burst) add("burst", "Quickest Fun Run burst", `${clock(burst.pace)} /km`, burst.run);
        return out;
    }

    function clock(sec) {
        const s = Math.round(sec);
        return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    }

    // ─── Running charts ──────────────────────────────────────────────────────

    // Each run's pace, and as if it had been flat and cool: [{ t, runId, pace, flat, heat, hill }]
    function flatCoolPace(sessions, a, b) {
        const R = ra();
        return sessions.filter(s => isRun(s) && within(s, a, b) && s.distance >= 1000 && s.pace >= R.MIN_PACE && s.pace < 1200)
            .sort((x, y) => x.startTime - y.startTime)
            .map(r => {
                const hill = R.hillFactor(r), heat = R.heatSlowdown(r.weather);
                return { t: r.startTime, runId: r.runId, pace: r.pace, flat: r.pace / (hill * (1 + heat)), heat, hill };
            });
    }

    // Metres per heartbeat on steady runs, flat and cool: fitness shows here before
    // pace does. [{ t, runId, value }], plus a 5-run running median.
    function efficiency(sessions, a, b) {
        const W = wr();
        const pts = sessions.filter(s => isRun(s) && within(s, a, b) && W.steady(s))
            .sort((x, y) => x.startTime - y.startTime)
            .map(r => { const hr = W.cleanHeartRate(r); return hr ? { t: r.startTime, runId: r.runId, value: W.adjustedSpeed(r) * 60 / hr, hr } : null; })
            .filter(Boolean);
        pts.forEach((p, i) => { p.trend = median(pts.slice(Math.max(0, i - 4), i + 1).map(x => x.value)); });
        return pts;
    }

    // How each run is classed for effort: from its rating, or what the plan said it was
    function effortClass(r) {
        if (r.rpe > 0) return r.rpe <= 4 ? "easy" : r.rpe <= 6 ? "moderate" : "hard";
        const role = r.guided && r.guided.plan && r.guided.plan.role;
        if (role === "easy" || role === "long") return "easy";
        if (role === "quality") return "hard";
        return "unrated";
    }

    // Minutes of running by effort: { easy, moderate, hard, unrated, total, easyShare }
    function intensity(sessions, a, b) {
        const out = { easy: 0, moderate: 0, hard: 0, unrated: 0 };
        sessions.filter(s => isRun(s) && within(s, a, b)).forEach(r => { out[effortClass(r)] += r.time / 60; });
        const rated = out.easy + out.moderate + out.hard;
        return Object.assign(out, { total: rated + out.unrated, easyShare: rated > 0 ? out.easy / rated : null });
    }

    // Each rated run: how hard it felt against its flat-and-cool pace, this period and the one before
    function effortVsPace(sessions, period, now = Date.now()) {
        const r = range(period, now);
        const pts = (a, b) => flatCoolPace(sessions, a, b).map(p => {
            const run = sessions.find(s => s.runId === p.runId);
            return run.rpe > 0 ? { pace: p.flat, rpe: run.rpe, runId: p.runId, t: p.t } : null;
        }).filter(Boolean);
        return { now: pts(r.start, r.end), before: pts(r.prevStart, r.start) };
    }

    // Race times from your fitness now and at the start of the period (Riegel, from the 5K prediction)
    const RACES = [["5K", 5000], ["10K", 10000], ["Half", 21097.5], ["Marathon", 42195]];
    function predictions(sessions, period, now = Date.now()) {
        const R = ra();
        const at = (t) => R.fiveKPace(sessions, t);
        const p5 = at(now), was = at(range(period, now).start);
        if (!p5) return null;
        const time = (p, m) => p * 5 * Math.pow(m / 5000, 1.06);
        return RACES.map(([label, m]) => ({ label, metres: m, sec: time(p5, m), was: was ? time(was, m) : null }));
    }

    // Routes run 3+ times: { name, count, first, best, latest } (seconds over the route's ranked distance)
    function routeProgress(routes) {
        return routes.filter(rt => rt.ranked.entries.length >= 3).map(rt => {
            const byTime = [...rt.ranked.entries].sort((a, b) => a.run.startTime - b.run.startTime);
            const best = rt.ranked.entries[0];
            return {
                name: rt.name, id: rt.id, count: byTime.length, km: rt.ranked.distance / 1000,
                first: byTime[0].timeMs / 1000, latest: byTime[byTime.length - 1].timeMs / 1000, best: best.timeMs / 1000, bestRunId: best.run.runId,
                times: byTime.map(e => ({ t: e.run.startTime, sec: e.timeMs / 1000 })),
            };
        });
    }

    // Fun Runs: { runs, bestBursts: [{ t, pace }], escaped, caught, finishes: [{ t, pace }] }
    function funStats(sessions) {
        const fun = sessions.filter(s => s.endTime && s.funResults).sort((a, b) => a.startTime - b.startTime);
        const out = { runs: fun.length, bestBursts: [], escaped: 0, caught: 0, finishes: [] };
        fun.forEach(r => {
            const f = r.funResults;
            const b = (f.bursts || []).map(x => x[1]).filter(x => x >= ra().MIN_PACE);
            if (b.length) out.bestBursts.push({ t: r.startTime, pace: Math.min(...b), runId: r.runId });
            out.escaped += f.escaped || 0;
            out.caught += f.caught || 0;
            if (f.finish) out.finishes.push({ t: r.startTime, pace: f.finish });
        });
        return out;
    }

    // ─── Strength ────────────────────────────────────────────────────────────

    // Ladder exercises: where you started this period, and where you are: [{ id, name, from, to, of, variation, history: [{ t, level }] }]
    function ladders(sessions, a, b) {
        const map = new Map();
        sessions.filter(isGym).sort((x, y) => x.startTime - y.startTime).forEach(s => (s.exercises || []).forEach(e => {
            if (e.level == null || !e.levels) return;
            const m = map.get(e.id) || { id: e.id, name: e.name, of: e.levels, history: [] };
            m.history.push({ t: s.startTime, level: e.level });
            m.variation = e.variation; m.of = e.levels; m.name = e.name;
            map.set(e.id, m);
        }));
        return [...map.values()].map(m => {
            const before = m.history.filter(h => h.t < a);
            const inside = m.history.filter(h => h.t >= a && h.t < b);
            const from = before.length ? before[before.length - 1].level : inside.length ? inside[0].level : null;
            const to = m.history[m.history.length - 1].level;
            return Object.assign(m, { from, to, active: inside.length > 0 });
        }).filter(m => m.active).sort((x, y) => (y.to - y.from) - (x.to - x.from));
    }

    // Calf tests: [{ t, left, right }]
    function calfTests(sessions) {
        return sessions.filter(s => s.endTime && s.activity === "strength" && s.title === "Calf test").sort((a, b) => a.startTime - b.startTime)
            .map(s => { const e = (s.exercises || []).find(x => x.id === "calftest"); return e && e.sets.length ? { t: s.startTime, left: e.sets[0].reps, right: e.sets[1] ? e.sets[1].reps : null } : null; })
            .filter(Boolean);
    }

    // Hard sets by movement in a period: { push, pull, legs, hinge, core }
    function balance(sessions, a, b) {
        const out = { push: 0, pull: 0, legs: 0, hinge: 0, core: 0 };
        sessions.filter(s => isGym(s) && within(s, a, b)).forEach(s => (s.exercises || []).forEach(e => {
            const p = sp().patternOf(e.id);
            if (p in out) out[p] += e.sets.length;
        }));
        return out;
    }

    // ─── You ─────────────────────────────────────────────────────────────────

    // Fitness age at the end of each of the last `months` months: [{ t, age, vo2 }]
    function fitnessAgeByMonth(sessions, profile, now = Date.now(), months = 12) {
        if (!profile || !profile.birthYear || !profile.sex) return [];
        const out = [];
        for (let i = months - 1; i >= 0; i--) {
            const d = new Date(now); d.setDate(1); d.setHours(0, 0, 0, 0); d.setMonth(d.getMonth() - i + 1);
            const end = Math.min(d.getTime(), now);
            const vo2 = ra().vo2max(sessions, end);
            if (!vo2) continue;
            const f = ra().fitnessAge(vo2, new Date(end).getFullYear() - profile.birthYear, profile.sex);
            if (f) out.push({ t: end - 1, age: f.age, vo2 });
        }
        return out;
    }

    // Everything, ever, with something to picture it by
    function lifetime(sessions) {
        const runs = sessions.filter(isRun), walks = sessions.filter(isWalk);
        const km = sum(runs.map(r => r.distance)) / 1000;
        const walkKm = sum(walks.map(r => r.distance)) / 1000;
        const hours = sum(sessions.filter(s => isRun(s) || isWalk(s) || isGym(s)).map(s => s.time || 0)) / 3600;
        const steps = sum(runs.concat(walks).map(r => r.steps && r.steps.length ? r.steps[r.steps.length - 1][1] : 0));
        const climb = sum(runs.concat(walks).map(r => r.elevation && r.elevation.gain || 0));
        const total = km + walkKm;
        const like = [];
        if (total >= 140) like.push(`Dubai to Abu Dhabi ${(total / 140).toFixed(1)} times`);
        else if (total >= 42.2) like.push(`${(total / 42.195).toFixed(1)} marathons`);
        if (total >= 400) like.push(`${(total / 40075 * 100).toFixed(1)}% of the way round the Earth`);
        if (climb >= 828) like.push(`up the Burj Khalifa ${(climb / 828).toFixed(1)} times`);
        return { runs: runs.length, workouts: sessions.filter(isGym).length, walks: walks.length, km, walkKm, hours, steps, climb, like };
    }

    // A month in a few lines, for the first week of the next one: null if there was nothing
    function monthRecap(sessions, now = Date.now()) {
        const d = new Date(now);
        const start = new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime(), end = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
        const before = new Date(d.getFullYear(), d.getMonth() - 2, 1).getTime();
        const cur = totals(sessions, start, end), prev = totals(sessions, before, start);
        if (!cur.runs && !cur.workouts && !cur.walks) return null;
        const recs = records(sessions, end).filter(r => r.at >= start && r.at < end);
        const longest = sessions.filter(s => isRun(s) && within(s, start, end)).reduce((m, r) => Math.max(m, r.distance), 0);
        return {
            month: new Date(start).toLocaleDateString(undefined, { month: "long" }), cur, prev,
            change: prev.km > 0 ? Math.round((cur.km / prev.km - 1) * 100) : null, longest: longest / 1000,
            records: recs.map(r => `${r.label}: ${r.value}`),
        };
    }

    // ─── Your own patterns ───────────────────────────────────────────────────
    // Each only with enough runs on both sides, and only when the gap is worth saying.

    const MIN_EACH = 5;

    function patterns(sessions) {
        const R = ra();
        const runs = sessions.filter(s => isRun(s) && s.distance >= 1500 && s.pace >= R.MIN_PACE && s.pace < 1200 && !(s.guided && s.guided.segments && s.guided.segments.some(x => x.pace || x.game)));
        const hillPace = (r) => r.pace / R.hillFactor(r);
        const out = [];
        const pct = (a, b) => Math.round((median(a) / median(b) - 1) * 100);

        const morning = runs.filter(r => new Date(r.startTime).getHours() < 11), evening = runs.filter(r => new Date(r.startTime).getHours() >= 16);
        if (morning.length >= MIN_EACH && evening.length >= MIN_EACH) {
            const d = pct(morning.map(hillPace), evening.map(hillPace));
            if (Math.abs(d) >= 2) out.push({ key: "time", text: d < 0 ? `Mornings: you run ${-d}% quicker than in the evening.` : `Evenings: you run ${d}% quicker than in the morning.`, n: `${morning.length} morning and ${evening.length} evening runs` });
        }
        const feels = (r) => r.weather ? (r.weather.feelsC != null ? r.weather.feelsC : r.weather.tempC) : null;
        const hot = runs.filter(r => feels(r) >= 32), cool = runs.filter(r => feels(r) != null && feels(r) < 25);
        if (hot.length >= MIN_EACH && cool.length >= MIN_EACH) {
            const d = pct(hot.map(hillPace), cool.map(hillPace));
            if (d >= 2) out.push({ key: "heat", text: `Above 32°C you slow about ${d}%, against days under 25°C.`, n: `${hot.length} hot and ${cool.length} cooler runs` });
        }
        const gymDays = new Set(sessions.filter(isGym).map(s => wr().dayKey(s.startTime)));
        const rated = runs.filter(r => r.rpe > 0);
        const after = rated.filter(r => gymDays.has(wr().dayKey(r.startTime - DAY))), other = rated.filter(r => !gymDays.has(wr().dayKey(r.startTime - DAY)));
        if (after.length >= 4 && other.length >= MIN_EACH) {
            const d = median(after.map(r => r.rpe)) - median(other.map(r => r.rpe));
            if (Math.abs(d) >= 0.75) out.push({ key: "gym", text: d > 0 ? `Runs the day after a gym day feel ${d.toFixed(1).replace(".0", "")} point${d >= 1.5 ? "s" : ""} harder.` : `Runs the day after a gym day feel ${(-d).toFixed(1).replace(".0", "")} point${-d >= 1.5 ? "s" : ""} easier.`, n: `${after.length} runs after the gym, ${other.length} others` });
        }
        const sleepy = rated.filter(r => r.readiness && r.readiness.sleepMin != null);
        const short = sleepy.filter(r => r.readiness.sleepMin < 390), long = sleepy.filter(r => r.readiness.sleepMin >= 450);
        if (short.length >= 4 && long.length >= 4) {
            const d = median(short.map(r => r.rpe)) - median(long.map(r => r.rpe));
            if (d >= 0.75) out.push({ key: "sleep", text: `After under 6½ hours' sleep, runs feel ${d.toFixed(1).replace(".0", "")} point${d >= 1.5 ? "s" : ""} harder.`, n: `${short.length} short nights, ${long.length} long ones` });
        }
        return out;
    }

    return {
        PERIODS, range, totals, headline, calendar, dayStreaks, records, flatCoolPace, efficiency, effortClass, intensity, effortVsPace,
        predictions, routeProgress, funStats, ladders, calfTests, balance, fitnessAgeByMonth, lifetime, monthRecap, patterns, clock,
    };
})();

if (typeof module !== "undefined") module.exports = Stats;
