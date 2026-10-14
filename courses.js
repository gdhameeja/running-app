// courses.js — 5 research-backed running courses × 3 difficulty levels

function seg(type, duration, intensity) {
    return { type, duration, intensity };
}

function warmup(min) { return seg("warmup", min, "Easy jog"); }
function cooldown(min) { return seg("cooldown", min, "Easy jog"); }
function easy(min) { return seg("run", min, "Conversational pace"); }
function tempo(min) { return seg("run", min, "Comfortably hard — short phrases only"); }
function sprint(sec) { return seg("sprint", sec / 60, "All-out effort"); }
function jog(sec) { return seg("jog", sec / 60, "Recovery jog"); }
function walk(min) { return seg("walk", min, "Brisk walk"); }
function rest(min) { return seg("rest", min, "Complete rest"); }

function repeat(n, ...segs) {
    const out = [];
    for (let i = 0; i < n; i++) out.push(...segs);
    return out;
}

function session(week, day, title, type, description, segments) {
    return { week, day, title, type, description, segments };
}

// ─── HIIT Sprint ───────────────────────────────────────────────────────────────

function hiitBeginnerSessions() {
    const s = [];
    for (let w = 1; w <= 6; w++) {
        const reps = Math.min(6 + Math.floor((w - 1) / 2), 8);
        const sprintSec = w <= 3 ? 20 : 25 + (w - 4) * 5;
        const restSec = 60;
        for (let d = 1; d <= 3; d++) {
            if (d === 2) {
                s.push(session(w, d, "Easy Recovery", "easy",
                    `${20 + w} min easy run`,
                    [warmup(5), easy(20 + w), cooldown(5)]));
            } else {
                s.push(session(w, d, `Sprint Intervals W${w}`, "intervals",
                    `${reps}× ${sprintSec}s sprint / ${restSec}s jog`,
                    [warmup(5), ...repeat(reps, sprint(sprintSec), jog(restSec)), cooldown(5)]));
            }
        }
    }
    return s;
}

function hiitIntermediateSessions() {
    const s = [];
    for (let w = 1; w <= 6; w++) {
        const shortReps = 10 + Math.min(Math.floor((w - 1) / 2), 2);
        for (let d = 1; d <= 4; d++) {
            if (d === 1) {
                s.push(session(w, d, `30/30 Intervals W${w}`, "intervals",
                    `${shortReps}× 30s sprint / 30s jog`,
                    [warmup(5), ...repeat(shortReps, sprint(30), jog(30)), cooldown(5)]));
            } else if (d === 2) {
                s.push(session(w, d, "Easy Run", "easy",
                    `${25 + w} min easy`,
                    [warmup(5), easy(25 + w), cooldown(5)]));
            } else if (d === 3) {
                const longIntMins = 2;
                const longReps = 3 + Math.floor((w - 1) / 2);
                s.push(session(w, d, `Long Intervals W${w}`, "intervals",
                    `${longReps}× ${longIntMins} min at 90% / 2 min jog`,
                    [warmup(5), ...repeat(longReps, seg("run", longIntMins, "90% max effort"), jog(120)), cooldown(5)]));
            } else {
                s.push(session(w, d, "Recovery Jog", "easy",
                    "20 min recovery",
                    [warmup(5), easy(20), cooldown(5)]));
            }
        }
    }
    return s;
}

function hiitExpertSessions() {
    const s = [];
    for (let w = 1; w <= 4; w++) {
        for (let d = 1; d <= 4; d++) {
            if (d === 1) {
                s.push(session(w, d, `4×4 VO2max W${w}`, "intervals",
                    "4× 4 min at 90-95% HRmax / 3 min recovery",
                    [warmup(10), ...repeat(4, seg("run", 4, "90-95% HRmax"), jog(180)), cooldown(5)]));
            } else if (d === 2) {
                s.push(session(w, d, "Easy Run", "easy",
                    `${30 + w * 2} min easy`,
                    [warmup(5), easy(30 + w * 2), cooldown(5)]));
            } else if (d === 3) {
                const tabataRounds = 6 + w;
                s.push(session(w, d, `Tabata W${w}`, "intervals",
                    `${tabataRounds}× 20s all-out / 10s rest`,
                    [warmup(10), ...repeat(tabataRounds, sprint(20), rest(10 / 60)), cooldown(10)]));
            } else {
                s.push(session(w, d, "Tempo + Strides", "tempo",
                    `${15 + w * 2} min tempo + 4 strides`,
                    [warmup(5), tempo(15 + w * 2), ...repeat(4, sprint(15), jog(60)), cooldown(5)]));
            }
        }
    }
    return s;
}

// ─── Fat Burn Zone 2 ───────────────────────────────────────────────────────────

