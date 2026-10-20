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
//  - Something happens every minute or so: a silly move, or a short speed
//    burst with a walk straight after it. The easy running in between stays
//    easy enough to chat; below the talk-test threshold exercise stays
//    pleasant for most people (Ekkekakis' dual-mode theory).
//  - The work comes from 15-20 s bursts at your best pace, each followed by a
//    walk to catch your breath. Short bursts are enjoyed more than long or
//    continuous hard efforts (Martinez et al. 2015), and are too short to
//    leave you wrecked.
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
    buttKicks: [15, "play", "Butt kicks", "Butt kicks! Flick your heels up towards your bum. {d}."],
    skip: [20, "play", "Skip!", "Skip like a kid! Big, bouncy skips for {d}. Nobody's judging."],
    naruto: [15, "play", "Naruto run", "Naruto run! Lean forward, arms straight back behind you, and go! {d}."],
    shoulderTaps: [10, "play", "Shoulder taps", "Shoulder taps! Left hand to your right shoulder, right hand to your left, over and over. Keep running! {d}."],
    airplane: [15, "play", "Airplane", "Airplane! Arms out wide like wings, and swoop side to side. {d}."],
    trex: [10, "play", "T-rex", "T-rex arms! Elbows tucked in, little claws up, and stomp along. {d}."],
    robot: [10, "play", "Robot", "Robot run! Stiff arms, stiff legs. Beep boop. {d}."],
    slowMo: [10, "play", "Slow motion", "Slow motion! Run like an action replay. Big, exaggerated, sloooow moves. {d}."],
    sideShuffle: [20, "play", "Side shuffle", "Side shuffle! Turn sideways and shuffle along. Switch sides halfway. {d}."],
    zigzag: [20, "play", "Zigzag", "Zigzag! Weave left and right around imaginary cones. {d}."],
    conductor: [10, "play", "Conductor", "Conduct the orchestra! Wave your arms like the music is playing just for you. {d}."],
    superhero: [20, "play", "Superhero", "Superhero posture! Run tall, chest proud, eyes on the horizon. {d}."],
    smile: [20, "play", "Smile run", "Smile run! Put on a big smile for {d}. Smiling runners run more relaxed. Feel your shoulders drop."],
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

const FUN_BURSTS = [
    ["Speed burst", "Speed burst! Your best pace for {d}. Go, go, go!"],
    ["Landmark!", "Landmark race! Pick a tree or a lamppost up ahead and race to it. About {d}. Go!"],
    ["Bus chase", "Bus chase! Your bus is pulling away. Catch it! {d}, go!"],
    ["Overtake!", "Overtake! Imagine a runner just ahead of you. Go past them! {d}, go!"],
    ["Fast feet", "Fast feet! The quickest steps you can, {d}. Go!"],
];

const FUN_WALKS = [
    "And walk. {d} to catch your breath. You earned it.",
    "Walk it off. Big breaths, shake out your arms. {d}.",
    "Walk. In through your nose, long breath out. {d}.",
    "Easy walk for {d}. Nice work!",
];

// Your best pace, short enough that it stays fun
function funBurst(sec, n) {
    const [label, say] = FUN_BURSTS[n % FUN_BURSTS.length];
    return scripted("stride", sec, "Your best pace, short and sharp", label, say.replace("{d}", spokenDuration(sec)));
}

