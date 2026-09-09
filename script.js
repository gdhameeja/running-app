class KalmanFilter {
    constructor(processNoise = 1, measurementNoise = 1, estimateError = 1, initialEstimate = 0) {
        this.processNoise = processNoise;
        this.measurementNoise = measurementNoise;
        this.estimateError = estimateError;
        this.estimate = initialEstimate;
        this.kalmanGain = 0;
    }

    update(measurement) {
        this.estimateError += this.processNoise;
        this.kalmanGain = this.estimateError / (this.estimateError + this.measurementNoise);
        this.estimate += this.kalmanGain * (measurement - this.estimate);
        this.estimateError *= (1 - this.kalmanGain);
        return this.estimate;
    }
}

let map, userMarker, pathLine;
let watchId;
let totalDistance = 0;
let prevPosition = null;
let nextMilestone = 1000;
let startTime, lastMilestoneTime;
let pathCoordinates = [];
let timerInterval;
let elapsedTime = 0;
let isPaused = false;
let pausedTime = 0;

let kalmanLat = null;
let kalmanLon = null;

let db;
let currentRunId = null;
let timeSeriesData = [];
let lastTimeSeriesDistance = 0;
let timeSeriesInterval = 400;

// ─── IndexedDB (v2: adds courseProgress store) ─────────────────────────────────

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("RunDB", 2);

        request.onerror = (event) => {
            console.error("IndexedDB error:", event.target.error);
            reject("Error opening database");
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            if (!db.objectStoreNames.contains("runs")) {
                const runsStore = db.createObjectStore("runs", { keyPath: "runId" });
                runsStore.createIndex("startTime", "startTime", { unique: false });
            }

            if (!db.objectStoreNames.contains("courseProgress")) {
                const cpStore = db.createObjectStore("courseProgress", { keyPath: "progressId" });
                cpStore.createIndex("courseId", "courseId", { unique: false });
                cpStore.createIndex("status", "status", { unique: false });
            }
        };
    });
}

function saveRun(runData) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(["runs"], "readwrite");
        const store = tx.objectStore("runs");
        const req = store.add(runData);
        req.onsuccess = () => resolve(req.result);
        req.onerror = (e) => reject("Error saving run: " + e.target.error);
    });
}

function updateRun(runData) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(["runs"], "readwrite");
        const store = tx.objectStore("runs");
        const req = store.put(runData);
        req.onsuccess = () => resolve(req.result);
        req.onerror = (e) => reject("Error updating run: " + e.target.error);
    });
}

function getAllRuns() {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(["runs"], "readonly");
        const store = tx.objectStore("runs");
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = (e) => reject("Error retrieving runs: " + e.target.error);
    });
}

function getLatestRun() {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(["runs"], "readonly");
        const store = tx.objectStore("runs");
        const index = store.index("startTime");
        const req = index.openCursor(null, "prev");
        req.onsuccess = (event) => {
            const cursor = event.target.result;
            resolve(cursor ? cursor.value : null);
        };
        req.onerror = (e) => reject("Error retrieving latest run: " + e.target.error);
    });
}

// ─── Course Progress DB ────────────────────────────────────────────────────────

function saveCourseProgress(data) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(["courseProgress"], "readwrite");
        const store = tx.objectStore("courseProgress");
        const req = store.put(data);
        req.onsuccess = () => resolve(req.result);
        req.onerror = (e) => reject(e.target.error);
    });
}

function getActiveCourses() {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(["courseProgress"], "readonly");
        const store = tx.objectStore("courseProgress");
        const index = store.index("status");
        const req = index.getAll("active");
        req.onsuccess = () => resolve(req.result);
        req.onerror = (e) => reject(e.target.error);
    });
}

function getCourseProgress(courseId) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(["courseProgress"], "readonly");
        const store = tx.objectStore("courseProgress");
        const index = store.index("courseId");
        const req = index.getAll(courseId);
        req.onsuccess = () => {
            const active = req.result.find(p => p.status === "active");
            resolve(active || null);
        };
        req.onerror = (e) => reject(e.target.error);
    });
}

// ─── Previous Run Helpers ──────────────────────────────────────────────────────

function findPreviousTime(timeSeries, currentDistance) {
    if (!timeSeries || timeSeries.length === 0) return null;
    for (let i = 0; i < timeSeries.length; i++) {
        if (timeSeries[i].distance >= currentDistance) return timeSeries[i].time;
    }
    return null;
}