function fatBurnBeginnerSessions() {
    const s = [];
    for (let w = 1; w <= 8; w++) {
        const duration = 20 + (w - 1) * 5;
        for (let d = 1; d <= 3; d++) {
            if (d === 2 && w >= 4) {
                s.push(session(w, d, `Walk/Run Mix W${w}`, "easy",
                    `${duration} min alternating 5 min run / 2 min walk`,
                    [warmup(5), ...repeat(Math.floor(duration / 7), easy(5), walk(2)), cooldown(5)]));
            } else {
                s.push(session(w, d, `Zone 2 Run W${w}`, "easy",
                    `${duration} min at 60-70% max HR`,
                    [warmup(5), seg("run", duration, "Zone 2: 60-70% max HR, can hold conversation"), cooldown(5)]));
            }
        }
    }
    return s;
}

function fatBurnIntermediateSessions() {
    const s = [];
    for (let w = 1; w <= 8; w++) {
        const z2Duration = 35 + Math.floor((w - 1) * 15 / 7);
        for (let d = 1; d <= 4; d++) {
            if (d === 3) {
                const tempoMin = 15 + Math.floor((w - 1) * 5 / 7);
                s.push(session(w, d, `Tempo Session W${w}`, "tempo",
                    `${tempoMin} min tempo`,
                    [warmup(10), tempo(tempoMin), cooldown(5)]));
            } else if (d === 4) {
                s.push(session(w, d, "Recovery", "easy",
                    "20 min easy",
                    [warmup(5), easy(20), cooldown(5)]));
            } else {
                s.push(session(w, d, `Zone 2 W${w}D${d}`, "easy",
                    `${z2Duration} min zone 2`,
                    [warmup(5), seg("run", z2Duration, "Zone 2: 60-70% max HR"), cooldown(5)]));
            }
        }
    }
    return s;
}

function fatBurnExpertSessions() {
    const s = [];
    for (let w = 1; w <= 6; w++) {
        const z2Duration = 45 + Math.floor((w - 1) * 15 / 5);
        for (let d = 1; d <= 5; d++) {
            if (d === 3) {
                s.push(session(w, d, `Interval Day W${w}`, "intervals",
                    "6× 2 min hard / 2 min easy",
                    [warmup(10), ...repeat(6, seg("run", 2, "85-90% effort"), jog(120)), cooldown(5)]));
            } else if (d === 5) {
                s.push(session(w, d, `Tempo Day W${w}`, "tempo",
                    `${20 + w * 3} min tempo`,
                    [warmup(10), tempo(20 + w * 3), cooldown(5)]));
            } else {
                s.push(session(w, d, `Zone 2 W${w}D${d}`, "easy",
                    `${z2Duration} min zone 2`,
                    [warmup(5), seg("run", z2Duration, "Zone 2: 60-70% max HR"), cooldown(5)]));
            }
        }
    }
    return s;
}

// ─── 5K Ready ──────────────────────────────────────────────────────────────────

function fiveKBeginnerSessions() {
    const s = [];
    for (let w = 1; w <= 8; w++) {
        const runMin = Math.min(1 + Math.floor((w - 1) * 4 / 7), 5);
        const walkMin = Math.max(3 - Math.floor((w - 1) / 2), 1);
        const totalMin = 20 + w * 2;
        const reps = Math.ceil(totalMin / (runMin + walkMin));
        for (let d = 1; d <= 3; d++) {
            if (w >= 6 && d === 3) {
                s.push(session(w, d, `Continuous Run W${w}`, "easy",
                    `${15 + (w - 6) * 5} min continuous`,
                    [warmup(5), easy(15 + (w - 6) * 5), cooldown(5)]));
            } else if (d === 2) {
                s.push(session(w, d, "Easy Day", "easy",
                    `${15 + w} min easy run`,
                    [warmup(5), easy(15 + w), cooldown(5)]));
            } else {
                s.push(session(w, d, `Walk/Run W${w}`, "easy",
                    `Run ${runMin} min / walk ${walkMin} min × ${reps}`,
                    [warmup(5), ...repeat(reps, easy(runMin), walk(walkMin)), cooldown(5)]));
            }
        }
    }
    return s;
}

function fiveKIntermediateSessions() {
    const s = [];
    for (let w = 1; w <= 6; w++) {
        for (let d = 1; d <= 4; d++) {
            if (d === 1) {
                s.push(session(w, d, "Easy Run", "easy",
                    `${25 + w * 2} min easy`,
                    [warmup(5), easy(25 + w * 2), cooldown(5)]));
            } else if (d === 2) {
                const reps = 5 + Math.floor((w - 1) / 2);
                s.push(session(w, d, `Intervals W${w}`, "intervals",
                    `${reps}× 400m hard / 200m jog (approx 90s/60s)`,
                    [warmup(10), ...repeat(reps, seg("run", 1.5, "Hard, 5K race pace"), jog(60)), cooldown(5)]));
            } else if (d === 3) {
                const tempoMin = 15 + w * 2;
                s.push(session(w, d, `Tempo W${w}`, "tempo",
                    `${tempoMin} min at threshold`,
                    [warmup(10), tempo(tempoMin), cooldown(5)]));
            } else {
                s.push(session(w, d, `Long Run W${w}`, "long",
                    `${30 + w * 3} min easy-moderate`,
                    [warmup(5), seg("run", 30 + w * 3, "Easy to moderate"), cooldown(5)]));
            }
        }
    }
    return s;
}