function funWalk(sec, n) {
    return scripted("walk", sec, "Walk, catch your breath", "Walk", FUN_WALKS[n % FUN_WALKS.length].replace("{d}", spokenDuration(sec)));
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

// `game` is a longer mind game played once, halfway through
const FUN_THEMES = [
    { title: "Playground", moves: ["skip", "highKnees", "buttKicks", "airplane", "handsUp", "zigzag", "quickFeet"], game: "countSteps" },
    { title: "Treasure Hunt", moves: ["zigzag", "shoulderTaps", "handsUp", "airplane", "highFive", "quickFeet"], game: "colourHunt" },
    { title: "Anime Hero", moves: ["naruto", "ninja", "powerArms", "slowMo", "airPunch", "superhero"], game: "breathe" },
    { title: "Silly Run", moves: ["trex", "robot", "slowMo", "shoulderTaps", "sideShuffle", "buttKicks"] },
    { title: "Superhero", moves: ["superhero", "airplane", "powerArms", "naruto", "selfTalk", "airPunch"], game: "awe" },
    { title: "Party Run", moves: ["airPunch", "handsUp", "conductor", "robot", "skip", "smile", "shake"] },
];

const FUN_LEVELS = {
    // main: minutes between warm-up and cool-down; gap: easy seconds between challenges
    beginner: { main: w => 16 + w, gap: w => w <= 2 ? 75 : 60, burst: 15, walk: 30 },
    intermediate: { main: w => 22 + Math.round(w * 1.5), gap: w => w <= 2 ? 60 : 50, burst: 15, walk: 25 },
    expert: { main: w => 30 + w * 2, gap: () => 45, burst: 20, walk: 20 },
};

// Easy running with a challenge every round: moves and speed bursts (each
// followed by a walk) take turns, with the theme's game once, halfway.
function funSession(week, day, theme, level) {
    const L = FUN_LEVELS[level];
    const mainS = L.main(week) * 60, gap = L.gap(week);
    const segments = [
        scripted("warmup", 240, "Easy jog", "Warm up",
            `Welcome to ${theme.title}! Start with an easy jog, slow enough to chat. Walking is always allowed. ${spokenDuration(240)}.`),
        funMove("shake"),
    ];
    let used = 0, moves = 0, bursts = 0, gamePlayed = false;
    for (let i = 0; ; i++) {
        const round = [funCruise(gap, i)];
        if (i % 2 === 1) {
            round.push(funBurst(L.burst, bursts), funWalk(L.walk, bursts));
        } else if (theme.game && !gamePlayed && used >= mainS / 2) {
            round.push(funMove(theme.game));
        } else {
            // Each time a theme comes round, its moves start somewhere new
            round.push(funMove(theme.moves[(moves + week + day) % theme.moves.length]));
        }
        const len = round.reduce((sum, x) => sum + Math.round(x.duration * 60), 0);
        if (used + len > mainS + 30) break;
        segments.push(...round);
        used += len;
        if (i % 2 === 1) bursts++;
        else if (round[1].type === "run") gamePlayed = true;
        else moves++;
    }
    segments.push(funCruise(gap, 99));
    segments.push(scripted("play", 10, "By feel", "Victory!", "Victory finish! Both arms up, big smile. You did it!"));
    segments.push(scripted("cooldown", 180, "Easy jog", "Cool down",
        "Cool down. Walk or jog, your choice. Notice how good you feel right now, and remember it for next time."));

    const total = Math.round(segments.reduce((sum, x) => sum + x.duration, 0));
    return session(week, day, theme.title, "fun", `${total} min · ${moves} moves · ${bursts} speed bursts`, segments);
}

function funRunSessions(level) {
    const s = [];
    for (let w = 1; w <= 6; w++) {
        for (let d = 1; d <= 3; d++) {
            s.push(funSession(w, d, FUN_THEMES[((w - 1) * 3 + d - 1) % FUN_THEMES.length], level));
        }
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
        description: "Something every minute or so: Naruto runs, shoulder taps, airplanes, T-rex arms, and 15-20 second speed bursts at your best pace (race to a landmark, catch the bus) with a walk straight after to catch your breath. Easy, chatty running in between. Every session is different, and walking is always allowed.",
        levels: {
            beginner: {
                duration: 6, sessionsPerWeek: 3,
                description: "~24-30 min: a challenge every 75-90 s, 15 s bursts + 30 s walks",
                sessions: funRunSessions("beginner")
            },
            intermediate: {
                duration: 6, sessionsPerWeek: 3,
                description: "~32-39 min: a challenge every minute, 15 s bursts + 25 s walks",
                sessions: funRunSessions("intermediate")
            },
            expert: {
                duration: 6, sessionsPerWeek: 3,
                description: "~40-50 min: a challenge every 45 s, 20 s bursts + 20 s walks",
                sessions: funRunSessions("expert")
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
