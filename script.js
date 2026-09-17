class KalmanFilter {
    constructor(processNoise, initialEstimate) {
        this.processNoise = processNoise;
        this.estimateError = 1;
        this.estimate = initialEstimate;
    }

    update(measurement, accuracyMeters) {
        // Weight measurement by GPS-reported accuracy
        // Convert meters to degrees (1° lat ≈ 111320m), then square for variance
        const accuracyDeg = accuracyMeters / 111320;
        const measurementNoise = accuracyDeg * accuracyDeg;

        this.estimateError += this.processNoise;
        const kalmanGain = this.estimateError / (this.estimateError + measurementNoise);
        this.estimate += kalmanGain * (measurement - this.estimate);
        this.estimateError *= (1 - kalmanGain);
        return this.estimate;
    }
}

let map, userMarker, pathLine;
let watchId;
let totalDistance = 0;
let prevPosition = null;
let nextMilestone = 1000;
let startTime, lastMilestoneTime;
let pathSegments = [];
let currentSegment = [];
let gapCoords = [];
let timerInterval;
let elapsedTime = 0;
let isPaused = false;
let pausedTime = 0;

let kalmanLat = null;
let kalmanLon = null;
let lastFixTime = null;

let db;
let currentRunId = null;
let timeSeriesData = [];
let lastTimeSeriesDistance = 0;
let timeSeriesInterval = 100;
let guidedRun = null;
let ghostRace = null;

let wakeLockSentinel = null;
let bgAudioCtx = null;
let gapLine = null;
let autoSaveInterval = null;
let ghostMarker = null;
let lastTimeSeriesTime = 0;

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
        <p>Time: ${formatTime(Math.floor(run.time))}</p>
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
            checkForInterruptedRun();
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
    gapLine = L.polyline([], { color: "#999", weight: 2, dashArray: "8,8", opacity: 0.5 }).addTo(map);
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
            if (tab.dataset.tab === "ghost" && typeof renderGhostRaceTab === "function") {
                renderGhostRaceTab();
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
    pathSegments = [];
    currentSegment = [];
    gapCoords = [];
    elapsedTime = 0;
    timeSeriesData = [];
    lastTimeSeriesDistance = 0;
    lastTimeSeriesTime = 0;

    document.getElementById("distance").textContent = "0.00 kms";
    document.getElementById("time").textContent = "0:00";
    document.getElementById("pace").textContent = "0:00 /km";

    if (pathLine) pathLine.setLatLngs([]);
    if (gapLine) gapLine.setLatLngs([]);
    if (ghostMarker) { map.removeLayer(ghostMarker); ghostMarker = null; }

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
            lastFixTime = null;
            document.getElementById("pause").disabled = false;
            document.getElementById("start").disabled = true;
            document.getElementById("stop").disabled = false;
            requestWakeLock();
            startBackgroundAudio();
            watchId = startTracking();
            startAutoSave();
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
        if (guidedRun) pauseGuidedRun();
    } else {
        startTime += (Date.now() - pausedTime);
        lastMilestoneTime += (Date.now() - pausedTime);
        updateTimer();
        watchId = startTracking();
        isPaused = false;
        pauseButton.innerHTML = '<span class="material-icons">pause</span>';
        if (guidedRun) resumeGuidedRun();
    }
});

document.getElementById("stop").addEventListener("click", () => {
    navigator.geolocation.clearWatch(watchId);
    clearInterval(timerInterval);
    stopAutoSave();
    releaseWakeLock();
    stopBackgroundAudio();
    if (ghostMarker) { map.removeLayer(ghostMarker); ghostMarker = null; }
    document.getElementById("start").disabled = false;
    document.getElementById("stop").disabled = true;
    document.getElementById("pause").disabled = true;
    document.getElementById("pause").innerHTML = '<span class="material-icons">pause</span>';

    if (isPaused) startTime += (Date.now() - pausedTime);
    isPaused = false;

    if (ghostRace) {
        document.getElementById("ghost-panel").style.display = "none";
        ghostRace = null;
    }

    if (guidedRun) {
        clearInterval(guidedRun.segmentInterval);
        document.getElementById("guided-run-panel").style.display = "none";
        guidedRun = null;
    }

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
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    speechSynthesis.speak(utterance);
}

async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLockSentinel = await navigator.wakeLock.request('screen');
            wakeLockSentinel.addEventListener('release', () => { wakeLockSentinel = null; });
        }
    } catch (e) {
        console.warn('Wake Lock failed:', e);
    }
}