function fiveKExpertSessions() {
    const s = [];
    for (let w = 1; w <= 6; w++) {
        for (let d = 1; d <= 5; d++) {
            if (d === 1) {
                s.push(session(w, d, "Easy + Strides", "easy",
                    `${30 + w * 2} min easy + 6 strides`,
                    [warmup(5), easy(30 + w * 2), ...repeat(6, sprint(20), jog(60)), cooldown(5)]));
            } else if (d === 2) {
                const reps = 4 + Math.floor(w / 2);
                s.push(session(w, d, `VO2max W${w}`, "intervals",
                    `${reps}× 3 min at 95-100% 5K pace / 2 min jog`,
                    [warmup(10), ...repeat(reps, seg("run", 3, "VO2max: 95-100% 5K pace"), jog(120)), cooldown(5)]));
            } else if (d === 3) {
                s.push(session(w, d, "Recovery", "easy",
                    "25 min easy",
                    [warmup(5), easy(25), cooldown(5)]));
            } else if (d === 4) {
                s.push(session(w, d, `Race Pace W${w}`, "tempo",
                    `${3 + Math.floor(w / 2)}× 1km at goal 5K pace / 90s rest`,
                    [warmup(10), ...repeat(3 + Math.floor(w / 2), seg("run", 4.5, "Goal 5K race pace"), jog(90)), cooldown(5)]));
            } else {
                s.push(session(w, d, `Long Run W${w}`, "long",
                    `${40 + w * 3} min progressive`,
                    [warmup(5), seg("run", 40 + w * 3, "Start easy, finish at marathon pace"), cooldown(5)]));
            }
        }
    }
    return s;
}

// ─── Tempo Builder ─────────────────────────────────────────────────────────────

function tempoBeginnerSessions() {
    const s = [];
    for (let w = 1; w <= 6; w++) {
        for (let d = 1; d <= 3; d++) {
            if (d === 1) {
                if (w <= 3) {
                    const reps = 4;
                    const tempoMin = 4 + w;
                    s.push(session(w, d, `Broken Tempo W${w}`, "tempo",
                        `${reps}× ${tempoMin} min tempo / 2 min jog`,
                        [warmup(5), ...repeat(reps, tempo(tempoMin), jog(120)), cooldown(5)]));
                } else {
                    const contMin = 12 + (w - 3) * 4;
                    s.push(session(w, d, `Continuous Tempo W${w}`, "tempo",
                        `${contMin} min continuous tempo`,
                        [warmup(10), tempo(contMin), cooldown(5)]));
                }
            } else if (d === 2) {
                s.push(session(w, d, "Easy Run", "easy",
                    `${25 + w * 2} min easy`,
                    [warmup(5), easy(25 + w * 2), cooldown(5)]));
            } else {
                s.push(session(w, d, `Fartlek W${w}`, "intervals",
                    `${20 + w * 2} min fartlek (surge when you feel it)`,
                    [warmup(5), seg("run", 20 + w * 2, "Fartlek: alternate easy/hard by feel"), cooldown(5)]));
            }
        }
    }
    return s;
}

function tempoIntermediateSessions() {
    const s = [];
    for (let w = 1; w <= 6; w++) {
        for (let d = 1; d <= 4; d++) {
            if (d === 1) {
                const tempoMin = 25 + Math.floor((w - 1) * 10 / 5);
                s.push(session(w, d, `Tempo W${w}`, "tempo",
                    `${tempoMin} min continuous tempo`,
                    [warmup(10), tempo(tempoMin), cooldown(5)]));
            } else if (d === 2) {
                s.push(session(w, d, "Easy Run", "easy",
                    `${30 + w} min easy`,
                    [warmup(5), easy(30 + w), cooldown(5)]));
            } else if (d === 3) {
                const reps = 6 + Math.floor((w - 1) / 2);
                s.push(session(w, d, `Interval Day W${w}`, "intervals",
                    `${reps}× 2 min hard / 90s jog`,
                    [warmup(10), ...repeat(reps, seg("run", 2, "Hard, 3K-5K effort"), jog(90)), cooldown(5)]));
            } else {
                s.push(session(w, d, "Recovery Jog", "easy",
                    "25 min easy",
                    [warmup(5), easy(25), cooldown(5)]));
            }
        }
    }
    return s;
}