function compareWithPreviousRun(previousRunTimeSeries, currentDistance, currentTime) {
    if (!previousRunTimeSeries) return;
    const previousTime = findPreviousTime(previousRunTimeSeries, currentDistance);
    if (previousTime === null) return;
    const difference = previousTime - currentTime;
    const formattedDifference = formatTime(Math.abs(difference));
    if (difference > 0) {
        speakText(`You are ${formattedDifference} faster than your last run at this distance.`);
    } else if (difference < 0) {
        speakText(`You are ${formattedDifference} slower than your last run at this distance.`);
    } else {
        speakText(`You are at the same pace as your last run.`);
    }
}

function displayRunSummary(run) {
    const summaryElement = document.createElement("div");
    summaryElement.className = "run-summary";
    summaryElement.innerHTML = `
        <h3>Run Summary</h3>
        <p>Date: ${new Date(run.startTime).toLocaleString()}</p>
        <p>Distance: ${(run.distance / 1000).toFixed(2)} km</p>
        <p>Time: ${formatTime(Math.floor(run.time / 1000))}</p>
        <p>Average Pace: ${formatTime(Math.floor(run.pace))} /km</p>
    `;
    const container = document.getElementById("tab-track");
    const existingSummary = container.querySelector(".run-summary");
    if (existingSummary) existingSummary.remove();
    container.appendChild(summaryElement);
}

// ─── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
    initDB()
        .then(() => {
            initMap();
            initTabs();
            renderCourseGrid();
        })
        .catch(error => console.error("Failed to initialize database:", error));
});

function initMap() {
    map = L.map("map").setView([0, 0], 2);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    userMarker = L.marker([0, 0]).addTo(map).bindPopup("You");
    pathLine = L.polyline([], { color: "red", weight: 4 }).addTo(map);
    setTimeout(() => map.invalidateSize(), 500);
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            map.setView([latitude, longitude], 15);
            userMarker.setLatLng([latitude, longitude]).openPopup();
        },
        (error) => console.warn("Could not get initial position:", error.message),
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

// ─── Tab Switching ─────────────────────────────────────────────────────────────

function initTabs() {
    document.querySelectorAll(".tab").forEach(tab => {
        tab.addEventListener("click", () => {
            document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
            document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
            tab.classList.add("active");
            document.getElementById("tab-" + tab.dataset.tab).classList.add("active");

            if (tab.dataset.tab === "stats" && typeof renderStats === "function") {
                renderStats();
            }
            if (tab.dataset.tab === "courses") {
                refreshActiveBanner();
            }
            if (tab.dataset.tab === "track") {
                setTimeout(() => map.invalidateSize(), 100);
            }
        });
    });
}

// ─── Run Tracking (start/pause/stop) ──────────────────────────────────────────

document.getElementById("start").addEventListener("click", () => {
    totalDistance = 0;
    prevPosition = null;
    nextMilestone = 1000;
    startTime = Date.now();
    lastMilestoneTime = startTime;
    pathCoordinates = [];
    elapsedTime = 0;
    timeSeriesData = [];
    lastTimeSeriesDistance = 0;

    document.getElementById("distance").textContent = "0.00 kms";
    document.getElementById("time").textContent = "0:00";
    document.getElementById("pace").textContent = "0:00 /km";

    const existingSummary = document.querySelector(".run-summary");
    if (existingSummary) existingSummary.remove();

    getLatestRun()
        .then(previousRun => {
            window.previousRunTimeSeries = previousRun ? previousRun.timeSeries : null;
            currentRunId = Date.now();
            return saveRun({
                runId: currentRunId,
                startTime: startTime,
                endTime: null,
                distance: 0,
                time: 0,
                pace: 0,
                timeSeries: []
            });
        })
        .then(() => {
            clearInterval(timerInterval);
            updateTimer();
            isPaused = false;
            pausedTime = 0;
            kalmanLat = null;
            kalmanLon = null;
            document.getElementById("pause").disabled = false;
            document.getElementById("start").disabled = true;
            document.getElementById("stop").disabled = false;
            watchId = startTracking();
        })
        .catch(error => console.error("Error starting run:", error));
});

document.getElementById("pause").addEventListener("click", () => {
    const pauseButton = document.getElementById("pause");
    if (!isPaused) {
        navigator.geolocation.clearWatch(watchId);
        clearInterval(timerInterval);
        pausedTime = Date.now();
        isPaused = true;
        pauseButton.innerHTML = '<span class="material-icons">play_arrow</span>';
    } else {
        startTime += (Date.now() - pausedTime);
        lastMilestoneTime += (Date.now() - pausedTime);
        updateTimer();
        watchId = startTracking();
        isPaused = false;
        pauseButton.innerHTML = '<span class="material-icons">pause</span>';
    }
});