function releaseWakeLock() {
    if (wakeLockSentinel) { wakeLockSentinel.release(); wakeLockSentinel = null; }
}

function startBackgroundAudio() {
    if (bgAudioCtx) return;
    try {
        bgAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = bgAudioCtx.createOscillator();
        const gain = bgAudioCtx.createGain();
        gain.gain.value = 0.001;
        osc.connect(gain);
        gain.connect(bgAudioCtx.destination);
        osc.start();
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: 'Run in progress',
                artist: 'Running Tracker'
            });
            navigator.mediaSession.playbackState = 'playing';
        }
    } catch (e) {
        console.warn('Background audio failed:', e);
    }
}

function stopBackgroundAudio() {
    if (bgAudioCtx) { bgAudioCtx.close().catch(() => {}); bgAudioCtx = null; }
    if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'none';
    }
}

function startAutoSave() {
    stopAutoSave();
    autoSaveInterval = setInterval(() => {
        if (currentRunId && !isPaused) autoSaveRun();
    }, 30000);
}

function stopAutoSave() {
    if (autoSaveInterval) { clearInterval(autoSaveInterval); autoSaveInterval = null; }
}

function autoSaveRun() {
    if (!currentRunId || !db) return;
    const tx = db.transaction(["runs"], "readwrite");
    const store = tx.objectStore("runs");
    const req = store.get(currentRunId);
    req.onsuccess = () => {
        const runData = req.result;
        if (runData) {
            const elapsed = isPaused
                ? (pausedTime - startTime) / 1000
                : (Date.now() - startTime) / 1000;
            runData.distance = totalDistance;
            runData.time = elapsed;
            runData.pace = totalDistance > 0 ? (elapsed / (totalDistance / 1000)) : 0;
            runData.timeSeries = timeSeriesData;
            runData.pathSegments = [...pathSegments, currentSegment];
            store.put(runData);
        }
    };
}

function checkForInterruptedRun() {
    getAllRuns().then(runs => {
        const interrupted = runs.find(r => r.endTime === null && r.distance > 50);
        if (interrupted) {
            const dist = (interrupted.distance / 1000).toFixed(2);
            const time = formatTime(Math.floor(interrupted.time || 0));
            if (confirm(`Found an interrupted run (${dist} km, ${time}). Save it?`)) {
                interrupted.endTime = interrupted.startTime + (interrupted.time || 0) * 1000;
                if (interrupted.distance > 0 && interrupted.time > 0) {
                    interrupted.pace = interrupted.time / (interrupted.distance / 1000);
                }
                updateRun(interrupted).then(() => displayRunSummary(interrupted));
            } else {
                const tx = db.transaction(["runs"], "readwrite");
                tx.objectStore("runs").delete(interrupted.runId);
            }
        }
    });
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        window._lastHiddenTime = Date.now();
        if (currentRunId && !isPaused) autoSaveRun();
    } else {
        if (watchId && window._lastHiddenTime) {
            const hiddenDuration = Date.now() - window._lastHiddenTime;
            if (hiddenDuration > 5000) {
                kalmanLat = null;
                kalmanLon = null;
                prevPosition = null;
            }
        }
        if (watchId) requestWakeLock();
        if (bgAudioCtx && bgAudioCtx.state === 'suspended') {
            bgAudioCtx.resume().catch(() => {});
        }
        if (map) setTimeout(() => map.invalidateSize(), 200);
        delete window._lastHiddenTime;
    }
});

function updateTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        elapsedTime = ((Date.now() - startTime) / 1000);
        document.getElementById("time").textContent = formatTime(Math.floor(elapsedTime));
        if (totalDistance > 0) {
            const paceInSeconds = (elapsedTime / (totalDistance / 1000));
            document.getElementById("pace").textContent = `${formatTime(Math.floor(paceInSeconds))} /km`;
        }
        if (ghostRace) updateGhostPanel();
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
        const accuracy = position.coords.accuracy;

        if (accuracy > 20) return;

        let { latitude, longitude } = position.coords;

        if (!kalmanLat) {
            kalmanLat = new KalmanFilter(0.0001, latitude);
            kalmanLon = new KalmanFilter(0.0001, longitude);
            lastFixTime = Date.now();
        }

        latitude = kalmanLat.update(latitude, accuracy);
        longitude = kalmanLon.update(longitude, accuracy);

        if (prevPosition) {
            const dist = getDistance(prevPosition.lat, prevPosition.lon, latitude, longitude);

            if (dist < 3) return;

            const now = Date.now();
            const timeDelta = (now - lastFixTime) / 1000;

            if (timeDelta > 10 && currentSegment.length > 0) {
                pathSegments.push([...currentSegment]);
                gapCoords.push([
                    currentSegment[currentSegment.length - 1],
                    [latitude, longitude]
                ]);
                gapLine.setLatLngs(gapCoords);
                currentSegment = [[latitude, longitude]];
                pathLine.setLatLngs([...pathSegments, currentSegment]);
                prevPosition = { lat: latitude, lon: longitude };
                lastFixTime = now;
                kalmanLat = new KalmanFilter(0.0001, latitude);
                kalmanLon = new KalmanFilter(0.0001, longitude);
                userMarker.setLatLng([latitude, longitude]);
                map.setView([latitude, longitude]);
                return;
            }

            if (timeDelta > 0 && (dist / timeDelta) > 12.5) return;
            lastFixTime = now;

            totalDistance += dist;
            document.getElementById("distance").textContent = `${(totalDistance / 1000).toFixed(2)} kms`;

            currentSegment.push([latitude, longitude]);
            pathLine.setLatLngs([...pathSegments, currentSegment]);
            userMarker.setLatLng([latitude, longitude]);
            map.setView([latitude, longitude]);

            const currentTimeMs = Date.now() - startTime;
            const instantPace = timeDelta > 0 && dist > 0
                ? (timeDelta / (dist / 1000)) : 0;

            if (totalDistance - lastTimeSeriesDistance >= timeSeriesInterval) {
                const dataPoint = {
                    distance: Math.floor(totalDistance / timeSeriesInterval) * timeSeriesInterval,
                    time: currentTimeMs,
                    lat: latitude,
                    lng: longitude,
                    pace: instantPace
                };
                timeSeriesData.push(dataPoint);

                if (window.previousRunTimeSeries) {
                    compareWithPreviousRun(window.previousRunTimeSeries, dataPoint.distance, currentTimeMs);
                }

                lastTimeSeriesDistance = Math.floor(totalDistance / timeSeriesInterval) * timeSeriesInterval;
            }

            if (currentTimeMs - lastTimeSeriesTime >= 60000) {
                const alreadyRecorded = timeSeriesData.length > 0 &&
                    Math.abs(timeSeriesData[timeSeriesData.length - 1].time - currentTimeMs) < 5000;
                if (!alreadyRecorded) {
                    timeSeriesData.push({
                        distance: totalDistance,
                        time: currentTimeMs,
                        lat: latitude,
                        lng: longitude,
                        pace: instantPace
                    });
                }
                lastTimeSeriesTime = currentTimeMs;
            }

            if (totalDistance >= nextMilestone) {
                let now2 = Date.now();
                let timeTaken = ((now2 - lastMilestoneTime) / 1000).toFixed(0);
                speakText(`You've completed ${nextMilestone / 1000} kilometer in ${formatTime(timeTaken)}.`);

                if (ghostRace && typeof getGhostTimeAtDistance === "function") {
                    const ghostTimeMs = getGhostTimeAtDistance(ghostRace.ghostTimeSeries, nextMilestone);
                    const yourTimeMs = now2 - startTime;
                    if (ghostTimeMs !== null) {
                        const diffSec = Math.round(Math.abs(ghostTimeMs - yourTimeMs) / 1000);
                        const diffStr = formatTime(diffSec);
                        if (yourTimeMs < ghostTimeMs) {
                            setTimeout(() => speakText(`${diffStr} ahead of your ghost.`), 2500);
                        } else if (yourTimeMs > ghostTimeMs) {
                            setTimeout(() => speakText(`${diffStr} behind your ghost.`), 2500);
                        }
                    }
                }

                nextMilestone += 1000;
                lastMilestoneTime = now2;
            }
        } else {
            lastFixTime = Date.now();
            if (currentSegment.length > 0) {
                pathSegments.push([...currentSegment]);
                gapCoords.push([
                    currentSegment[currentSegment.length - 1],
                    [latitude, longitude]
                ]);
                gapLine.setLatLngs(gapCoords);
                currentSegment = [];
            }
            currentSegment.push([latitude, longitude]);
            pathLine.setLatLngs([...pathSegments, currentSegment]);
            userMarker.setLatLng([latitude, longitude]);
            map.setView([latitude, longitude]);
        }
        prevPosition = { lat: latitude, lon: longitude };
    }, (error) => {
        console.error("Geolocation error:", error);
        if (error.code === error.PERMISSION_DENIED) {
            alert("Location permission denied. Please enable location access to track your run.");
        }
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
}