function tempoExpertSessions() {
    const s = [];
    for (let w = 1; w <= 4; w++) {
        for (let d = 1; d <= 4; d++) {
            if (d === 1) {
                const tempoMin = 40 + w * 3;
                s.push(session(w, d, `Long Tempo W${w}`, "tempo",
                    `${tempoMin} min tempo`,
                    [warmup(10), tempo(tempoMin), cooldown(5)]));
            } else if (d === 2) {
                s.push(session(w, d, "Easy + Strides", "easy",
                    `${35 + w * 2} min easy + strides`,
                    [warmup(5), easy(35 + w * 2), ...repeat(5, sprint(20), jog(60)), cooldown(5)]));
            } else if (d === 3) {
                const reps = 5 + w;
                s.push(session(w, d, `Cruise Intervals W${w}`, "intervals",
                    `${reps}× ~1 mile at threshold / 60s rest`,
                    [warmup(10), ...repeat(reps, seg("run", 6, "Threshold pace — like tempo but broken"), rest(1)), cooldown(5)]));
            } else {
                s.push(session(w, d, `Long Run W${w}`, "long",
                    `${50 + w * 5} min easy with last 15 min at tempo`,
                    [warmup(5), easy(30 + w * 5), tempo(15), cooldown(5)]));
            }
        }
    }
    return s;
}

// ─── Endurance 10K ─────────────────────────────────────────────────────────────

function enduranceBeginnerSessions() {
    const s = [];
    for (let w = 1; w <= 10; w++) {
        const baseMin = 15 + w * 3;
        for (let d = 1; d <= 3; d++) {
            if (d === 1) {
                if (w <= 4) {
                    const runMin = 2 + w;
                    const walkMin = Math.max(3 - Math.floor(w / 2), 1);
                    const reps = Math.ceil(baseMin / (runMin + walkMin));
                    s.push(session(w, d, `Walk/Run W${w}`, "easy",
                        `Run ${runMin} min / walk ${walkMin} min × ${reps}`,
                        [warmup(5), ...repeat(reps, easy(runMin), walk(walkMin)), cooldown(5)]));
                } else {
                    s.push(session(w, d, `Continuous Run W${w}`, "easy",
                        `${baseMin} min continuous`,
                        [warmup(5), easy(baseMin), cooldown(5)]));
                }
            } else if (d === 2) {
                s.push(session(w, d, "Easy Day", "easy",
                    `${20 + w} min easy`,
                    [warmup(5), easy(20 + w), cooldown(5)]));
            } else {
                const longMin = baseMin + 5;
                s.push(session(w, d, `Long Run W${w}`, "long",
                    `${longMin} min at easy pace`,
                    [warmup(5), easy(longMin), cooldown(5)]));
            }
        }
    }
    return s;
}

function enduranceIntermediateSessions() {
    const s = [];
    for (let w = 1; w <= 8; w++) {
        for (let d = 1; d <= 4; d++) {
            if (d === 1) {
                s.push(session(w, d, "Easy Run", "easy",
                    `${30 + w * 2} min easy`,
                    [warmup(5), easy(30 + w * 2), cooldown(5)]));
            } else if (d === 2) {
                const tempoMin = 15 + w * 2;
                s.push(session(w, d, `Tempo W${w}`, "tempo",
                    `${tempoMin} min tempo`,
                    [warmup(10), tempo(tempoMin), cooldown(5)]));
            } else if (d === 3) {
                const reps = 5 + Math.floor(w / 2);
                s.push(session(w, d, `Intervals W${w}`, "intervals",
                    `${reps}× 90s hard / 90s jog`,
                    [warmup(10), ...repeat(reps, seg("run", 1.5, "Hard effort"), jog(90)), cooldown(5)]));
            } else {
                const longMin = 40 + w * 5;
                s.push(session(w, d, `Long Run W${w}`, "long",
                    `${longMin} min easy`,
                    [warmup(5), seg("run", longMin, "Easy pace, build endurance"), cooldown(5)]));
            }
        }
    }
    return s;
}

