// performance.js — Stats calculations and Chart.js rendering

function calcPaceTrend(runs, limit = 20) {
    const sorted = runs
        .filter(r => r.distance >= 500 && r.time > 0 && r.pace > 120 && r.pace < 1200)
        .sort((a, b) => a.startTime - b.startTime)
        .slice(-limit);
    return sorted.map(r => ({
        date: new Date(r.startTime).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        pace: r.pace / 60
    }));
}

// Distance per calendar week (Monday to Sunday), oldest first, ending with this week.
function calcWeeklyVolume(runs, weeks = 8, now = Date.now()) {
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
    const buckets = [];
    for (let i = weeks - 1; i >= 0; i--) {
        const start = new Date(monday);
        start.setDate(monday.getDate() - 7 * i);
        const end = new Date(start);
        end.setDate(start.getDate() + 7);
        const km = runs.filter(r => r.startTime >= start.getTime() && r.startTime < end.getTime())
            .reduce((sum, r) => sum + r.distance / 1000, 0);
        buckets.push({
            label: i === 0 ? "This week" : start.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            km: Math.round(km * 100) / 100
        });
    }
    return buckets;
}

// For each distance (km), the fastest stretch of that length inside any run:
// { run, startM, timeMs, even? }, or null if no run is that long.
function findBestEfforts(runs, distancesKm) {
    const bests = {};
    distancesKm.forEach(km => {
        let best = null;
        runs.forEach(r => {
            const e = RunAnalysis.runBestEffort(r, km * 1000);
            if (e && (!best || e.timeMs < best.timeMs)) best = Object.assign({ run: r }, e);
        });
        bests[km] = best;
    });
    return bests;
}

function calcPersonalBests(runs) {
    const efforts = findBestEfforts(runs, [1, 3, 5, 10]);
    const bests = {};
    Object.keys(efforts).forEach(km => {
        const e = efforts[km];
        bests[km] = e && {
            pace: e.timeMs / 1000 / km,
            date: new Date(e.run.startTime).toLocaleDateString(),
            distance: e.run.distance / 1000,
            time: e.timeMs / 1000,
        };
    });
    return bests;
}

function estimateVO2max(runs) {
    const candidates = runs.filter(r => {
        const mins = r.time / 60;
        return mins >= 10 && mins <= 15 && r.distance > 0;
    });
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.startTime - a.startTime);
    const best = candidates[0];
    const km12 = (best.distance / 1000) * (12 / (best.time / 60));
    return Math.round((22.351 * km12 - 11.288) * 10) / 10;
}

function formatPace(totalSeconds) {
    // Round first, or 299.8 s would show as "4:60"
    const total = Math.round(totalSeconds);
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
}

let paceChart = null;
let volumeChart = null;

function renderStats() {
    getAllRuns().then(runs => {
        if (runs.length === 0) {
            document.getElementById("stats-empty").style.display = "block";
            document.getElementById("stats-content").style.display = "none";
            return;
        }
        document.getElementById("stats-empty").style.display = "none";
        document.getElementById("stats-content").style.display = "block";

        renderPaceChart(runs);
        renderVolumeChart(runs);
        renderPersonalBests(runs);
        renderVO2max(runs);
        renderCourseProgress();
    });
}