// ─── Ghost Race ───────────────────────────────────────────────────────────────

function startGhostRaceMode(km, ghostData) {
    if (document.getElementById("start").disabled) {
        alert("Stop your current run before starting a ghost race.");
        return;
    }

    ghostRace = {
        targetKm: km,
        ghostTimeSeries: ghostData.timeSeries,
        ghostTotalTime: ghostData.time,
        ghostTotalDistance: ghostData.distance,
        ghostPace: ghostData.pace,
        finished: false
    };

    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    document.querySelector('[data-tab="track"]').classList.add("active");
    document.getElementById("tab-track").classList.add("active");
    setTimeout(() => map.invalidateSize(), 100);

    const panel = document.getElementById("ghost-panel");
    panel.style.display = "block";
    document.getElementById("ghost-panel-title").textContent = `Ghost Race: ${km}K PB`;
    document.getElementById("ghost-your-dist").textContent = "0.00 km";
    document.getElementById("ghost-ghost-dist").textContent = "0.00 km";
    document.getElementById("ghost-your-pace").textContent = "--:-- /km";
    document.getElementById("ghost-ghost-pace").textContent = formatTime(Math.floor(ghostData.pace)) + " /km";
    document.getElementById("ghost-diff").textContent = "Starting...";
    document.getElementById("ghost-diff").className = "ghost-diff-bar";

    document.getElementById("start").click();
}