function enduranceExpertSessions() {
    const s = [];
    for (let w = 1; w <= 6; w++) {
        for (let d = 1; d <= 5; d++) {
            if (d === 1) {
                s.push(session(w, d, "Easy + Strides", "easy",
                    `${35 + w * 2} min easy + strides`,
                    [warmup(5), easy(35 + w * 2), ...repeat(6, sprint(20), jog(60)), cooldown(5)]));
            } else if (d === 2) {
                const reps = 5 + w;
                s.push(session(w, d, `VO2max Intervals W${w}`, "intervals",
                    `${reps}× 2 min at 95% / 2 min jog`,
                    [warmup(10), ...repeat(reps, seg("run", 2, "VO2max: 95% effort"), jog(120)), cooldown(5)]));
            } else if (d === 3) {
                s.push(session(w, d, "Recovery", "easy",
                    "30 min easy",
                    [warmup(5), easy(30), cooldown(5)]));
            } else if (d === 4) {
                const tempoMin = 25 + w * 3;
                s.push(session(w, d, `Race Pace W${w}`, "tempo",
                    `${tempoMin} min at goal 10K pace`,
                    [warmup(10), seg("run", tempoMin, "Goal 10K race pace"), cooldown(5)]));
            } else {
                const longMin = 55 + w * 5;
                s.push(session(w, d, `Long Run W${w}`, "long",
                    `${longMin} min with negative splits`,
                    [warmup(5), seg("run", Math.floor(longMin * 0.6), "Easy pace"), seg("run", Math.ceil(longMin * 0.4), "Marathon to half-marathon pace"), cooldown(5)]));
            }
        }
    }
    return s;
}

// ─── Fun Run ───────────────────────────────────────────────────────────────────
// Built to be enjoyed, never dreaded, and still a real workout:
//  - The running in between stays easy enough to chat. Below the talk-test
//    threshold exercise stays pleasant for most people (Ekkekakis' dual-mode
//    theory); above it, pleasure drops.
//  - The work comes from 10-30 s bursts (games, drills, strides), never
//    all-out. Short bursts are enjoyed more than long or continuous hard
//    efforts (Martinez et al. 2015), and strides build speed with little fatigue.
//  - Every session is different (variety predicts sticking with exercise,
//    Sylvester et al. 2016), and there are choices: you pick the landmark.
//  - Smiling (Brick et al. 2018), self-talk (Blanchfield et al. 2014) and
//    looking outward (Sturm et al. 2020) make effort feel easier.
//  - Sessions finish gently with a celebration: how a session ends shapes how
//    you remember it (Zenko, Ekkekakis & Ariely 2016).

function spokenDuration(sec) {
    if (sec < 60) return `${sec} seconds`;
    const m = Math.floor(sec / 60), r = sec % 60;
    const mins = `${m} minute${m > 1 ? "s" : ""}`;
    return r ? `${mins} ${r} seconds` : mins;
}

// A segment with its own label for the screen and its own words to speak.
function scripted(type, sec, intensity, label, say) {
    return Object.assign(seg(type, sec / 60, intensity), { label, say });
}

// key: [seconds, type, label, what the coach says ({d} = duration)]
const FUN_MOVES = {
    handsUp: [10, "play", "Hands up!", "Hands up! Throw both arms up in the air like you just won something. Hold them high for {d}."],
    powerArms: [20, "play", "Power arms", "Power arms! Pump your arms strong and fast and let your legs follow. {d}."],
    quickFeet: [15, "play", "Quick feet", "Quick feet! Tiny, fast, light steps, like the ground is hot. {d}."],
    highKnees: [15, "play", "High knees", "High knees! Lift those knees, light and bouncy. {d}."],
    skip: [20, "play", "Skip!", "Skip like a kid! Big, bouncy skips for {d}. Nobody's judging."],
    superhero: [30, "play", "Superhero", "Superhero posture! Run tall, chest proud, eyes on the horizon. {d}."],
    smile: [30, "play", "Smile run", "Smile run! Put on a big smile for {d}. Smiling runners run more relaxed. Feel your shoulders drop."],
    shake: [10, "play", "Shake it out", "Shake it out! Wiggle your hands and shoulders loose. {d}."],
    ninja: [20, "play", "Ninja feet", "Ninja feet! Run as quietly as you can. Soft, silent landings for {d}."],
    airPunch: [10, "play", "Air punches", "Air punches! Throw a few quick punches at the sky as you jog. {d}."],
    selfTalk: [20, "play", "Say it!", "Say it out loud, or in your head: I am strong. I've got this. And again! {d}."],
    highFive: [10, "play", "High five", "Give yourself a high five! Clap your hands. You're doing great."],
    colourHunt: [60, "run", "Colour hunt", "Colour hunt! Keep jogging easy and spot five red things in the next minute. Go!"],
    awe: [45, "run", "Look around", "Look up and around. Find the most beautiful thing you can see right now, and take it in."],
    countSteps: [30, "run", "Count steps", "Counting game! Count your steps up to thirty, then start again. Out loud if nobody's around."],
    breathe: [45, "run", "Breathe", "Breathing game. Breathe in for three steps, out for three steps. Find the rhythm."],
};

function funMove(key) {
    const [sec, type, label, say] = FUN_MOVES[key];
    return scripted(type, sec, "By feel", label, say.replace("{d}", spokenDuration(sec)));
}

