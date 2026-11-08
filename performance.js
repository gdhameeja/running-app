// performance.js — Stats calculations and Chart.js rendering

function calcPaceTrend(runs, limit = 20) {
    const sorted = runs
        .filter(r => !r.activity && r.distance >= 500 && r.time > 0 && r.pace >= RunAnalysis.MIN_PACE && r.pace < 1200)
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
        const km = runs.filter(r => !r.activity && r.startTime >= start.getTime() && r.startTime < end.getTime())
            .reduce((sum, r) => sum + r.distance / 1000, 0);
        buckets.push({
            label: i === 0 ? "This week" : start.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            km: Math.round(km * 100) / 100
        });
    }
    return buckets;
}

// Since Monday, everything counted: { runs, runKm, walks, walkKm, workouts }
function weekSoFar(runs, now = Date.now()) {
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
    const week = runs.filter(r => r.endTime && r.startTime >= monday.getTime());
    const kind = (activity) => week.filter(r => r.activity === activity);
    const km = (list) => list.reduce((sum, r) => sum + r.distance / 1000, 0);
    const running = week.filter(r => !r.activity);
    return { runs: running.length, runKm: km(running), walks: kind("walk").length, walkKm: km(kind("walk")), workouts: kind("strength").length };
}

// For each distance (km), the fastest stretch of that length inside any run:
// { run, startM, timeMs, even? }, or null if no run is that long.
function findBestEfforts(runs, distancesKm) {
    const bests = {};
    distancesKm.forEach(km => {
        let best = null;
        runs.filter(r => !r.activity).forEach(r => {
            const e = RunAnalysis.runBestEffort(r, km * 1000);
            // A stretch in a car you forgot to stop for isn't a PB
            if (!e || e.timeMs / 1000 / km < RunAnalysis.MIN_PACE) return;
            if (!best || e.timeMs < best.timeMs) best = Object.assign({ run: r }, e);
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

function formatPace(totalSeconds) {
    // Round first, or 299.8 s would show as "4:60"
    const total = Math.round(totalSeconds);
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
}

let volumeChart = null;

// The Stats tab itself is drawn by stats-ui.js; these are the parts it reuses.

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
                backgroundColor: "#2a78d6",
                borderRadius: 4,
                barPercentage: 0.8
            }]
        },
        options: {
            animation: false,
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
    const vo2 = RunAnalysis.vo2max(runs);
    const el = document.getElementById("vo2max-value");
    if (vo2) {
        el.textContent = vo2;
        document.getElementById("vo2max-section").style.display = "block";
        // Fitness age, once you've given your birth year and sex in a weekly report
        const note = document.querySelector("#vo2max-section .vo2max-note");
        WeekReport.profile().then(me => {
            const f = WeekReport.fitness(runs, Date.now(), me);
            const base = "From your predicted 5K: your best recent run of 1.5 km or more.";
            note.textContent = f.age ? `${base} Fitness age: about ${f.age} (you're ${f.realAge}).` : `${base} Add your birth year in a weekly report to see your fitness age.`;
        });
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

if (typeof module !== "undefined") {
    module.exports = { calcPaceTrend, calcWeeklyVolume, weekSoFar, findBestEfforts, calcPersonalBests, formatPace, getGhostDistanceAtTime, getGhostTimeAtDistance, getGhostPositionAtTime };
}
