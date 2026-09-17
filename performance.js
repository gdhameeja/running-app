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
    const targets = [1, 3, 5, 10];
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
                    suggestedMin: 2,
                    suggestedMax: 15,
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

function getBestRunsForGhost(runs) {
    const targets = [1, 3, 5, 10];
    const ghosts = {};
    targets.forEach(km => {
        const withTimeSeries = runs.filter(r =>
            r.distance >= km * 1000 && r.time > 0 &&
            r.timeSeries && r.timeSeries.length > 0
        );
        const withoutTimeSeries = runs.filter(r =>
            r.distance >= km * 1000 && r.time > 0 &&
            (!r.timeSeries || r.timeSeries.length === 0)
        );

        let bestRun = null, bestPace = Infinity, simulated = false;

        withTimeSeries.forEach(r => {
            const pace = r.time / (r.distance / 1000);
            if (pace < bestPace) { bestPace = pace; bestRun = r; }
        });

        if (!bestRun && withoutTimeSeries.length > 0) {
            withoutTimeSeries.forEach(r => {
                const pace = r.time / (r.distance / 1000);
                if (pace < bestPace) { bestPace = pace; bestRun = r; }
            });
            if (bestRun) {
                const targetDist = km * 1000;
                const totalTime = bestRun.time * 1000;
                const points = 20;
                const synthTimeSeries = [];
                for (let i = 1; i <= points; i++) {
                    synthTimeSeries.push({
                        distance: (targetDist / points) * i,
                        time: (totalTime / points) * i
                    });
                }
                bestRun = { ...bestRun, timeSeries: synthTimeSeries };
                simulated = true;
            }
        }

        if (!bestRun) { ghosts[km] = null; return; }

        ghosts[km] = {
            pace: bestPace,
            timeSeries: bestRun.timeSeries,
            distance: bestRun.distance,
            time: bestRun.time,
            date: new Date(bestRun.startTime).toLocaleDateString(),
            simulated: simulated
        };
    });
    return ghosts;
}

function getGhostDistanceAtTime(timeSeries, elapsedMs) {
    if (!timeSeries || timeSeries.length === 0) return 0;
    for (let i = 0; i < timeSeries.length; i++) {
        if (timeSeries[i].time >= elapsedMs) {
            if (i === 0) {
                return timeSeries[0].distance > 0
                    ? (elapsedMs / timeSeries[0].time) * timeSeries[0].distance : 0;
            }
            const prev = timeSeries[i - 1], next = timeSeries[i];
            const ratio = (elapsedMs - prev.time) / (next.time - prev.time);
            return prev.distance + ratio * (next.distance - prev.distance);
        }
    }
    return timeSeries[timeSeries.length - 1].distance;
}

function getGhostTimeAtDistance(timeSeries, distance) {
    if (!timeSeries || timeSeries.length === 0) return null;
    for (let i = 0; i < timeSeries.length; i++) {
        if (timeSeries[i].distance >= distance) {
            if (i === 0) {
                return timeSeries[0].distance > 0
                    ? (distance / timeSeries[0].distance) * timeSeries[0].time : null;
            }
            const prev = timeSeries[i - 1], next = timeSeries[i];
            const ratio = (distance - prev.distance) / (next.distance - prev.distance);
            return prev.time + ratio * (next.time - prev.time);
        }
    }
    return null;
}

function getGhostPositionAtTime(timeSeries, elapsedMs) {
    if (!timeSeries || timeSeries.length === 0) return null;
    const withCoords = timeSeries.filter(p => p.lat != null && p.lng != null);
    if (withCoords.length === 0) return null;

    for (let i = 0; i < withCoords.length; i++) {
        if (withCoords[i].time >= elapsedMs) {
            if (i === 0) return [withCoords[0].lat, withCoords[0].lng];
            const prev = withCoords[i - 1], next = withCoords[i];
            const ratio = (elapsedMs - prev.time) / (next.time - prev.time);
            return [
                prev.lat + ratio * (next.lat - prev.lat),
                prev.lng + ratio * (next.lng - prev.lng)
            ];
        }
    }
    const last = withCoords[withCoords.length - 1];
    return [last.lat, last.lng];
}

function renderGhostRaceTab() {
    getAllRuns().then(runs => {
        const ghosts = getBestRunsForGhost(runs);
        const container = document.getElementById("ghost-race-content");
        container.innerHTML = "";

        const intro = document.createElement("p");
        intro.className = "ghost-intro";
        intro.textContent = "Race against your personal best! Select a distance to start a ghost race.";
        container.appendChild(intro);

        const grid = document.createElement("div");
        grid.className = "ghost-grid";

        [1, 3, 5, 10].forEach(km => {
            const card = document.createElement("div");
            card.className = "ghost-card";
            if (ghosts[km]) {
                card.classList.add("available");
                const simLabel = ghosts[km].simulated
                    ? '<div class="ghost-sim-badge">Simulated Ghost</div>' : '';
                card.innerHTML = `
                    <div class="ghost-card-icon">👻</div>
                    <div class="ghost-distance">${km}K</div>
                    ${simLabel}
                    <div class="ghost-pace">${formatPace(ghosts[km].pace)} /km</div>
                    <div class="ghost-time">${formatPace(ghosts[km].time)} total</div>
                    <div class="ghost-date">${ghosts[km].date}</div>
                    <button class="ghost-start-btn" data-km="${km}">Race Ghost</button>`;
            } else {
                card.classList.add("unavailable");
                card.innerHTML = `
                    <div class="ghost-card-icon">👻</div>
                    <div class="ghost-distance">${km}K</div>
                    <div class="ghost-pace">—</div>
                    <div class="ghost-date">No qualifying run with tracking data</div>`;
            }
            grid.appendChild(card);
        });

        container.appendChild(grid);

        const note = document.createElement("p");
        note.className = "ghost-note";
        note.textContent = "Ghost races use your best run's pace profile. Complete runs with GPS tracking to unlock ghost races.";
        container.appendChild(note);

        container.querySelectorAll(".ghost-start-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const km = parseInt(btn.dataset.km);
                startGhostRaceMode(km, ghosts[km]);
            });
        });
    });
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