// Fast but relaxed, never a sprint
function funStride(sec, n) {
    const says = [
        `Stride! Build up smoothly to fast and relaxed, like you're flying, not fighting. ${spokenDuration(sec)}.`,
        `Landmark game! Pick a tree or a lamppost up ahead and run to it, fast but relaxed. About ${spokenDuration(sec)}, you choose.`,
        `Stride! Quick and smooth for ${spokenDuration(sec)}. Eight out of ten, not all out.`,
    ];
    return scripted("stride", sec, "Fast but relaxed", n % 3 === 1 ? "Landmark!" : "Stride", says[n % says.length]);
}

const CRUISE_LINES = [
    "Back to easy running. Chatty pace.",
    "Easy cruise. Enjoy the view.",
    "Settle into your easy rhythm.",
    "Easy jog. Walking is fine too.",
    "Nice. Relax your shoulders and cruise.",
    "Cruise. Breathe easy.",
];

function funCruise(sec, n) {
    return scripted("run", sec, "Easy, chatty pace", "Easy cruise", `${CRUISE_LINES[n % CRUISE_LINES.length]} ${spokenDuration(sec)}.`);
}

const FUN_THEMES = [
    { title: "Playground", moves: ["skip", "highKnees", "handsUp", "quickFeet", "highFive", "shake"] },
    { title: "Treasure Hunt", moves: ["colourHunt", "handsUp", "awe", "countSteps", "highFive", "quickFeet"] },
    { title: "Smile Miles", moves: ["smile", "selfTalk", "shake", "breathe", "highFive", "handsUp"] },
    { title: "Ninja Run", moves: ["ninja", "quickFeet", "powerArms", "shake", "ninja", "highFive"] },
    { title: "Superhero", moves: ["superhero", "powerArms", "handsUp", "selfTalk", "airPunch", "smile"] },
    { title: "Party Run", moves: ["airPunch", "handsUp", "skip", "smile", "highFive", "shake"] },
];

// mainMin of easy running sprinkled with `games` moves and `strides` strides.
function funSession(week, day, theme, mainMin, games, strides, strideSec) {
    const items = [];
    // Each time a theme comes round, its moves start somewhere new
    for (let i = 0; i < games; i++) items.push(funMove(theme.moves[(i + week) % theme.moves.length]));
    // Spread the strides through the middle, never right at the end
    for (let k = 0; k < strides; k++) {
        const at = Math.round((k + 1) * items.length / (strides + 1)) + k;
        items.splice(Math.min(at, items.length - 1), 0, funStride(strideSec, k));
    }
    const busySec = items.reduce((sum, x) => sum + Math.round(x.duration * 60), 0);
    const gap = Math.max(60, Math.round((mainMin * 60 - busySec) / (items.length + 1) / 15) * 15);

    const segments = [
        scripted("warmup", 240, "Easy jog", "Warm up",
            `Welcome to ${theme.title}! Start with an easy jog, slow enough to chat. Walking is always allowed. ${spokenDuration(240)}.`),
        funMove("shake"),
    ];
    items.forEach((x, i) => { segments.push(funCruise(gap, i)); segments.push(x); });
    segments.push(funCruise(gap, items.length));
    segments.push(scripted("play", 10, "By feel", "Victory!", "Victory finish! Both arms up, big smile. You did it!"));
    segments.push(scripted("cooldown", 180, "Easy jog", "Cool down",
        "Cool down. Walk or jog, your choice. Notice how good you feel right now, and remember it for next time."));

    const total = Math.round(segments.reduce((sum, x) => sum + x.duration, 0));
    const desc = `${total} min · ${games} games${strides ? ` · ${strides} strides` : ""}`;
    return session(week, day, theme.title, "fun", desc, segments);
}

function funRunSessions(level) {
    const s = [];
    for (let w = 1; w <= 6; w++) {
        for (let d = 1; d <= 3; d++) {
            const theme = FUN_THEMES[((w - 1) * 3 + d - 1) % FUN_THEMES.length];
            if (level === "beginner") {
                s.push(funSession(w, d, theme, 16 + w, 5 + Math.floor(w / 2), w <= 2 ? 0 : w <= 4 ? 2 : 3, 20));
            } else if (level === "intermediate") {
                s.push(funSession(w, d, theme, 22 + Math.round(w * 1.5), 7 + Math.floor(w / 2), 3 + Math.floor(w / 3), 25));
            } else {
                s.push(funSession(w, d, theme, 30 + w * 2, 8 + Math.floor(w / 2), 5 + Math.floor(w / 3), 30));
            }
        }
    }
    return s;
}

// ─── Tune-In ───────────────────────────────────────────────────────────────────
// Coached by how it feels: see coach.js. Each coached segment has a target
// effort (1-5, talk-test anchored); the coach asks, nudges and adapts.

