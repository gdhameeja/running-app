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

// ─── Export ────────────────────────────────────────────────────────────────────

const COURSES = [
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
