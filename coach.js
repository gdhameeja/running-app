// coach.js — Tune-In Runs: a run planned from your own recent runs, then
// coached by pace. TuneInPlanner runs here only, before the run; PaceCoach is
// the live half, and PaceCoach.kt has the same logic for the Android service.
// Keep the two in step (tests.js and PaceCoachTest.kt test the same cases).
//
// Before the run (TuneInPlanner):
//  - Learns your usual pace from your last 10 runs (1.5 km+, last 120 days).
//    Recent runs count more, and runs far off the median (a walk, a race)
//    are left out. It needs 5 runs before it plans anything.
//  - Today's average is a few % quicker than usual: just outside your comfort
//    zone. The step grows after a Tune-In run you hit and shrinks after one
//    you missed, and "Tired"/"Fresh" nudge it for the day.
//  - It reaches that average with intervals (push, surge, float, recover):
//    the paces are solved so the time-weighted average speed is the target,
//    and capped by your predicted 5K pace so no part asks for more than
//    you've already shown you can do.
// During the run (PaceCoach):
//  - Announces each part with its pace, and in steady parts of a minute or
//    more checks your pace over the last 20 s every 40 s.
//  - Two missed parts in a row make the rest of the run 4% gentler (at most
//    twice), so it never turns into a run you can't finish.

// Old Tune-In runs stored 1-5 effort check-ins; the run details still show them
const EFFORT_LABELS = { 1: "Too easy", 2: "Easy", 3: "Working", 4: "Hard", 5: "Maxed" };

const DAY_MS = 86400000;