function tuneIn(type, min, target, label, say, surges = false) {
    return Object.assign(seg(type, min, `Aim for a ${target}: ${EFFORT_ANCHORS[target]}`), { label, say, target, surges });
}

function tuneWarmup(min) {
    return tuneIn("warmup", min, 2, "Warm up",
        `Warm up easy. Aim for a 2: ${EFFORT_ANCHORS[2]}. Every minute or so I'll ask how hard it feels, from 1, ${EFFORT_ANCHORS[1]}, to 5, ${EFFORT_ANCHORS[5]}. Tap the number on screen.`);
}

function tuneCooldown(min) {
    return scripted("cooldown", min * 60, "Easy jog", "Cool down",
        "Cool down. Walk or jog, whatever feels good. No more check-ins: the work is done.");
}

function tuneInSessions(level) {
    const s = [];
    const weeks = 4;
    for (let w = 1; w <= weeks; w++) {
        const main = level === "beginner" ? 12 + 2 * w : level === "intermediate" ? 20 + 3 * w : 28 + 4 * w;
        const kinds = level === "beginner" ? ["sweet", "easy", "waves"] : ["sweet", "waves", "build"];
        kinds.forEach((kind, i) => {
            const d = i + 1;
            if (kind === "sweet") {
                s.push(session(w, d, "Sweet Spot", "tune", `${main} min at a 3, coached by feel`,
                    [tuneWarmup(5), tuneIn("run", main, 3, "Sweet spot",
                        `Main set. Aim for a 3: ${EFFORT_ANCHORS[3]}. When I ask, tell me honestly. I'll do the rest.`), tuneCooldown(5)]));
            } else if (kind === "easy") {
                s.push(session(w, d, "Easy Flow", "tune", `${main} min at a 2, coached by feel`,
                    [tuneWarmup(5), tuneIn("run", main, 2, "Easy flow",
                        `Easy day. Aim for a 2: ${EFFORT_ANCHORS[2]}. If it's ever more than that, I'll slow you down.`), tuneCooldown(3)]));
            } else if (kind === "waves") {
                s.push(session(w, d, "Waves", "tune", `${main} min at a 3 with surges that adapt to you`,
                    [tuneWarmup(5), tuneIn("run", main, 3, "Waves",
                        `Waves. Steady running at a 3, ${EFFORT_ANCHORS[3]}, with short surges when you're coping well. Your answers decide how long they are.`, true), tuneCooldown(5)]));
            } else {
                const third = Math.round(main / 3);
                s.push(session(w, d, "Build", "tune", `${third * 3} min building from a 2 to a 4`,
                    [tuneWarmup(5),
                        tuneIn("run", third, 2, "Build: easy", `Build run. First part: aim for a 2, ${EFFORT_ANCHORS[2]}.`),
                        tuneIn("run", third, 3, "Build: steady", `Step it up. Aim for a 3: ${EFFORT_ANCHORS[3]}.`),
                        tuneIn("run", third, 4, "Build: strong", `Last part. Aim for a 4: ${EFFORT_ANCHORS[4]}. You're nearly there.`),
                        tuneCooldown(5)]));
            }
        });
    }
    return s;
}

// ─── Export ────────────────────────────────────────────────────────────────────