document.getElementById("stop").addEventListener("click", () => {
    navigator.geolocation.clearWatch(watchId);
    clearInterval(timerInterval);
    document.getElementById("start").disabled = false;
    document.getElementById("stop").disabled = true;
    document.getElementById("pause").disabled = true;
    document.getElementById("pause").innerHTML = '<span class="material-icons">pause</span>';

    if (isPaused) startTime += (Date.now() - pausedTime);
    isPaused = false;

    const endTime = Date.now();
    const runTime = (endTime - startTime) / 1000;
    const pace = totalDistance > 0 ? (runTime / (totalDistance / 1000)) : 0;

    if (currentRunId) {
        const tx = db.transaction(["runs"], "readwrite");
        const store = tx.objectStore("runs");
        const req = store.get(currentRunId);
        req.onsuccess = () => {
            const runData = req.result;
            if (runData) {
                runData.endTime = endTime;
                runData.distance = totalDistance;
                runData.time = runTime;
                runData.pace = pace;
                runData.timeSeries = timeSeriesData;
                updateRun(runData)
                    .then(() => displayRunSummary(runData))
                    .catch(error => console.error("Error updating run:", error));
            }
        };
    }
});

// ─── Utility ───────────────────────────────────────────────────────────────────

function speakText(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    speechSynthesis.speak(utterance);
}

function updateTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        elapsedTime = ((Date.now() - startTime) / 1000);
        document.getElementById("time").textContent = formatTime(Math.floor(elapsedTime));
        if (totalDistance > 0) {
            const paceInSeconds = (elapsedTime / (totalDistance / 1000));
            document.getElementById("pace").textContent = `${formatTime(Math.floor(paceInSeconds))} /km`;
        }
    }, 1000);
}