function coachPace(sec) {
    const total = Math.round(sec);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

// 340 -> "5 40 per kilometre", 305 -> "5 oh 5 per kilometre", 360 -> "6 minutes per kilometre"
function spokenPace(sec) {
    const total = Math.round(sec);
    const m = Math.floor(total / 60), s = total % 60;
    if (s === 0) return `${m} minutes per kilometre`;
    return `${m} ${s < 10 ? "oh " + s : s} per kilometre`;
}

function spokenSeconds(sec) {
    if (sec < 60) return `${sec} seconds`;
    const m = Math.floor(sec / 60), r = sec % 60;
    const mins = `${m} minute${m > 1 ? "s" : ""}`;
    return r ? `${mins} ${r} seconds` : mins;
}

const ROLE_LABELS = {
    warmup: "Warm up", settle: "Settle in", cruise: "Steady", push: "Push", surge: "Surge",
    float: "Float", recover: "Recover", cooldown: "Cool down",
};
// Run-screen colour for each role (styles.css .seg-*)
const ROLE_TYPES = {
    warmup: "warmup", settle: "run", cruise: "run", push: "sprint", surge: "sprint",
    float: "jog", recover: "jog", cooldown: "cooldown",
};

class PaceCoach {
    static FIRST_CHECK_MS = 25000;
    static CHECK_EVERY_MS = 40000;
    static QUIET_END_MS = 15000;
    static WINDOW_MS = 20000;
    static CHECKED_MIN_MS = 60000;
    static JUDGED_MIN_MS = 45000;
    static SLOW = 1.05;
    static FAST = 0.94;
    static MISS = 1.07;
    static EASE = 1.04;
    static MAX_EASES = 2;
    // Parts whose pace gets checked, eased, and judged
    static NAG_SLOW = ["settle", "cruise", "push"];
    static NAG_FAST = ["settle", "cruise", "push", "float"];
    static EASED = ["settle", "cruise", "push", "surge", "float"];
    static JUDGED = ["settle", "cruise", "push"];

    // segments: [{ role, pace: s/km | null, durationMs }]
    constructor(segments) {
        this.segments = segments;
        this.scale = 1;
        this.eases = 0;
        this.misses = 0;
        this.seg = -1;
        this.segStart = 0;
        this.segStartDist = 0;
        this.nextCheckAt = 0;
        this.lastStatus = null;
        this.status = null;
        this.now = null;
        this.samples = [];
    }

    static isCoached(segments) {
        return (segments || []).some(s => s.pace != null);
    }

    get active() { return this.seg >= 0; }

    // Target pace (s/km) of a segment after any easing, to the nearest 5 s
    pace(index = this.seg) {
        const s = this.segments[index];
        if (!s || s.pace == null) return null;
        return PaceCoach.EASED.includes(s.role) ? Math.round(s.pace * this.scale / 5) * 5 : s.pace;
    }

    // A segment just started, `dist` metres into the run. Returns phrases to speak.
    startSegment(index, t, dist) {
        const said = this.seg >= 0 ? this.judge(t, dist) : [];
        const s = this.segments[index];
        this.seg = s ? index : -1;
        this.segStart = t;
        this.segStartDist = dist;
        this.nextCheckAt = t + PaceCoach.FIRST_CHECK_MS;
        this.lastStatus = null;
        this.status = null;
        if (s) said.push(this.announcement(s, this.pace(index)));
        return said;
    }

    announcement(s, pace) {
        const d = spokenSeconds(Math.round(s.durationMs / 1000));
        const p = pace != null ? spokenPace(pace) : "";
        switch (s.role) {
            case "warmup": return `Tune-In run. Warm up easy, around ${p}. ${d}.`;
            case "settle": return `Settle in at ${p}, for ${d}.`;
            case "cruise": return `Steady. ${p}, for ${d}.`;
            case "push": return `Push! ${p}, for ${d}.`;
            case "surge": return `Surge! ${d} at ${p}. Go!`;
            case "float": return `Float. Ease off to ${p}, for ${d}.`;
            case "recover": return `Recover. Easy jog or walk, ${d}.`;
            case "cooldown": return "Cool down. That's the work done. Walk or jog, whatever feels good.";
            default: return `${d}.`;
        }
    }

    // How the segment that just ended went; eases the rest of the run after two misses
    judge(t, dist) {
        const s = this.segments[this.seg];
        const target = this.pace();
        if (!s || target == null || !PaceCoach.JUDGED.includes(s.role) || s.durationMs < PaceCoach.JUDGED_MIN_MS) return [];
        const d = dist - this.segStartDist;
        const ratio = d > 5 ? (t - this.segStart) / d / target : Infinity;
        if (ratio > PaceCoach.MISS) this.misses++;
        else if (ratio <= 1.03) this.misses = 0;
        if (this.misses < 2 || this.eases >= PaceCoach.MAX_EASES) return [];
        this.scale *= PaceCoach.EASE;
        this.eases++;
        this.misses = 0;
        return ["Let's adjust. The rest of today's targets are a little gentler. You're still doing the work."];
    }

    // Pace (s/km) over the last ~20 s, or null if there's too little to go on or you stopped
    measured() {
        const last = this.samples[this.samples.length - 1];
        if (!last) return null;
        let from = this.samples[0];
        for (const p of this.samples) { if (p[0] <= last[0] - PaceCoach.WINDOW_MS) from = p; else break; }
        if (last[0] - from[0] < 15000) return null;
        const d = last[1] - from[1];
        return d >= 15 ? (last[0] - from[0]) / d : null;
    }

    tick(t, dist) {
        if (this.seg < 0) return [];
        const last = this.samples[this.samples.length - 1];
        if (!last || t - last[0] >= 1000) this.samples.push([t, dist]);
        while (this.samples.length && this.samples[0][0] < t - 30000) this.samples.shift();

        const s = this.segments[this.seg];
        const target = this.pace();
        this.now = this.measured();
        this.status = target == null || this.now == null ? null
            : this.now > target * PaceCoach.SLOW ? "slow" : this.now < target * PaceCoach.FAST ? "fast" : "on";
        if (target == null || s.durationMs < PaceCoach.CHECKED_MIN_MS) return [];
        if (t < this.nextCheckAt || this.segStart + s.durationMs - t <= PaceCoach.QUIET_END_MS) return [];
        this.nextCheckAt = t + PaceCoach.CHECK_EVERY_MS;
        if (this.status == null) return [];

        const p = spokenPace(target);
        let msg = null;
        if (this.status === "slow" && PaceCoach.NAG_SLOW.includes(s.role)) {
            msg = this.now > target * 1.15 ? `Pick it up when you're ready. Aim for ${p}.` : `A little quicker. Aim for ${p}.`;
        } else if (this.status === "fast" && PaceCoach.NAG_FAST.includes(s.role)) {
            msg = s.role === "push" ? `Strong! ${p} is enough, save a bit.` : `Ease back a touch, to ${p}. Save it for the pushes.`;
        } else if (this.status === "on" && this.lastStatus !== "on") {
            msg = this.lastStatus ? "That's it, right on pace." : "On pace. Hold it there.";
        }
        this.lastStatus = this.status;
        return msg ? [msg] : [];
    }

    // For the run screen
    state() {
        if (this.seg < 0) return { active: false };
        const s = this.segments[this.seg];
        const target = this.pace();
        const label = ROLE_LABELS[s.role] || "Run";
        return {
            active: true, role: s.role, target, now: this.now, status: this.status, eases: this.eases,
            instruction: target == null ? (s.role === "cooldown" ? "Walk or jog, whatever feels good" : label)
                : s.role === "recover" || s.role === "warmup" ? `${label}: easy, around ${coachPace(target)} /km`
                : `${label} at ${coachPace(target)} /km`,
        };
    }
}

const TuneInPlanner = (() => {
    const NEED_RUNS = 5;
    const POOL = 10;
    const WINDOW_DAYS = 120;
    const BASE_STEP = 0.03, MIN_STEP = 0.01, MAX_STEP = 0.06;
    const FEEL_STEP = { tired: -0.02, normal: 0, fresh: 0.015 };
    const WARMUP_S = 300, COOLDOWN_S = 180;
    // Fastest average allowed, as a multiple of predicted 5K pace: a 12-40 min
    // main set at 5K pace is hard, but short of a race
    const AVG_CAP = 1.0;

    // [role, seconds, speed relative to the target average]; recover runs at your easy pace
    const TEMPLATES = [
        {
            name: "Waves", about: "steady running with one-minute pushes and floats",
            blocks: [[["cruise", 120, 1.0], ["push", 60, 1.07], ["float", 60, 0.95]]],
        },
        {
            name: "Surges", about: "short fast surges, each followed by an easy recovery",
            blocks: [[["cruise", 150, 1.0], ["surge", 20, 1.2], ["recover", 40]]],
        },
        {
            name: "Pyramid", about: "pushes of 30, 60 and 90 seconds and back down",
            blocks: [
                [["cruise", 90, 1.0], ["push", 30, 1.1], ["recover", 30]],
                [["cruise", 90, 1.0], ["push", 60, 1.08], ["recover", 45]],
                [["cruise", 90, 1.0], ["push", 90, 1.06], ["recover", 60]],
                [["cruise", 90, 1.0], ["push", 60, 1.08], ["recover", 45]],
            ],
        },
        {
            name: "Progression", about: "starts gentle and finishes strong",
            build: (mainS) => {
                const a = Math.round(mainS * 0.4 / 30) * 30, b = Math.round(mainS * 0.35 / 30) * 30;
                return [["cruise", a, 0.97], ["cruise", b, 1.0], ["push", mainS - a - b - 30, 1.03], ["surge", 30, 1.1]];
            },
        },
    ];

    function analysis() {
        return typeof RunAnalysis !== "undefined" ? RunAnalysis : require("./analysis.js");
    }

    function pool(runs, now) {
        return runs.filter(r => r.endTime && r.startTime < now && r.startTime > now - WINDOW_DAYS * DAY_MS &&
            r.distance >= 1500 && r.time >= 480 && r.pace >= 150 && r.pace <= 900)
            .sort((a, b) => b.startTime - a.startTime)
            .slice(0, POOL);
    }

    // Usual speed (m/s): recency-weighted mean, leaving out runs 15%+ off the median
    function usualSpeed(runs) {
        const speeds = runs.map(r => r.distance / r.time);
        const sorted = [...speeds].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        let sum = 0, weights = 0;
        speeds.forEach((v, i) => {
            if (v < median * 0.85 || v > median * 1.15) return;
            const w = Math.pow(0.85, i);
            sum += w * v;
            weights += w;
        });
        return sum / weights;
    }

    // How a Tune-In run went: main-set pace against its target
    function result(run) {
        const tune = run.guided && run.guided.tuneIn;
        if (!tune) return null;
        const series = analysis().seriesForRun(run);
        const end = Math.min(tune.mainEndMs, run.time * 1000);
        const finished = run.time * 1000 >= tune.mainEndMs - 5000;
        if (!series || end - tune.mainStartMs < 60000) return { finished: false, pace: null, target: tune.targetPace, ratio: Infinity };
        const RA = analysis();
        const d = RA.distanceAtTime(series, end) - RA.distanceAtTime(series, tune.mainStartMs);
        const pace = d > 0 ? (end - tune.mainStartMs) / d : null;
        return { finished, pace, target: tune.targetPace, ratio: pace ? pace / tune.targetPace : Infinity };
    }

    // The learned step: bigger after a Tune-In run you hit, smaller after one you missed
    function learnedStep(runs, now) {
        const last = runs.filter(r => r.endTime && r.startTime < now && r.guided && r.guided.tuneIn)
            .sort((a, b) => b.startTime - a.startTime)[0];
        if (!last) return { step: BASE_STEP, last: null };
        const prev = last.guided.tuneIn.baseStep;
        const res = result(last);
        let step = prev;
        if (!res.finished || res.ratio > 1.04) step = Math.max(MIN_STEP, prev - 0.015);
        else if (res.ratio <= 1.01) step = Math.min(MAX_STEP, prev + 0.005);
        return { step, last: res };
    }

    function mainSeconds(runs) {
        const times = runs.map(r => r.time).sort((a, b) => a - b);
        const median = times[Math.floor(times.length / 2)];
        return Math.max(12, Math.min(40, Math.round((median - WARMUP_S - COOLDOWN_S) / 60))) * 60;
    }

    // The main set as [role, seconds, factor] parts that fill `mainS`
    function layout(tpl, mainS) {
        if (tpl.build) return tpl.build(mainS);
        const parts = [];
        let used = 0, i = 0;
        for (;;) {
            const block = tpl.blocks[i % tpl.blocks.length];
            const len = block.reduce((a, p) => a + p[1], 0);
            if (used + len > mainS) break;
            parts.push(...block);
            used += len;
            i++;
        }
        // Whatever's left is steady running at the start
        if (mainS > used) parts.unshift(["settle", mainS - used, 1.0]);
        return parts;
    }

    // Speeds (m/s) for the parts so the time-weighted average is `v`. Recovery
    // runs at your easy pace; a part that would go past its cap is held at the
    // cap and the others make up the difference.
    function solve(parts, v, easyV, capV) {
        const fixed = parts.map(p => p[0] === "recover" ? easyV : null);
        const total = parts.reduce((a, p) => a + p[1], 0);
        for (;;) {
            let fixedM = 0, weighted = 0;
            parts.forEach((p, j) => { if (fixed[j] != null) fixedM += fixed[j] * p[1]; else weighted += p[1] * p[2]; });
            const k = weighted > 0 ? (v * total - fixedM) / weighted : 0;
            const speeds = parts.map((p, j) => fixed[j] != null ? fixed[j] : k * p[2]);
            const over = parts.map((p, j) => fixed[j] == null && speeds[j] > capV(p[1]));
            if (!over.includes(true)) return { speeds, capped: fixed.some((f, j) => f != null && parts[j][0] !== "recover") };
            over.forEach((o, j) => { if (o) fixed[j] = capV(parts[j][1]); });
        }
    }

    // The fastest a part may go (m/s), from your predicted 5K pace and its length:
    // about 800 m race pace for 30 s, 3K pace up to 2 min, 5K pace beyond
    function capSpeed(p5, seconds) {
        if (!p5) return Infinity;
        return 1000 / (p5 * (seconds <= 30 ? 0.9 : seconds <= 120 ? 0.96 : 1.0));
    }

    // { ready: false, have, need } until there are enough runs, then
    // { ready: true, session, info }.
    function plan(runs, now = Date.now(), feel = "normal") {
        const recent = pool(runs, now);
        if (recent.length < NEED_RUNS) return { ready: false, have: recent.length, need: NEED_RUNS };

        const usual = usualSpeed(recent);
        const learned = learnedStep(runs, now);
        const step = Math.max(0, learned.step + (FEEL_STEP[feel] || 0));
        const done = runs.filter(r => r.endTime && r.guided && r.guided.tuneIn).length;
        const tpl = TEMPLATES[done % TEMPLATES.length];
        const mainS = mainSeconds(recent);
        const parts = layout(tpl, mainS);
        const easyV = usual * 0.87;
        const p5 = analysis().fiveKPace(runs, now);

        // Never ask for an average beyond 5K pace, but never slower than usual either
        let v = usual * (1 + step);
        if (p5) v = Math.max(usual, Math.min(v, 1000 / (p5 * AVG_CAP)));
        const solved = solve(parts, v, easyV, (seconds) => capSpeed(p5, seconds));
        const paces = solved.speeds.map(x => 1000 / x);
        const capped = solved.capped || v < usual * (1 + step);

        const round5 = (x) => Math.round(x / 5) * 5;
        const seg = (role, seconds, pace) => ({
            type: ROLE_TYPES[role], duration: seconds / 60, role, pace,
            label: ROLE_LABELS[role],
            intensity: pace == null ? "Walk or jog" : `${ROLE_LABELS[role]} at ${coachPace(pace)} /km`,
        });
        const main = parts.map((p, i) => seg(p[0], p[1], round5(paces[i])));
        const segments = [seg("warmup", WARMUP_S, round5(1000 / easyV)), ...main, seg("cooldown", COOLDOWN_S, null)];

        // The average the rounded paces actually add up to
        const metres = main.reduce((a, s) => a + s.duration * 60 / s.pace * 1000, 0);
        const targetPace = mainS / (metres / 1000);
        const tuneIn = {
            template: tpl.name, usualPace: 1000 / usual, targetPace, step, baseStep: learned.step, feel,
            capped: !!capped, runsUsed: recent.length,
            mainStartMs: 5000 + WARMUP_S * 1000, mainEndMs: 5000 + (WARMUP_S + mainS) * 1000,
        };
        const total = Math.round((WARMUP_S + mainS + COOLDOWN_S) / 60);
        return {
            ready: true,
            info: Object.assign({ about: tpl.about, mainMin: mainS / 60, totalMin: total, last: learned.last, p5 }, tuneIn),
            session: {
                title: `Tune-In: ${tpl.name}`, type: "tune",
                description: `${total} min · ${mainS / 60} min main set averaging ${coachPace(targetPace)} /km`,
                segments, tuneIn,
            },
        };
    }

    return { plan, result, usualSpeed, NEED_RUNS, TEMPLATES };
})();

if (typeof module !== "undefined") module.exports = { PaceCoach, TuneInPlanner, EFFORT_LABELS, spokenPace, coachPace };