const COURSES = [
    {
        id: "fun-run",
        name: "Fun Run",
        icon: "🎉",
        shortDescription: "Playful runs you'll look forward to",
        description: "Easy, chatty running sprinkled with games and moves: hands in the air, skips, ninja feet, colour hunts, landmark strides. The bursts are short and never all-out, so it's a real workout that never feels scary. Every session is different, and walking is always allowed.",
        levels: {
            beginner: {
                duration: 6, sessionsPerWeek: 3,
                description: "~25-30 min: 5-8 games, strides from week 3",
                sessions: funRunSessions("beginner")
            },
            intermediate: {
                duration: 6, sessionsPerWeek: 3,
                description: "~32-40 min: 7-10 games and 3-5 strides",
                sessions: funRunSessions("intermediate")
            },
            expert: {
                duration: 6, sessionsPerWeek: 3,
                description: "~40-52 min: 8-11 games and 5-7 strides",
                sessions: funRunSessions("expert")
            }
        }
    },
    {
        id: "tune-in",
        name: "Tune-In Runs",
        icon: "🎚️",
        shortDescription: "The run that listens to you",
        description: "Every minute or so the coach asks how hard it feels, from 1 (you could sing) to 5 (you can't talk). Tell it you're maxed and it backs off straight away; tell it it's too easy and it pushes you, and adds surges when you're coping. Tap the number on the run screen, or Too easy / Just right / Too hard in the notification.",
        levels: {
            beginner: {
                duration: 4, sessionsPerWeek: 3,
                description: "14-20 min main sets: sweet spot, easy flow, waves",
                sessions: tuneInSessions("beginner")
            },
            intermediate: {
                duration: 4, sessionsPerWeek: 3,
                description: "23-32 min main sets: sweet spot, waves, build",
                sessions: tuneInSessions("intermediate")
            },
            expert: {
                duration: 4, sessionsPerWeek: 3,
                description: "32-44 min main sets: sweet spot, waves, build",
                sessions: tuneInSessions("expert")
            }
        }
    },
    {
        id: "hiit-sprint",
        name: "HIIT Sprint",
        icon: "⚡",
        shortDescription: "Speed & VO2max training",
        description: "Based on NASM interval programming. Progressive work:rest ratios from 1:3 to 1:1 build speed and aerobic capacity.",
        levels: {
            beginner: {
                duration: 6, sessionsPerWeek: 3,
                description: "20s sprint / 60s jog × 6-8 reps, building to 30s/60s × 10",
                sessions: hiitBeginnerSessions()
            },
            intermediate: {
                duration: 6, sessionsPerWeek: 4,
                description: "30s sprint / 30s jog × 10-12, plus 2-min intervals at 90% effort",
                sessions: hiitIntermediateSessions()
            },
            expert: {
                duration: 4, sessionsPerWeek: 4,
                description: "4×4 min at 90-95% HRmax, Tabata-style 20s/10s sets",
                sessions: hiitExpertSessions()
            }
        }
    },
    {
        id: "fat-burn",
        name: "Fat Burn Zone 2",
        icon: "🔥",
        shortDescription: "Aerobic base & fat oxidation",
        description: "Based on 80/20 training. Zone 2 (60-70% max HR) maximises fat oxidation — 60-80% of calories from fat.",
        levels: {
            beginner: {
                duration: 8, sessionsPerWeek: 3,
                description: "20-30 min easy runs, +5 min/week",
                sessions: fatBurnBeginnerSessions()
            },
            intermediate: {
                duration: 8, sessionsPerWeek: 4,
                description: "35-50 min zone 2 + 1 tempo session/week",
                sessions: fatBurnIntermediateSessions()
            },
            expert: {
                duration: 6, sessionsPerWeek: 5,
                description: "45-60 min zone 2 + 2 high-intensity sessions/week",
                sessions: fatBurnExpertSessions()
            }
        }
    },
    {
        id: "5k-ready",
        name: "5K Ready",
        icon: "🏁",
        shortDescription: "Race preparation for 5K",
        description: "Based on Hal Higdon's proven periodization. Progresses from walk/run intervals to continuous 5K racing.",
        levels: {
            beginner: {
                duration: 8, sessionsPerWeek: 3,
                description: "Walk/run intervals → continuous 5K",
                sessions: fiveKBeginnerSessions()
            },
            intermediate: {
                duration: 6, sessionsPerWeek: 4,
                description: "Easy runs + intervals + tempo + long run structure",
                sessions: fiveKIntermediateSessions()
            },
            expert: {
                duration: 6, sessionsPerWeek: 5,
                description: "VO2max intervals, threshold work, race-pace sessions",
                sessions: fiveKExpertSessions()
            }
        }
    },
    {
        id: "tempo-builder",
        name: "Tempo Builder",
        icon: "🎯",
        shortDescription: "Lactate threshold training",
        description: "Tempo pace = comfortably hard (short phrases only). Builds from broken tempo segments to sustained threshold runs.",
        levels: {
            beginner: {
                duration: 6, sessionsPerWeek: 3,
                description: "Broken tempo (4×5 min / 2 min jog) → 20 min continuous",
                sessions: tempoBeginnerSessions()
            },
            intermediate: {
                duration: 6, sessionsPerWeek: 4,
                description: "25-35 min continuous tempo + interval sessions",
                sessions: tempoIntermediateSessions()
            },
            expert: {
                duration: 4, sessionsPerWeek: 4,
                description: "40-50 min tempo, cruise intervals at threshold",
                sessions: tempoExpertSessions()
            }
        }
    },
    {
        id: "endurance-10k",
        name: "Endurance 10K",
        icon: "🏔️",
        shortDescription: "Distance building to 10K",
        description: "10% weekly mileage increase rule for safe distance building. Progresses from 3K to confident 10K racing.",
        levels: {
            beginner: {
                duration: 10, sessionsPerWeek: 3,
                description: "Build from 3K to 10K via run/walk → continuous",
                sessions: enduranceBeginnerSessions()
            },
            intermediate: {
                duration: 8, sessionsPerWeek: 4,
                description: "25-40 km/week with long run + tempo + intervals",
                sessions: enduranceIntermediateSessions()
            },
            expert: {
                duration: 6, sessionsPerWeek: 5,
                description: "40-55 km/week, race-pace work, negative splits",
                sessions: enduranceExpertSessions()
            }
        }
    }
];