function formatTime(seconds) {
    let mins = Math.floor(seconds / 60);
    let secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function startTracking() {
    return navigator.geolocation.watchPosition(position => {
        let { latitude, longitude } = position.coords;

        if (!kalmanLat) {
            kalmanLat = new KalmanFilter(0.0001, 0.0005, 1, latitude);
            kalmanLon = new KalmanFilter(0.0001, 0.0005, 1, longitude);
        }

        latitude = kalmanLat.update(latitude);
        longitude = kalmanLon.update(longitude);

        if (prevPosition) {
            const dist = getDistance(prevPosition.lat, prevPosition.lon, latitude, longitude);
            totalDistance += dist;
            document.getElementById("distance").textContent = `${(totalDistance / 1000).toFixed(2)} kms`;

            pathCoordinates.push([latitude, longitude]);
            pathLine.setLatLngs(pathCoordinates);
            userMarker.setLatLng([latitude, longitude]);
            map.setView([latitude, longitude]);

            if (totalDistance - lastTimeSeriesDistance >= timeSeriesInterval) {
                const currentTime = Date.now() - startTime;
                const dataPoint = {
                    distance: Math.floor(totalDistance / timeSeriesInterval) * timeSeriesInterval,
                    time: currentTime
                };
                timeSeriesData.push(dataPoint);

                if (window.previousRunTimeSeries) {
                    compareWithPreviousRun(window.previousRunTimeSeries, dataPoint.distance, currentTime);
                }

                lastTimeSeriesDistance = Math.floor(totalDistance / timeSeriesInterval) * timeSeriesInterval;
            }

            if (totalDistance >= nextMilestone) {
                let now = Date.now();
                let timeTaken = ((now - lastMilestoneTime) / 1000).toFixed(0);
                speakText(`You've completed ${nextMilestone / 1000} kilometer in ${formatTime(timeTaken)}.`);
                nextMilestone += 1000;
                lastMilestoneTime = now;
            }
        }
        prevPosition = { lat: latitude, lon: longitude };
    }, (error) => {
        console.error("Geolocation error:", error);
        if (error.code === error.PERMISSION_DENIED) {
            alert("Location permission denied. Please enable location access to track your run.");
        }
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
}

// ─── Previous Runs Table ───────────────────────────────────────────────────────

let currentPage = 0;
let currentPageSize = 10;
let sortedRuns = [];

function loadAllRuns() {
    return getAllRuns().then(runs => runs.sort((a, b) => b.startTime - a.startTime));
}

function renderPreviousRunsTable() {
    const container = document.getElementById("previous-runs-container");
    container.innerHTML = "";
    const startIdx = currentPage * currentPageSize;
    const pageRuns = sortedRuns.slice(startIdx, startIdx + currentPageSize);

    if (pageRuns.length === 0) {
        container.innerHTML = "<p>No runs found.</p>";
        return;
    }

    let table = `<table border="1" cellpadding="5" cellspacing="0">
        <tr><th>Date</th><th>Distance (km)</th><th>Time</th><th>Pace (/km)</th></tr>`;
    pageRuns.forEach(run => {
        table += `<tr>
            <td>${new Date(run.startTime).toLocaleString()}</td>
            <td>${(run.distance / 1000).toFixed(2)}</td>
            <td>${formatTime(Math.floor(run.time))}</td>
            <td>${formatTime(Math.floor(run.pace))}</td>
        </tr>`;
    });
    table += `</table>`;
    container.innerHTML = table;

    document.getElementById("prevPage").disabled = currentPage === 0;
    document.getElementById("nextPage").disabled = (startIdx + currentPageSize) >= sortedRuns.length;
}

document.getElementById("showPreviousRuns").addEventListener("click", () => {
    loadAllRuns().then(runs => {
        sortedRuns = runs;
        currentPage = 0;
        renderPreviousRunsTable();
        document.getElementById("previousRunsSection").style.display = "block";
    });
});

document.getElementById("pageSizeSelect").addEventListener("change", (e) => {
    currentPageSize = parseInt(e.target.value);
    currentPage = 0;
    renderPreviousRunsTable();
});

document.getElementById("prevPage").addEventListener("click", () => {
    if (currentPage > 0) { currentPage--; renderPreviousRunsTable(); }
});

document.getElementById("nextPage").addEventListener("click", () => {
    if ((currentPage + 1) * currentPageSize < sortedRuns.length) { currentPage++; renderPreviousRunsTable(); }
});

// ─── Courses UI ────────────────────────────────────────────────────────────────

let selectedCourseId = null;
let selectedLevel = "beginner";

function renderCourseGrid() {
    const grid = document.getElementById("course-grid");
    grid.innerHTML = "";
    COURSES.forEach(course => {
        const card = document.createElement("div");
        card.className = "course-card";
        card.innerHTML = `
            <div class="cc-header">
                <span class="cc-icon">${course.icon}</span>
                <span class="cc-name">${course.name}</span>
            </div>
            <p class="cc-desc">${course.shortDescription}</p>`;
        card.addEventListener("click", () => openCourseDetail(course.id));
        grid.appendChild(card);
    });
}

function openCourseDetail(courseId) {
    selectedCourseId = courseId;
    selectedLevel = "beginner";
    const course = COURSES.find(c => c.id === courseId);
    if (!course) return;

    document.getElementById("course-grid").style.display = "none";
    document.getElementById("active-course-banner").style.display = "none";
    document.getElementById("course-detail").style.display = "block";

    document.getElementById("cd-icon").textContent = course.icon;
    document.getElementById("cd-name").textContent = course.name;
    document.getElementById("cd-description").textContent = course.description;

    document.querySelectorAll(".level-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.level === "beginner");
    });

    updateLevelView();
}

function updateLevelView() {
    const course = COURSES.find(c => c.id === selectedCourseId);
    if (!course) return;
    const level = course.levels[selectedLevel];

    document.getElementById("cd-level-desc").textContent = level.description;
    document.getElementById("cd-level-info").textContent = `${level.duration} weeks · ${level.sessionsPerWeek} sessions/week · ${level.sessions.length} total sessions`;

    getCourseProgress(selectedCourseId).then(progress => {
        const startBtn = document.getElementById("start-course");
        if (progress && progress.level === selectedLevel) {
            startBtn.textContent = "Continue Course";
            startBtn.disabled = false;
        } else if (progress) {
            startBtn.textContent = `Already enrolled at ${progress.level}`;
            startBtn.disabled = true;
        } else {
            startBtn.textContent = "Start Course";
            startBtn.disabled = false;
        }
        renderSessionList(course, selectedLevel, progress);
    });
}

function renderSessionList(course, levelKey, progress) {
    const level = course.levels[levelKey];
    const container = document.getElementById("session-list");
    container.innerHTML = "";

    const completedIndices = progress && progress.level === levelKey
        ? new Set(progress.completedSessions.map(s => s.sessionIndex))
        : new Set();

    let currentWeek = 0;
    level.sessions.forEach((sess, idx) => {
        if (sess.week !== currentWeek) {
            currentWeek = sess.week;
            const header = document.createElement("div");
            header.className = "session-week-header";
            header.textContent = `Week ${currentWeek}`;
            container.appendChild(header);
        }

        const isCompleted = completedIndices.has(idx);
        const card = document.createElement("div");
        card.className = `session-card type-${sess.type}${isCompleted ? " completed" : ""}`;

        let segmentsHtml = "";
        if (sess.segments && sess.segments.length > 0) {
            segmentsHtml = '<div class="sc-segments">' +
                sess.segments.map(s => {
                    const durStr = s.duration >= 1
                        ? `${Math.round(s.duration)} min`
                        : `${Math.round(s.duration * 60)}s`;
                    return `<span class="sc-segment seg-${s.type}">${s.type} ${durStr}</span>`;
                }).join("") + "</div>";
        }

        let actionHtml = "";
        if (progress && progress.level === levelKey && !isCompleted) {
            actionHtml = `<button class="mark-complete-btn" data-idx="${idx}">Mark Complete</button>`;
        } else if (isCompleted) {
            actionHtml = '<span class="completed-badge">✓ Done</span>';
        }

        card.innerHTML = `
            <div class="sc-header">
                <span class="sc-title">Day ${sess.day}: ${sess.title}</span>
                <span class="sc-type">${sess.type}</span>
            </div>
            <p class="sc-desc">${sess.description}</p>
            ${segmentsHtml}
            ${actionHtml}`;
        container.appendChild(card);
    });

    container.querySelectorAll(".mark-complete-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            markSessionComplete(parseInt(btn.dataset.idx));
        });
    });
}