function renderPaceChart(runs) {
    const data = calcPaceTrend(runs);
    const container = document.getElementById("pace-chart-container");
    let note = container.querySelector(".chart-note");
    if (!note) {
        note = document.createElement("p");
        note.className = "chart-note";
        note.textContent = "Need at least 2 runs to show pace trend.";
        container.appendChild(note);
    }
    const ctx = document.getElementById("paceChart");
    if (paceChart) { paceChart.destroy(); paceChart = null; }
    // Keep the canvas: hiding it (not replacing it) lets the chart come back later
    note.style.display = data.length < 2 ? "block" : "none";
    ctx.style.display = data.length < 2 ? "none" : "block";
    if (data.length < 2) return;
    paceChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: data.map(d => d.date),
            datasets: [{
                label: "Avg Pace (min/km)",
                data: data.map(d => d.pace),
                borderColor: "#3f51b5",
                fill: false,
                tension: 0.3,
                pointRadius: 4,
                pointBackgroundColor: "#3f51b5"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    reverse: true,
                    title: { display: true, text: "min/km" },
                    // Fit your own paces, so a 20 s/km improvement is visible
                    min: Math.floor(Math.min(...data.map(d => d.pace)) * 4 - 1) / 4,
                    max: Math.ceil(Math.max(...data.map(d => d.pace)) * 4 + 1) / 4,
                    ticks: {
                        callback: v => {
                            const m = Math.floor(v);
                            const s = Math.round((v - m) * 60);
                            return `${m}:${s.toString().padStart(2, "0")}`;
                        }
                    }
                }
            }
        }
    });
}

function renderVolumeChart(runs) {
    const data = calcWeeklyVolume(runs);
    const ctx = document.getElementById("volumeChart");
    if (volumeChart) volumeChart.destroy();
    volumeChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: data.map(d => d.label),
            datasets: [{
                label: "Weekly km",
                data: data.map(d => d.km),
                backgroundColor: "#e91e63",
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { title: { display: true, text: "km" }, beginAtZero: true }
            }
        }
    });
}

function renderPersonalBests(runs) {
    const bests = calcPersonalBests(runs);
    const container = document.getElementById("personal-bests");
    container.innerHTML = "";
    [1, 3, 5, 10].forEach(km => {
        const card = document.createElement("div");
        card.className = "pb-card";
        if (bests[km]) {
            card.innerHTML = `
                <div class="pb-distance">${km}K</div>
                <div class="pb-pace">${formatPace(bests[km].pace)} /km</div>
                <div class="pb-date">${bests[km].date}</div>`;
        } else {
            card.innerHTML = `
                <div class="pb-distance">${km}K</div>
                <div class="pb-pace">—</div>
                <div class="pb-date">No qualifying runs</div>`;
        }
        container.appendChild(card);
    });
}

function renderVO2max(runs) {
    const vo2 = estimateVO2max(runs);
    const el = document.getElementById("vo2max-value");
    if (vo2) {
        el.textContent = vo2;
        document.getElementById("vo2max-section").style.display = "block";
    } else {
        document.getElementById("vo2max-section").style.display = "none";
    }
}

// ─── Ghost Race Helpers ───────────────────────────────────────────────────────
// Binary-searched versions live in analysis.js; ghost series can now hold one
// point per GPS fix.

function getGhostDistanceAtTime(timeSeries, elapsedMs) {
    return RunAnalysis.distanceAtTime(timeSeries, elapsedMs);
}

function getGhostTimeAtDistance(timeSeries, distance) {
    return RunAnalysis.timeAtDistance(timeSeries, distance);
}

function getGhostPositionAtTime(timeSeries, elapsedMs) {
    if (!timeSeries || timeSeries.length === 0) return null;
    return RunAnalysis.pointAtDistance(timeSeries, RunAnalysis.distanceAtTime(timeSeries, elapsedMs));
}

function renderCourseProgress() {
    const container = document.getElementById("course-progress-stats");
    container.innerHTML = "";
    getActiveCourses().then(active => {
        if (active.length === 0) {
            container.innerHTML = "<p>No active courses.</p>";
            return;
        }
        active.forEach(prog => {
            const course = COURSES.find(c => c.id === prog.courseId);
            if (!course) return;
            const level = course.levels[prog.level];
            const total = level.sessions.length;
            const done = prog.completedSessions.length;
            const pct = Math.round((done / total) * 100);
            const div = document.createElement("div");
            div.className = "course-progress-stat";
            div.innerHTML = `
                <div class="cps-name">${course.icon} ${course.name} <span class="cps-level">${prog.level}</span></div>
                <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
                <div class="cps-detail">${done}/${total} sessions (${pct}%)</div>`;
            container.appendChild(div);
        });
    });
}