function updateGhostPanel() {
    if (!ghostRace) return;

    const elapsedMs = Date.now() - startTime;
    const ghostDist = getGhostDistanceAtTime(ghostRace.ghostTimeSeries, elapsedMs);

    document.getElementById("ghost-your-dist").textContent = (totalDistance / 1000).toFixed(2) + " km";
    document.getElementById("ghost-ghost-dist").textContent = (ghostDist / 1000).toFixed(2) + " km";

    if (typeof getGhostPositionAtTime === "function") {
        const ghostPos = getGhostPositionAtTime(ghostRace.ghostTimeSeries, elapsedMs);
        if (ghostPos) {
            if (!ghostMarker) {
                const ghostIcon = L.divIcon({
                    className: 'ghost-map-marker',
                    html: '<span style="font-size:24px;opacity:0.7">👻</span>',
                    iconSize: [30, 30],
                    iconAnchor: [15, 15]
                });
                ghostMarker = L.marker(ghostPos, { icon: ghostIcon }).addTo(map);
            } else {
                ghostMarker.setLatLng(ghostPos);
            }
        }
    }

    if (totalDistance > 50) {
        const yourPaceSec = (elapsedMs / 1000) / (totalDistance / 1000);
        document.getElementById("ghost-your-pace").textContent = formatTime(Math.floor(yourPaceSec)) + " /km";
    }

    const targetDist = ghostRace.targetKm * 1000;
    const yourFinished = totalDistance >= targetDist;
    const ghostFinished = ghostDist >= targetDist;

    const diff = totalDistance - ghostDist;
    const diffEl = document.getElementById("ghost-diff");

    if (yourFinished && !ghostRace.finished) {
        ghostRace.finished = true;
        const ghostTimeMs = getGhostTimeAtDistance(ghostRace.ghostTimeSeries, targetDist);
        if (ghostTimeMs !== null && elapsedMs < ghostTimeMs) {
            diffEl.textContent = "You beat your PB ghost!";
            diffEl.className = "ghost-diff-bar ahead";
            speakText("You beat your ghost! New personal best pace!");
        } else {
            diffEl.textContent = "Ghost wins this time. Keep pushing!";
            diffEl.className = "ghost-diff-bar behind";
            speakText("Ghost wins. Great effort, keep training!");
        }
        return;
    }

    if (ghostFinished && !yourFinished) {
        const remaining = ((targetDist - totalDistance) / 1000).toFixed(2);
        diffEl.textContent = `Ghost finished! ${remaining} km to go`;
        diffEl.className = "ghost-diff-bar behind";
    } else if (Math.abs(diff) < 10) {
        diffEl.textContent = "Neck and neck!";
        diffEl.className = "ghost-diff-bar tied";
    } else if (diff > 0) {
        diffEl.textContent = `You're ${Math.round(diff)}m ahead!`;
        diffEl.className = "ghost-diff-bar ahead";
    } else {
        diffEl.textContent = `Ghost is ${Math.round(Math.abs(diff))}m ahead`;
        diffEl.className = "ghost-diff-bar behind";
    }
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
        if (isCompleted) {
            actionHtml = '<span class="completed-badge">✓ Done</span>';
        } else {
            actionHtml = `<button class="guided-run-btn" data-idx="${idx}" data-course="${course.id}" data-level="${levelKey}">▶ Guided Run</button>`;
            if (progress && progress.level === levelKey) {
                actionHtml += ` <button class="mark-complete-btn" data-idx="${idx}">Mark Complete</button>`;
            }
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

    container.querySelectorAll(".guided-run-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            startGuidedRun(btn.dataset.course, btn.dataset.level, parseInt(btn.dataset.idx));
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

// ─── Guided Run (Voice-Coached Workouts) ───────────────────────────────────────

const SEGMENT_NAMES = {
    warmup: "Warm up", cooldown: "Cool down", run: "Run",
    sprint: "Sprint", jog: "Jog", walk: "Walk", rest: "Rest"
};

function startGuidedRun(courseId, levelKey, sessionIndex) {
    if (document.getElementById("start").disabled) {
        alert("Stop your current run before starting a guided run.");
        return;
    }

    const course = COURSES.find(c => c.id === courseId);
    if (!course) return;
    const sess = course.levels[levelKey].sessions[sessionIndex];

    guidedRun = {
        courseId, level: levelKey, sessionIndex, session: sess,
        segments: sess.segments,
        currentSegmentIndex: -1,
        segmentStartTime: null,
        segmentInterval: null,
        segmentPausedElapsed: 0,
        announcedWarnings: {}
    };

    // Auto-enroll if not already in this course+level
    getCourseProgress(courseId).then(progress => {
        if (!progress || progress.level !== levelKey) {
            return saveCourseProgress({
                progressId: `${courseId}-${levelKey}-${Date.now()}`,
                courseId, level: levelKey,
                startDate: Date.now(),
                completedSessions: [],
                status: "active"
            });
        }
    }).then(() => {
        // Switch to track tab
        document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
        document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
        document.querySelector('[data-tab="track"]').classList.add("active");
        document.getElementById("tab-track").classList.add("active");
        setTimeout(() => map.invalidateSize(), 100);

        // Show panel with "get ready" state
        const panel = document.getElementById("guided-run-panel");
        panel.style.display = "block";
        panel.className = "";
        document.getElementById("gr-session-name").textContent = sess.title;
        document.getElementById("gr-segment-type").textContent = "GET READY";
        document.getElementById("gr-segment-intensity").textContent = "";
        document.getElementById("gr-time-remaining").textContent = "";
        document.getElementById("gr-next-segment").textContent = `First: ${SEGMENT_NAMES[sess.segments[0].type] || sess.segments[0].type}`;
        document.getElementById("gr-segment-count").textContent = `${sess.segments.length} segments total`;
        document.getElementById("gr-segment-progress").style.width = "0%";

        // Start the actual run (GPS + timer)
        document.getElementById("start").click();

        // Countdown then start first segment
        speakText("Get ready. Starting in 5 seconds.");
        setTimeout(() => {
            if (guidedRun) startSegment(0);
        }, 5000);
    });
}

function startSegment(index) {
    if (!guidedRun) return;
    if (index >= guidedRun.segments.length) {
        completeGuidedRun();
        return;
    }

    guidedRun.currentSegmentIndex = index;
    guidedRun.segmentStartTime = Date.now();
    guidedRun.segmentPausedElapsed = 0;
    guidedRun.announcedWarnings = {};

    const seg = guidedRun.segments[index];
    const durationSec = Math.round(seg.duration * 60);

    announceSegment(seg, durationSec);
    updateGuidedRunUI();

    clearInterval(guidedRun.segmentInterval);
    guidedRun.segmentInterval = setInterval(() => updateGuidedRunUI(), 500);
}

function announceSegment(seg, durationSec) {
    const name = SEGMENT_NAMES[seg.type] || seg.type;
    let durStr;
    if (durationSec >= 60) {
        const mins = Math.floor(durationSec / 60);
        const secs = durationSec % 60;
        durStr = secs > 0 ? `${mins} minutes ${secs} seconds` : `${mins} minute${mins > 1 ? "s" : ""}`;
    } else {
        durStr = `${durationSec} seconds`;
    }
    speakText(`${name}. ${seg.intensity}. ${durStr}.`);
}

function updateGuidedRunUI() {
    if (!guidedRun || guidedRun.currentSegmentIndex < 0) return;

    const seg = guidedRun.segments[guidedRun.currentSegmentIndex];
    const durationSec = Math.round(seg.duration * 60);
    const elapsed = ((Date.now() - guidedRun.segmentStartTime) / 1000) - guidedRun.segmentPausedElapsed;
    const remaining = Math.max(0, durationSec - elapsed);

    // Update panel color
    const panel = document.getElementById("guided-run-panel");
    panel.className = `seg-${seg.type}`;

    document.getElementById("gr-segment-type").textContent = (SEGMENT_NAMES[seg.type] || seg.type).toUpperCase();
    document.getElementById("gr-segment-intensity").textContent = seg.intensity;

    const remMins = Math.floor(remaining / 60);
    const remSecs = Math.floor(remaining % 60);
    document.getElementById("gr-time-remaining").textContent = `${remMins}:${remSecs.toString().padStart(2, "0")}`;

    const pct = durationSec > 0 ? ((durationSec - remaining) / durationSec) * 100 : 100;
    document.getElementById("gr-segment-progress").style.width = pct + "%";

    document.getElementById("gr-segment-count").textContent =
        `Segment ${guidedRun.currentSegmentIndex + 1} of ${guidedRun.segments.length}`;

    const nextIdx = guidedRun.currentSegmentIndex + 1;
    if (nextIdx < guidedRun.segments.length) {
        const next = guidedRun.segments[nextIdx];
        const nextDur = Math.round(next.duration * 60);
        const nextDurStr = nextDur >= 60 ? `${Math.floor(nextDur / 60)}m` : `${nextDur}s`;
        document.getElementById("gr-next-segment").textContent =
            `Next: ${SEGMENT_NAMES[next.type] || next.type} — ${nextDurStr}`;
    } else {
        document.getElementById("gr-next-segment").textContent = "Final segment!";
    }

    // Voice countdowns
    if (remaining <= 10 && remaining > 9 && !guidedRun.announcedWarnings["10"] && durationSec > 20) {
        guidedRun.announcedWarnings["10"] = true;
        speakText("10 seconds");
    }
    if (remaining <= 3 && remaining > 2 && !guidedRun.announcedWarnings["3"] && durationSec > 10) {
        guidedRun.announcedWarnings["3"] = true;
        speakText("3");
    }
    if (remaining <= 2 && remaining > 1 && !guidedRun.announcedWarnings["2"] && durationSec > 10) {
        guidedRun.announcedWarnings["2"] = true;
        speakText("2");
    }
    if (remaining <= 1 && remaining > 0 && !guidedRun.announcedWarnings["1"] && durationSec > 10) {
        guidedRun.announcedWarnings["1"] = true;
        speakText("1");
    }

    if (remaining <= 0) {
        clearInterval(guidedRun.segmentInterval);
        startSegment(guidedRun.currentSegmentIndex + 1);
    }
}

function pauseGuidedRun() {
    if (!guidedRun) return;
    clearInterval(guidedRun.segmentInterval);
    guidedRun._pauseStart = Date.now();
}

function resumeGuidedRun() {
    if (!guidedRun || !guidedRun._pauseStart) return;
    guidedRun.segmentPausedElapsed += (Date.now() - guidedRun._pauseStart) / 1000;
    delete guidedRun._pauseStart;
    guidedRun.segmentInterval = setInterval(() => updateGuidedRunUI(), 500);
}

function completeGuidedRun() {
    if (!guidedRun) return;
    clearInterval(guidedRun.segmentInterval);

    speakText("Workout complete! Great job!");

    // Mark session complete in course progress
    getCourseProgress(guidedRun.courseId).then(progress => {
        if (progress && progress.level === guidedRun.level) {
            if (!progress.completedSessions.find(s => s.sessionIndex === guidedRun.sessionIndex)) {
                progress.completedSessions.push({ sessionIndex: guidedRun.sessionIndex, date: Date.now() });
                const course = COURSES.find(c => c.id === guidedRun.courseId);
                const total = course.levels[progress.level].sessions.length;
                if (progress.completedSessions.length >= total) progress.status = "completed";
                saveCourseProgress(progress);
            }
        }

        document.getElementById("guided-run-panel").style.display = "none";
        guidedRun = null;

        // Stop the run
        document.getElementById("stop").click();
    });
}