function markSessionComplete(sessionIndex) {
    getCourseProgress(selectedCourseId).then(progress => {
        if (!progress) return;
        if (progress.completedSessions.find(s => s.sessionIndex === sessionIndex)) return;

        progress.completedSessions.push({
            sessionIndex,
            date: Date.now()
        });

        const course = COURSES.find(c => c.id === selectedCourseId);
        const total = course.levels[progress.level].sessions.length;
        if (progress.completedSessions.length >= total) {
            progress.status = "completed";
        }

        saveCourseProgress(progress).then(() => {
            updateLevelView();
        });
    });
}

document.getElementById("back-to-courses").addEventListener("click", () => {
    document.getElementById("course-detail").style.display = "none";
    document.getElementById("course-grid").style.display = "grid";
    refreshActiveBanner();
});

document.querySelectorAll(".level-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        selectedLevel = btn.dataset.level;
        document.querySelectorAll(".level-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        updateLevelView();
    });
});

document.getElementById("start-course").addEventListener("click", () => {
    getCourseProgress(selectedCourseId).then(existing => {
        if (existing && existing.level === selectedLevel) {
            // Already enrolled — just scroll to sessions
            document.getElementById("session-list").scrollIntoView({ behavior: "smooth" });
            return;
        }
        const progressData = {
            progressId: `${selectedCourseId}-${selectedLevel}-${Date.now()}`,
            courseId: selectedCourseId,
            level: selectedLevel,
            startDate: Date.now(),
            completedSessions: [],
            status: "active"
        };
        saveCourseProgress(progressData).then(() => {
            updateLevelView();
        });
    });
});

// ─── Active Course Banner ──────────────────────────────────────────────────────

function refreshActiveBanner() {
    getActiveCourses().then(active => {
        const banner = document.getElementById("active-course-banner");
        if (active.length === 0) {
            banner.style.display = "none";
            return;
        }
        const prog = active[0];
        const course = COURSES.find(c => c.id === prog.courseId);
        if (!course) { banner.style.display = "none"; return; }
        const level = course.levels[prog.level];
        const total = level.sessions.length;
        const done = prog.completedSessions.length;
        const pct = Math.round((done / total) * 100);

        document.getElementById("acb-icon").textContent = course.icon;
        document.getElementById("acb-name").textContent = course.name;
        document.getElementById("acb-level").textContent = prog.level;
        document.getElementById("acb-progress").style.width = pct + "%";
        document.getElementById("acb-detail").textContent = `${done}/${total} sessions · Week ${Math.ceil((done + 1) / level.sessionsPerWeek)} of ${level.duration}`;
        banner.style.display = "block";
    });
}

document.getElementById("acb-view").addEventListener("click", () => {
    getActiveCourses().then(active => {
        if (active.length > 0) {
            selectedLevel = active[0].level;
            openCourseDetail(active[0].courseId);
            document.querySelectorAll(".level-btn").forEach(b => {
                b.classList.toggle("active", b.dataset.level === selectedLevel);
            });
            updateLevelView();
        }
    });
});

document.getElementById("acb-abandon").addEventListener("click", () => {
    if (!confirm("Abandon this course? Progress will be lost.")) return;
    getActiveCourses().then(active => {
        if (active.length > 0) {
            active[0].status = "abandoned";
            saveCourseProgress(active[0]).then(() => refreshActiveBanner());
        }
    });
});
