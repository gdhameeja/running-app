// performance.js — Stats calculations and Chart.js rendering

function calcPaceTrend(runs, limit = 20) {
    const sorted = runs
        .filter(r => r.distance > 0 && r.time > 0)
        .sort((a, b) => a.startTime - b.startTime)
        .slice(-limit);
    return sorted.map(r => ({
        date: new Date(r.startTime).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        pace: r.pace / 60
    }));
}

function calcWeeklyVolume(runs, weeks = 8) {
    const now = Date.now();
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const buckets = [];
    for (let i = weeks - 1; i >= 0; i--) {
        const weekStart = now - (i + 1) * msPerWeek;
        const weekEnd = now - i * msPerWeek;
        const weekRuns = runs.filter(r => r.startTime >= weekStart && r.startTime < weekEnd);
        const totalKm = weekRuns.reduce((sum, r) => sum + r.distance / 1000, 0);
        const d = new Date(weekStart);
        buckets.push({
            label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            km: Math.round(totalKm * 100) / 100
        });
    }
    return buckets;
}

function calcPersonalBests(runs) {
    const targets = [1, 5, 10];
    const bests = {};
    targets.forEach(km => {
        const qualifying = runs.filter(r => r.distance >= km * 1000 && r.time > 0);
        if (qualifying.length === 0) {
            bests[km] = null;
            return;
        }
        let bestPace = Infinity;
        let bestRun = null;
        qualifying.forEach(r => {
            const pace = r.time / (r.distance / 1000);
            if (pace < bestPace) {
                bestPace = pace;
                bestRun = r;
            }
        });
        bests[km] = {
            pace: bestPace,
            date: new Date(bestRun.startTime).toLocaleDateString(),
            distance: bestRun.distance / 1000,
            time: bestRun.time
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
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.round(totalSeconds % 60);
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
    if (data.length < 2) {
        document.getElementById("pace-chart-container").innerHTML = "<p>Need at least 2 runs to show pace trend.</p>";
        return;
    }
    const ctx = document.getElementById("paceChart");
    if (paceChart) paceChart.destroy();
    paceChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: data.map(d => d.date),
            datasets: [{
                label: "Avg Pace (min/km)",
                data: data.map(d => d.pace),
                borderColor: "#3f51b5",
                backgroundColor: "rgba(63,81,181,0.1)",
                fill: true,
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
    [1, 5, 10].forEach(km => {
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
