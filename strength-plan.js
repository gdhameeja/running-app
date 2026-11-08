// strength-plan.js — What to do next, from what you did before. Pure, so tests.js
// loads it. Built for training with no equipment, on the same idea as Tune-In: a
// small step when you hit the target, easing off when you don't.
//  - Most exercises are a ladder of harder variations, which do the job added
//    weight does in a gym. Hit every set: more reps (or seconds) next time. Hit
//    the top of the range: on to the next variation, at the bottom of the range.
//  - Stopped early with every set on target: same again, neither hit nor miss.
//  - Missed: same target again. Missed twice: fewer reps, or the variation below
//    if you were already at the bottom of the range.
//  - Tired today: repeat what you did rather than stepping up.
//  - Exercises with weights (stepKg > 0) work the same way, with kilos for rungs.
//
// A session is a record in the `runs` store with activity "strength":
//   { exercises: [{ id, name, variation, level, levels, unit, sets: [{ weight, reps, target }] }] }
// `unit` is "s" for timed holds, whose `reps` and `target` are seconds.

const StrengthPlanner = (() => {
    const BACK_OFF = 0.9;
    const NO_EQUIPMENT = "No equipment", BAR_OR_TABLE = "Needs a bar or sturdy table", WEIGHTS = "With weights";

    const ladder = (id, name, rungs, level, group, repLow = 6, repHigh = 12, restSec = 90) =>
        ({ id, name, ladder: rungs, level, group, sets: 3, repLow, repHigh, repStep: 1, stepKg: 0, restSec });
    const hold = (id, name, rungs, level, repLow = 20, repHigh = 60, restSec = 60) =>
        ({ id, name, ladder: rungs, level, group: NO_EQUIPMENT, unit: "s", sets: 3, repLow, repHigh, repStep: 5, stepKg: 0, restSec });
    const lift = (id, name, stepKg = 2.5, restSec = 120) =>
        ({ id, name, group: WEIGHTS, sets: 3, repLow: 8, repHigh: 12, repStep: 1, stepKg, restSec });

    const PRESETS = [
        ladder("push", "Push-ups", ["Wall push-up", "Incline push-up", "Knee push-up", "Push-up", "Diamond push-up", "Archer push-up"], 3, NO_EQUIPMENT),
        ladder("squat", "Squats", ["Chair squat", "Squat", "Split squat", "Bulgarian split squat", "Shrimp squat", "Pistol squat"], 1, NO_EQUIPMENT, 8, 15),
        // Pulling with no bar: a backpack full of books. Add more books when you can
        ladder("packrow", "Backpack rows", ["Two-arm backpack row", "One-arm backpack row", "Slow one-arm backpack row"], 0, NO_EQUIPMENT, 8, 15, 75),
        ladder("back", "Back raises", ["Superman raise", "Reverse snow angel", "Prone Y raise"], 0, NO_EQUIPMENT, 8, 15, 60),
        ladder("bridge", "Glute bridges", ["Glute bridge", "Single-leg glute bridge", "Feet-raised single-leg bridge", "Single-leg bridge, backpack on your hips"], 0, NO_EQUIPMENT, 8, 15, 60),
        ladder("legraise", "Leg raises", ["Bent-knee leg raise", "Leg raise"], 0, NO_EQUIPMENT, 8, 15, 60),
        ladder("calf", "Calf raises", ["Calf raise", "Single-leg calf raise", "Single-leg calf raise off a step"], 0, NO_EQUIPMENT, 12, 25, 45),
        ladder("burpee", "Burpees", ["Step-back burpee", "Burpee"], 0, NO_EQUIPMENT, 6, 15, 90),
        hold("plank", "Plank", ["Knee plank", "Plank", "Long-lever plank"], 1),
        hold("sideplank", "Side plank", ["Knee side plank", "Side plank", "Side plank with leg lift"], 1, 15, 45),
        hold("hollow", "Hollow hold", ["Tuck hold", "Hollow hold"], 0, 15, 45),
        hold("wallsit", "Wall sit", ["Wall sit", "Single-leg wall sit"], 0, 30, 90),
        // Round the house: a bed, a chair, the stairs, a towel and a door
        ladder("beddip", "Bed dips", ["Bent-knee bed dip", "Straight-leg bed dip", "Feet-raised bed dip", "Single-leg bed dip"], 0, NO_EQUIPMENT, 8, 15, 75),
        ladder("pike", "Pike push-ups", ["Hands-on-bed pike push-up", "Pike push-up", "Feet-on-bed pike push-up"], 0, NO_EQUIPMENT, 5, 12, 90),
        ladder("towelrow", "Towel rows", ["Door towel row, standing tall", "Door towel row, leaning back", "One-arm door towel row", "One-arm towel row, backpack on"], 0, NO_EQUIPMENT, 8, 15, 75),
        ladder("stepup", "Step-ups", ["Step-up onto a stair", "Step-up onto a chair", "Slow step-up onto a chair", "Backpack step-up onto a chair"], 0, NO_EQUIPMENT, 8, 15, 60),
        ladder("lunge", "Lunges", ["Reverse lunge", "Forward lunge", "Reverse lunge off a step", "Backpack reverse lunge off a step"], 0, NO_EQUIPMENT, 8, 15, 60),
        Object.assign(ladder("legcurl", "Hamstring curls", ["Hamstring walkout", "Towel leg curl", "Single-leg towel leg curl", "Nordic lower, feet under the bed"], 0, NO_EQUIPMENT, 6, 12, 75),
            { rungReps: { 3: [3, 6] } }),
        ladder("deadbug", "Dead bugs", ["Heel-tap dead bug", "Dead bug", "Slow dead bug"], 0, NO_EQUIPMENT, 6, 12, 45),
        hold("copenhagen", "Copenhagen plank", ["Side-lying inner-thigh lift", "Copenhagen plank, knee on the bed", "Copenhagen plank, foot on the bed"], 0, 10, 30, 45),
        // The deep calf muscle (soleus) works hardest with the knee bent
        ladder("soleus", "Bent-knee calf raises", ["Bent-knee calf raise", "Single-leg bent-knee calf raise", "Single-leg bent-knee calf raise off a step"], 0, NO_EQUIPMENT, 10, 20, 45),
        // Side of the hip, for knees that track well
        ladder("hipabd", "Side leg raises", ["Side-lying leg raise", "Side-lying leg raise, 2 s at the top", "Side-plank leg raise"], 0, NO_EQUIPMENT, 10, 20, 45),
        // Springy feet: reps are foot contacts, 60-120 a session to start
        Object.assign(ladder("hops", "Hops", ["Skipping on the spot", "Pogo hops", "Pogo hops, forward and back", "Single-leg pogo hops"], 0, NO_EQUIPMENT, 20, 40, 60),
            { repStep: 5 }),
        // Foot core (Taddei 2020): a few minutes, after easy runs
        hold("shortfoot", "Short foot", ["Short foot, sitting", "Short foot, standing", "Short foot, on one leg"], 0, 10, 30, 15),
        ladder("toeyoga", "Toe yoga", ["Toe yoga"], 0, NO_EQUIPMENT, 10, 20, 15),
        hold("balance", "Single-leg balance", ["Single-leg balance", "Single-leg balance, eyes closed", "Single-leg balance on a cushion"], 0, 20, 45, 15),
        // Once a month: how many single-leg calf raises you can do. 25 is a good benchmark
        Object.assign(ladder("calftest", "Calf test", ["Single-leg calf raises, as many as you can"], 0, NO_EQUIPMENT, 25, 25, 90),
            { sets: 2, test: true }),
        ladder("pull", "Pull-ups", ["Negative pull-up", "Chin-up", "Pull-up", "Archer pull-up"], 0, BAR_OR_TABLE, 3, 8, 120),
        ladder("row", "Table rows", ["Bent-knee table row", "Table row", "Feet-raised table row"], 0, BAR_OR_TABLE, 6, 12, 90),
        ladder("dip", "Dips", ["Chair dip", "Feet-raised chair dip", "Parallel bar dip"], 0, BAR_OR_TABLE, 6, 12, 90),
        lift("barsquat", "Barbell squat", 2.5, 150), lift("bench", "Bench press"), lift("deadlift", "Deadlift", 5, 180),
        lift("ohp", "Overhead press"), lift("barrow", "Barbell row"), lift("curl", "Biceps curl", 1, 60),
    ];
    const GROUPS = [NO_EQUIPMENT, BAR_OR_TABLE, WEIGHTS];
    const byId = (id) => PRESETS.find(p => p.id === id);
    // Three full-body workouts to take in turn, two or three a week. Each has a
    // push, a pull, a leg exercise, one for the back of the hips and one for the
    // core, so two sessions train everything twice. Single-leg work, hamstrings,
    // calves and the inner thigh are there for running.
    const PLAN_VERSION = 3;
    const DEFAULT_ROUTINES = [
        { id: "fb-a", title: "Full body A", exercises: ["hops", "push", "squat", "packrow", "bridge", "soleus", "plank"].map(byId) },
        { id: "fb-b", title: "Full body B", exercises: ["hops", "pike", "stepup", "towelrow", "legcurl", "calf", "sideplank"].map(byId) },
        { id: "fb-c", title: "Full body C", exercises: ["beddip", "lunge", "towelrow", "back", "hipabd", "copenhagen"].map(byId) },
    ];
    // Short extras, outside the A/B/C rotation and the weekly strength count
    const EXTRA_ROUTINES = [
        { id: "foot", title: "Foot core", extra: true, exercises: ["shortfoot", "toeyoga", "balance"].map(id => Object.assign({}, byId(id), { sets: 2 })) },
        { id: "calftest", title: "Calf test", extra: true, exercises: [byId("calftest")] },
    ];
    // The starter workouts before PLAN_VERSION 2, as exercise ids
    const OLD_DEFAULTS = {
        a: ["push,squat,plank"], b: ["packrow,back,bridge,sideplank"],
        "fb-a": ["push,squat,packrow,bridge,beddip,plank"], "fb-b": ["pike,stepup,towelrow,legcurl,calf,sideplank"],
        "fb-c": ["beddip,lunge,towelrow,back,deadbug,copenhagen"],
    };

    // Saved workouts from before this plan: the old starters, if you never changed
    // them, give way to the new ones; anything of your own stays, with the new ones
    // added after it. Null if there's nothing to change.
    function upgradeRoutines(record) {
        if (!record) return null;
        if (record.plan >= PLAN_VERSION) return null;
        const mine = (record.routines || []).filter(r => !(OLD_DEFAULTS[r.id] || []).includes(r.exercises.map(e => e.id).join(",")));
        const extra = DEFAULT_ROUTINES.filter(d => !mine.some(r => r.id === d.id));
        return { routines: mine.concat(JSON.parse(JSON.stringify(extra))), plan: PLAN_VERSION };
    }

    // A saved exercise with today's preset ladder and rep range, keeping your sets and rest
    function freshen(ex) {
        const p = PRESETS.find(x => x.id === ex.id);
        return p ? Object.assign({}, p, { sets: ex.sets, restSec: ex.restSec }) : ex;
    }

    // The workout after the one you did last, by title; the first if none match
    function upNext(routines, sessions) {
        if (!routines.length) return -1;
        const last = sessions.filter(s => s.activity === "strength" && s.endTime && !s.light).sort((a, b) => b.startTime - a.startTime)[0];
        const i = last ? routines.findIndex(r => r.title === last.title) : -1;
        return i < 0 ? 0 : (i + 1) % routines.length;
    }

    // One line on how to do the ones people don't know by name
    const HOW = {
        "Bent-knee bed dip": "Hands on the edge of the bed behind you, feet flat, knees bent. Lower until your elbows are at a right angle, then press up.",
        "Straight-leg bed dip": "As the bent-knee dip, with your legs straight and heels on the floor.",
        "Feet-raised bed dip": "Hands on the bed, heels on a chair in front of you. Lower to a right angle at the elbows.",
        "Single-leg bed dip": "A straight-leg bed dip with one foot lifted. Swap legs each set.",
        "Hands-on-bed pike push-up": "Hands on the bed, hips high so you make an upside-down V. Bend your elbows to bring your head towards the bed.",
        "Pike push-up": "Hands and feet on the floor, hips high in an upside-down V. Lower your head towards the floor between your hands.",
        "Feet-on-bed pike push-up": "Feet on the bed, hands on the floor, hips stacked over your shoulders. Lower your head to the floor and press back up.",
        "Door towel row, standing tall": "Shut the door, loop a towel round both handles and hold an end in each hand. Lean back a little and pull your chest to the door.",
        "Door towel row, leaning back": "As before, with your feet closer to the door so you lean back further. The more you lean, the harder it gets.",
        "One-arm door towel row": "Hold both ends of the towel in one hand, lean back and pull. Swap arms each set.",
        "Step-up onto a stair": "Whole foot on the step. Push through that heel to stand up, then step down slowly. Reps are per leg.",
        "Step-up onto a chair": "A sturdy chair against a wall. Drive through the top foot rather than pushing off the floor one. Reps are per leg.",
        "Slow step-up onto a chair": "As before, taking three seconds to lower yourself back down. Reps are per leg.",
        "Reverse lunge": "Step back and lower your back knee towards the floor, front shin upright. Push through the front heel to come back. Reps are per leg.",
        "Forward lunge": "Step forward and lower your back knee towards the floor, then push back to standing. Reps are per leg.",
        "Reverse lunge off a step": "Stand on a stair and step back down off it into a lunge, so you sink lower. Reps are per leg.",
        "Hamstring walkout": "Lie in a glute bridge, hips up, and walk your heels away in small steps until your legs are nearly straight, then back in.",
        "Towel leg curl": "On a smooth floor, lie on your back with a towel under your heels. Lift your hips and pull your heels in towards you, then slide them out.",
        "Single-leg towel leg curl": "The towel leg curl on one leg, the other in the air. Reps are per leg.",
        "Nordic lower, feet under the bed": "Kneel on something soft with your heels hooked under the bed. Lower your body forward as slowly as you can, catch yourself with your hands, push back up.",
        "Heel-tap dead bug": "On your back, knees bent above your hips, arms up. Lower one heel to tap the floor while your lower back stays pressed down. Reps are per side.",
        "Dead bug": "On your back, arms up, knees above your hips. Straighten one leg and lower the opposite arm, back pressed to the floor. Reps are per side.",
        "Slow dead bug": "The dead bug, taking three seconds each way.",
        "Copenhagen plank, knee on the bed": "Side plank on your elbow with your top knee on the edge of the bed and the bottom leg tucked under. Hold your hips up. Swap sides each set.",
        "Copenhagen plank, foot on the bed": "As before with your top leg straight and your foot on the bed: harder. Swap sides each set.",
        "Two-arm backpack row": "Fill a backpack with books. Hinge forward with a flat back and pull it to your belly.",
        "Superman raise": "Lie face down, arms forward. Lift your arms, chest and legs a little off the floor, hold a second, lower.",
        "Reverse snow angel": "Face down, arms by your sides and just off the floor. Sweep them overhead and back, like a snow angel.",
        "Prone Y raise": "Face down, arms forward in a Y, thumbs up. Lift your arms and chest, squeeze your shoulder blades, lower.",
        "Shrimp squat": "On one leg, holding the other foot behind you. Lower until your back knee touches the floor.",
        "Archer push-up": "Hands wide. Lower towards one hand while the other arm stays straight. Alternate sides.",
        "Long-lever plank": "A plank with your elbows further forward than your shoulders.",
        "Side-lying inner-thigh lift": "Lie on your side, top foot on the bed or a chair, and lift the bottom leg up to meet it. Hold. If your groin hurts, stop and tap Easier next time.",
        "Single-leg bridge, backpack on your hips": "The feet-raised single-leg bridge with a backpack of books resting on your hips.",
        "One-arm towel row, backpack on": "The one-arm towel row wearing a backpack of books.",
        "Backpack step-up onto a chair": "Step-ups onto a chair wearing a backpack of books. Reps are per leg.",
        "Backpack reverse lunge off a step": "Reverse lunges off a stair wearing a backpack of books. Reps are per leg.",
        "Bent-knee calf raise": "Stand with your knees bent about 30 degrees, a hand on the wall, and rise onto your toes. Keep the knees bent the whole time.",
        "Single-leg bent-knee calf raise": "As before on one leg. Reps are per leg.",
        "Single-leg bent-knee calf raise off a step": "On one leg on the edge of a stair, heel dropping below the step, knee bent. Reps are per leg.",
        "Side-lying leg raise": "Lie on your side, bottom knee bent. Lift the straight top leg a little behind you, toes pointing forward, and lower slowly. Reps are per side.",
        "Side-lying leg raise, 2 s at the top": "As before, holding two seconds at the top. Reps are per side.",
        "Side-plank leg raise": "In a side plank, lift the top leg and lower it. Reps are per side.",
        "Skipping on the spot": "Light, quick skips on the balls of your feet. Count each foot touching down.",
        "Pogo hops": "Small, quick two-footed hops with stiff ankles, like a bouncing spring. Count each landing. Stop before you get sloppy.",
        "Pogo hops, forward and back": "Pogo hops moving a few centimetres forward and back. Count each landing.",
        "Single-leg pogo hops": "Pogo hops on one leg. Only once the calf test reaches 25 on each leg. Count each landing.",
        "Short foot, sitting": "Feet flat, toes relaxed. Pull the ball of your foot towards your heel so the arch lifts, without curling your toes. Hold.",
        "Short foot, standing": "The short foot standing up. Hold.",
        "Short foot, on one leg": "The short foot standing on one leg. Hold.",
        "Toe yoga": "Lift your big toe while the others stay down, then swap: big toe down, others up. Each swap is one rep.",
        "Single-leg balance": "Stand on one leg, knee soft. Swap legs each set.",
        "Single-leg balance, eyes closed": "As before with your eyes closed, near a wall.",
        "Single-leg balance on a cushion": "Stand on one leg on a folded pillow or cushion.",
        "Single-leg calf raises, as many as you can": "One leg on the floor, a fingertip on the wall. Rise all the way up and down at a steady pace until you can't. First set left leg, second set right.",
    };
    const how = (variation) => HOW[variation] || null;

    // For the weekly report: which movement each exercise trains
    const PATTERN_NAMES = { push: "pushing", legs: "legs", hinge: "your back and hips", core: "your core", pull: "pulling" };
    const PATTERNS = {
        push: "push", dip: "push", bench: "push", ohp: "push",
        squat: "legs", calf: "legs", barsquat: "legs",
        back: "hinge", bridge: "hinge", deadlift: "hinge",
        beddip: "push", pike: "push", stepup: "legs", lunge: "legs", legcurl: "hinge",
        soleus: "legs", hops: "legs", hipabd: "hinge",
        plank: "core", sideplank: "core", hollow: "core", legraise: "core", deadbug: "core", copenhagen: "core",
        packrow: "pull", row: "pull", pull: "pull", barrow: "pull", curl: "pull", towelrow: "pull",
    };
    const patternOf = (id) => PATTERNS[id] || "other";

    const slug = (name) => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    // Your own exercise: bodyweight reps unless you say otherwise
    function custom(name, { weights = false, timed = false } = {}) {
        const title = name.trim();
        // Its own id, so a "Plank" of yours doesn't share history with the preset
        const id = `custom-${slug(title) || Date.now()}`;
        if (timed) return Object.assign(hold(id, title, null, 0), { ladder: undefined });
        if (weights) return lift(id, title, 2.5, 90);
        return Object.assign(ladder(id, title, null, 0, NO_EQUIPMENT, 8, 15), { ladder: undefined });
    }

    function roundTo(weight, step) {
        return step > 0 ? Math.max(step, Math.round(weight / step) * step) : weight;
    }

    // This exercise in each finished session, newest first
    function history(exerciseId, sessions) {
        return sessions.filter(s => s.activity === "strength" && s.endTime)
            .sort((a, b) => b.startTime - a.startTime)
            .map(s => (s.exercises || []).find(e => e.id === exerciseId))
            .filter(e => e && e.sets && e.sets.length);
    }

    const topWeight = (entry) => Math.max(...entry.sets.map(s => s.weight || 0));
    const targetReps = (entry) => Math.max(...entry.sets.map(s => s.target || 0));
    const fewestReps = (entry) => Math.min(...entry.sets.map(s => s.reps));

    function hit(entry, ex) {
        return entry.sets.length >= ex.sets && entry.sets.every(s => s.reps >= s.target);
    }

    // Every set you did reached its target, even if you skipped the rest
    const clean = (entry) => entry.sets.every(s => s.reps >= s.target);

    // [low, high] reps at a rung: most share the exercise's range, a hard last rung may not
    const range = (ex, level) => (ex.rungReps && ex.rungReps[level]) || [ex.repLow, ex.repHigh];

    const variationAt = (ex, level) => ex.ladder ? ex.ladder[Math.max(0, Math.min(level, ex.ladder.length - 1))] : null;

    // { weight (null: you pick), reps, sets, level, variation, unit, action, why }
    function target(ex, sessions, feel = "normal") {
        const past = history(ex.id, sessions);
        const step = ex.repStep || 1;
        const word = ex.unit === "s" ? "seconds" : "reps";
        const out = (weight, reps, level, action, why) => ({
            weight, reps, level, sets: ex.sets, unit: ex.unit, variation: variationAt(ex, level), action, why,
        });
        const startLevel = ex.level || 0;
        if (ex.test) return out(0, ex.repLow, 0, "test", "As many as you can, one leg each set. 25 or more is a good benchmark");
        if (!past.length) {
            return out(ex.stepKg > 0 ? null : 0, range(ex, startLevel)[0], startLevel, "first", ex.stepKg > 0 ? "First time: pick a weight you could lift a few more times"
                : ex.ladder ? "First time: tap Easier or Harder if this doesn't suit you" : "First time: see how it goes");
        }

        const last = past[0];
        const level = ex.ladder ? Math.min(last.level != null ? last.level : startLevel, ex.ladder.length - 1) : 0;
        const [low, high] = range(ex, level);
        const weight = topWeight(last), reps = targetReps(last) || low;
        const onLadder = !!ex.ladder;
        const top = onLadder && level === ex.ladder.length - 1;
        if (hit(last, ex)) {
            if (feel === "tired") return out(weight, reps, level, "hold", "Feeling tired: same as last time");
            const fewest = fewestReps(last);
            if (fewest >= high) {
                if (ex.stepKg > 0) return out(roundTo(weight + ex.stepKg, ex.stepKg), ex.repLow, level, "step", `Hit ${fewest} reps last time: up ${ex.stepKg} kg`);
                if (onLadder && !top) {
                    return out(0, range(ex, level + 1)[0], level + 1, "harder", `Mastered ${variationAt(ex, level)}: moving up`);
                }
                // More reps past here would train endurance, not strength
                if (top) {
                    return out(weight, high, level, "load", ex.unit === "s"
                        ? "Top of the ladder: same time, harder. Wear a backpack of books, or hold it lower"
                        : "Top of the ladder: same reps, harder. Wear a backpack of books, or take 3 seconds to lower");
                }
            }
            // You may have done more than asked: build on that
            const more = Math.max(reps, fewest) + step;
            const capped = ex.stepKg > 0 || onLadder ? Math.min(more, high) : more;
            return out(weight, capped, level, "rep", `Hit it last time: ${capped - reps} more ${capped - reps === 1 ? word.slice(0, -1) : word}`);
        }
        // Short of time isn't short of strength: no step up, but no step back either
        if (clean(last)) return out(weight, reps, level, "hold", "Not all sets last time: same again");
        // Misses in a row at this weight and variation
        let misses = 0;
        for (const e of past) {
            if (hit(e, ex) || topWeight(e) !== weight || (e.level != null && e.level !== last.level)) break;
            if (!clean(e)) misses++;
        }
        if (misses < 2) return out(weight, reps, level, "hold", "Just missed last time: same again");
        if (ex.stepKg > 0) return out(roundTo(weight * BACK_OFF, ex.stepKg), ex.repLow, level, "back", "Missed twice: easing off to build back up");
        if (onLadder && reps <= low && level > 0) {
            const [lo, hi] = range(ex, level - 1);
            const middle = Math.round((lo + hi) / 2 / step) * step;
            return out(0, middle, level - 1, "easier", `Missed twice: ${variationAt(ex, level - 1)} to build back up`);
        }
        const floor = onLadder ? Math.min(low, reps) : 1;
        return out(0, Math.max(floor, reps - 2 * step), level, "back", `Missed twice: fewer ${word} to build back up`);
    }

    // Moves a target up or down the ladder by hand. Null if there's nowhere to go.
    function change(ex, t, by) {
        if (!ex.ladder) return null;
        const level = t.level + by;
        if (level < 0 || level >= ex.ladder.length) return null;
        return Object.assign({}, t, { level, variation: ex.ladder[level], reps: range(ex, level)[0], action: "chosen", why: "" });
    }

    const spokenWeight = (kg) => `${kg} kilos`;

    function spokenSet(name, reps, weight, unit) {
        if (unit === "s") return `${name}. ${reps} seconds.`;
        return `${name}. ${reps} reps${weight > 0 ? ` at ${spokenWeight(weight)}` : ""}.`;
    }

    // What the voice says over a rest: [{ inMs, text }]. `next` is spokenSet(...),
    // or null after the last set. A timed hold starts when you tap, so it says so.
    function restCues(seconds, next, { nextIsHold = false } = {}) {
        const cues = [{ inMs: 0, text: `Rest ${seconds} seconds.${next ? ` Next: ${next}` : ""}` }];
        if (seconds > 20) cues.push({ inMs: (seconds - 10) * 1000, text: "10 seconds." });
        cues.push({ inMs: seconds * 1000, text: !next ? "Go." : nextIsHold ? `Get ready. ${next} Tap start.` : `Go. ${next}` });
        return cues;
    }

    // What the voice says through a timed hold
    function holdCues(seconds, name) {
        const cues = [{ inMs: 0, text: `${name}. ${seconds} seconds. Go.` }];
        if (seconds > 20) cues.push({ inMs: (seconds - 10) * 1000, text: "10 seconds." });
        cues.push({ inMs: seconds * 1000, text: "Stop." });
        return cues;
    }

    // Cues to follow others, `afterMs` later
    const after = (cues, afterMs) => cues.map(c => ({ inMs: c.inMs + afterMs, text: c.text }));

    // Estimated one-rep max (Epley)
    function oneRepMax(weight, reps) {
        return reps > 1 ? weight * (1 + reps / 30) : weight;
    }

    function volume(session) {
        return (session.exercises || []).reduce((sum, e) => sum + e.sets.reduce((a, s) => a + (s.weight || 0) * s.reps, 0), 0);
    }

    // Reps done, leaving out timed holds
    function totalReps(session) {
        return (session.exercises || []).filter(e => e.unit !== "s").reduce((sum, e) => sum + e.sets.reduce((a, s) => a + s.reps, 0), 0);
    }

    // Per exercise, newest activity first: { id, name, variation, level, levels, unit, sessions, weight, reps, best, change }.
    // `best` and `change` are estimated 1RM, for exercises with weights.
    function progress(sessions) {
        const seen = new Map();
        sessions.filter(s => s.activity === "strength" && s.endTime).sort((a, b) => a.startTime - b.startTime).forEach(s => {
            (s.exercises || []).forEach(e => {
                if (!e.sets.length) return;
                const est = Math.max(...e.sets.map(x => oneRepMax(x.weight || 0, x.reps)));
                const top = e.sets.reduce((a, b) => (b.weight || 0) > (a.weight || 0) || ((b.weight || 0) === (a.weight || 0) && b.reps > a.reps) ? b : a);
                const p = seen.get(e.id) || { id: e.id, first: est, best: 0, sessions: 0 };
                Object.assign(p, {
                    name: e.name, variation: e.variation, level: e.level, levels: e.levels, unit: e.unit,
                    sessions: p.sessions + 1, best: Math.max(p.best, est), latest: est,
                    weight: top.weight || 0, reps: top.reps, at: s.startTime,
                });
                seen.set(e.id, p);
            });
        });
        return [...seen.values()].sort((a, b) => b.at - a.at).map(p => Object.assign(p, { change: p.latest - p.first }));
    }

    // Seconds held, for sessions of timed holds
    function totalHeld(session) {
        return (session.exercises || []).filter(e => e.unit === "s").reduce((sum, e) => sum + e.sets.reduce((a, s) => a + s.reps, 0), 0);
    }

    return { PRESETS, GROUPS, DEFAULT_ROUTINES, EXTRA_ROUTINES, PLAN_VERSION, upgradeRoutines, freshen, range, upNext, how, PATTERN_NAMES, patternOf, custom, target, change, spokenSet, restCues, holdCues, after, oneRepMax, volume, totalReps, totalHeld, progress };
})();

if (typeof module !== "undefined") module.exports = StrengthPlanner;
