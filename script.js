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

let gpsFilter = null;
// Smoothed speed from the GPS filter, for the live pace readout: { mps, at }
let currentSpeed = null;
// Effort check-ins during a Tune-In run: [[moving ms, rating 1-5]]
let runRatings = [];
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
let lastRawFixTime = null;
let estimatedDistance = 0;
let hiddenDuringRunMs = 0;
// One entry per accepted GPS fix: [moving ms, metres, lat, lng, speed m/s|null, bearing °|null]
let trackData = [];
// Latest speed/bearing reported by the GPS receiver itself (Doppler), for the AR ghost view
let lastGpsMotion = null;

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

function getRunById(runId) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(["runs"], "readonly");
        const req = tx.objectStore("runs").get(runId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = (e) => reject("Error retrieving run: " + e.target.error);
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

// Turns the run screen into the finished run's summary.
function displayRunSummary(run) {
    document.getElementById("distance").textContent = (run.distance / 1000).toFixed(2);
    document.getElementById("time").textContent = formatDuration(run.time);
    document.getElementById("pace").textContent = run.distance > 0 ? formatPace(run.pace) : "--:--";
    const summaryElement = document.getElementById("rs-summary");
    summaryElement.innerHTML = `
        <div class="rs-summary-title">Run complete · ${formatRunDate(run.startTime)}</div>
        ${run.estimatedDistance > 50 ? `<p class="summary-note">${(run.estimatedDistance / 1000).toFixed(2)} km was estimated in straight lines across GPS gaps (screen off or app in background), so the real distance is probably a little higher.</p>` : ""}
        <p class="summary-extra"></p>`;
    summaryRunId = run.runId;
    setRunScreenState("finished");
    openRunScreen();
    // Show the whole route
    const points = (run.pathSegments || []).flat().filter(p => p && p.length === 2);
    if (points.length > 1) {
        pathLine.setLatLngs(run.pathSegments.filter(seg => seg.length));
        setTimeout(() => map.fitBounds(L.latLngBounds(points), { padding: [24, 24], maxZoom: 17 }), 100);
    }
    renderHomeRecent();

    // Route ranking and workout result, once the other runs are loaded
    getAllRuns().then(all => {
        const runs = all.filter(r => r.endTime);
        const lines = [];
        const r = routeFor(findRoutes(runs), run.runId);
        if (r) {
            const n = r.route.ranked.entries.length;
            lines.push(r.rank === 1
                ? `🥇 Fastest of ${n} runs on ${escapeHtml(r.route.name)}!`
                : `${ordinal(r.rank)} of ${n} on ${escapeHtml(r.route.name)} (best ${formatTime(Math.round(r.route.ranked.entries[0].timeMs / 1000))})`);
        }
        if (run.guided) {
            const rep = RunAnalysis.guidedReport(run, run.guided, RunAnalysis.fiveKPace(runs, run.startTime));
            if (rep && rep.judged) lines.push(`Workout: ${rep.onTarget} of ${rep.judged} segments on target.`);
        }
        if (run.ratings && run.ratings.length) {
            const avg = run.ratings.reduce((sum, x) => sum + x[1], 0) / run.ratings.length;
            lines.push(`You checked in ${run.ratings.length} times · average effort ${avg.toFixed(1)} of 5.`);
        }
        summaryElement.querySelector(".summary-extra").innerHTML = lines.join("<br>");
    }).catch(() => {});
}

// ─── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
    initDB()
        .then(() => {
            initMap();
            initTabs();
            renderCourseGrid();
            return NativeTracker.available ? resumeNativeSession() : null;
        })
        .then(() => {
            checkForInterruptedRun();
            renderHomeRecent();
            updateHomeGpsWatch();
        })
        .catch(error => console.error("Failed to initialize database:", error));
});

function initMap() {
    map = L.map("map").setView([0, 0], 2);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    userMarker = L.marker([0, 0]).addTo(map);
    pathLine = L.polyline([], { color: "red", weight: 4 }).addTo(map);
    gapLine = L.polyline([], { color: "#999", weight: 2, dashArray: "8,8", opacity: 0.5 }).addTo(map);
    setTimeout(() => map.invalidateSize(), 500);
    // The map moves between the Run tab and the run screen, which size it differently
    if (window.ResizeObserver) new ResizeObserver(() => map.invalidateSize()).observe(document.getElementById("map"));
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            map.setView([latitude, longitude], 15);
            userMarker.setLatLng([latitude, longitude]);
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
            if (tab.dataset.tab === "history") {
                renderHistory();
            }
            if (tab.dataset.tab === "track") {
                setTimeout(() => map.invalidateSize(), 100);
                renderHomeRecent();
            }
            updateHomeGpsWatch();
        });
    });
}

function showTab(name) {
    const tab = document.querySelector(`.tab[data-tab="${name}"]`);
    if (tab && !tab.classList.contains("active")) tab.click();
}

// ─── Run Tracking (start/pause/stop) ──────────────────────────────────────────

document.getElementById("start").addEventListener("click", () => {
    document.getElementById("start").disabled = true;
    if (window.speechSynthesis) speechSynthesis.cancel();
    totalDistance = 0;
    estimatedDistance = 0;
    hiddenDuringRunMs = 0;
    prevPosition = null;
    nextMilestone = 1000;
    startTime = Date.now();
    lastMilestoneTime = startTime;
    pathSegments = [];
    currentSegment = [];
    gapCoords = [];
    elapsedTime = 0;
    timeSeriesData = [];
    trackData = [];
    lastGpsMotion = null;
    currentSpeed = null;
    runRatings = [];
    lastTimeSeriesDistance = 0;
    lastTimeSeriesTime = 0;

    document.getElementById("distance").textContent = "0.00";
    document.getElementById("time").textContent = "0:00";
    document.getElementById("pace").textContent = "--:--";
    renderCurrentPace();
    document.getElementById("rs-summary").innerHTML = "";
    setRunScreenState("running");
    openRunScreen();
    updateHomeGpsWatch();

    if (pathLine) pathLine.setLatLngs([]);
    if (gapLine) gapLine.setLatLngs([]);
    if (ghostMarker) { map.removeLayer(ghostMarker); ghostMarker = null; }

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
                timeSeries: [],
                // What this run was racing / following, for the run detail page
                ghost: ghostRace ? Object.assign({ label: ghostRace.label }, ghostRace.spec) : null,
                guided: guidedRun ? {
                    courseId: guidedRun.courseId, level: guidedRun.level, sessionIndex: guidedRun.sessionIndex,
                    title: guidedRun.session.title, segments: guidedRun.segments,
                } : null,
            });
        })
        .then(() => {
            clearInterval(timerInterval);
            updateTimer();
            isPaused = false;
            pausedTime = 0;
            gpsFilter = null;
            lastFixTime = null;
            document.getElementById("pause").disabled = false;
            document.getElementById("start").disabled = true;
            document.getElementById("stop").disabled = false;
            document.getElementById("lock-screen").disabled = false;
            if (NativeTracker.available) {
                // The Android service tracks GPS and speaks cues even with the screen locked
                nativeRun = true;
                return startNativeRun();
            }
            requestWakeLock();
            startBackgroundAudio();
            watchId = startTracking();
        })
        .then(() => startAutoSave())
        .catch(error => {
            console.error("Error starting run:", error);
            if (nativeRun) {
                alert(error && error.code === "PERMISSION_DENIED"
                    ? "Location permission denied. Please enable location access to track your run."
                    : "Could not start the run: " + (error && error.message || error));
                nativeRun = false;
                db.transaction(["runs"], "readwrite").objectStore("runs").delete(currentRunId);
                currentRunId = null;
                endRun(Date.now());
                return;
            }
            document.getElementById("start").disabled = false;
            closeRunScreen();
        });
});

document.getElementById("pause").addEventListener("click", () => {
    if (nativeRun) return nativePauseToggle();
    if (!isPaused) {
        navigator.geolocation.clearWatch(watchId);
        clearInterval(timerInterval);
        pausedTime = Date.now();
        isPaused = true;
        renderPauseButton(true);
        renderRunBar();
        if (guidedRun) pauseGuidedRun();
    } else {
        startTime += (Date.now() - pausedTime);
        lastMilestoneTime += (Date.now() - pausedTime);
        prevPosition = null;
        gpsFilter = null;
        updateTimer();
        watchId = startTracking();
        isPaused = false;
        renderPauseButton(false);
        if (guidedRun) resumeGuidedRun();
    }
});

function stopRun() {
    if (nativeRun) return nativeStop();
    navigator.geolocation.clearWatch(watchId);
    endRun(Date.now());
}

// Finishing needs a 1 s hold, so a stray tap (or a pocket) can't end the run.
(function initHoldToFinish() {
    const btn = document.getElementById("stop");
    const label = btn.querySelector(".btn-label");
    let timer = null;
    const cancel = () => {
        clearTimeout(timer);
        timer = null;
        btn.classList.remove("holding");
        label.textContent = "Hold to finish";
    };
    btn.addEventListener("pointerdown", e => {
        if (btn.disabled) return;
        e.preventDefault();
        btn.classList.add("holding");
        label.textContent = "Keep holding…";
        timer = setTimeout(() => { cancel(); stopRun(); }, 1000);
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach(ev => btn.addEventListener(ev, cancel));
    btn.addEventListener("contextmenu", e => e.preventDefault());
    btn.addEventListener("click", () => { if (!timer) showToast("Hold the button to finish your run.", 2500); });
})();

// Resets the run UI and saves the finished run. Returns a promise.
function endRun(endTime) {
    clearInterval(timerInterval);
    stopAutoSave();
    releaseWakeLock();
    stopBackgroundAudio();
    hideLockOverlay();
    updateGpsStatus(null);
    currentSpeed = null;
    renderCurrentPace();
    watchId = null;
    if (ghostMarker) { map.removeLayer(ghostMarker); ghostMarker = null; }
    document.getElementById("lock-screen").disabled = true;
    document.getElementById("start").disabled = false;
    document.getElementById("stop").disabled = true;
    document.getElementById("pause").disabled = true;
    renderPauseButton(false);

    if (isPaused) startTime += (endTime - pausedTime);
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

    const runTime = (endTime - startTime) / 1000;
    const pace = totalDistance > 0 ? (runTime / (totalDistance / 1000)) : 0;

    if (!currentRunId) { closeRunScreen(); return Promise.resolve(); }
    return getRunById(currentRunId)
        .then(runData => {
            runData = runData || { runId: currentRunId, startTime: startTime };
            runData.endTime = endTime;
            runData.distance = totalDistance;
            runData.time = runTime;
            runData.pace = pace;
            runData.timeSeries = timeSeriesData;
            runData.track = trackData;
            runData.pathSegments = [...pathSegments, currentSegment];
            runData.estimatedDistance = estimatedDistance;
            if (runRatings.length) runData.ratings = runRatings;
            return updateRun(runData).then(() => displayRunSummary(runData));
        })
        .catch(error => console.error("Error updating run:", error));
}

// ─── Utility ───────────────────────────────────────────────────────────────────

function speakText(text) {
    if (NativeTracker.available) { NativeTracker.speak(text); return; }
    if (!window.speechSynthesis) return;
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
            runData.track = trackData;
            runData.pathSegments = [...pathSegments, currentSegment];
            runData.estimatedDistance = estimatedDistance;
            if (runRatings.length) runData.ratings = runRatings;
            store.put(runData);
        }
    };
}

function checkForInterruptedRun() {
    getAllRuns().then(runs => {
        const tx = db.transaction(["runs"], "readwrite");
        const unfinished = runs.filter(r => r.endTime === null && r.runId !== currentRunId);
        unfinished.filter(r => !(r.distance > 50))
            .forEach(r => tx.objectStore("runs").delete(r.runId));
        const interrupted = unfinished.find(r => r.distance > 50);
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
    if (nativeRun) {
        // The service kept tracking while hidden; pull anything we missed.
        if (!document.hidden) {
            resyncNativeRun();
            if (map) setTimeout(() => map.invalidateSize(), 200);
        }
        return;
    }
    const running = watchId != null && !isPaused;
    if (document.hidden) {
        window._lastHiddenTime = Date.now();
        if (currentRunId && running) autoSaveRun();
    } else {
        if (running && window._lastHiddenTime) {
            const hiddenMs = Date.now() - window._lastHiddenTime;
            hiddenDuringRunMs += hiddenMs;
            if (hiddenMs > GAP_THRESHOLD_MS) {
                showToast(`Screen was off for ${formatTime(Math.round(hiddenMs / 1000))}. The browser pauses GPS while the screen is off, so that stretch is estimated as a straight line. Use the lock button instead of the power button to keep tracking accurately.`);
            }
        }
        if (running) requestWakeLock();
        if (bgAudioCtx && bgAudioCtx.state === 'suspended') {
            bgAudioCtx.resume().catch(() => {});
        }
        if (map) setTimeout(() => map.invalidateSize(), 200);
        delete window._lastHiddenTime;
    }
});

// ─── In-app lock (keeps the page visible so GPS keeps running) ────────────────

let lockHoldTimer = null;

function showLockOverlay() {
    const overlay = document.getElementById("lock-overlay");
    overlay.style.display = "flex";
    updateLockOverlay();
    if (overlay.requestFullscreen) overlay.requestFullscreen().catch(() => {});
}

function hideLockOverlay() {
    document.getElementById("lock-overlay").style.display = "none";
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
}

function updateLockOverlay() {
    const overlay = document.getElementById("lock-overlay");
    if (overlay.style.display !== "flex") return;
    document.getElementById("lock-distance").textContent = (totalDistance / 1000).toFixed(2);
    document.getElementById("lock-time").textContent = document.getElementById("time").textContent;
    document.getElementById("lock-pace").textContent = document.getElementById("pace").textContent;
    document.getElementById("lock-current-pace").textContent = document.getElementById("current-pace").textContent;
    const ghostEl = document.getElementById("lock-ghost");
    ghostEl.textContent = ghostRace ? document.getElementById("ghost-diff").textContent : "";
    const grEl = document.getElementById("lock-guided");
    grEl.textContent = guidedRun && guidedRun.currentSegmentIndex >= 0
        ? `${document.getElementById("gr-segment-type").textContent} · ${document.getElementById("gr-time-remaining").textContent}`
        : "";
}

document.getElementById("lock-screen").addEventListener("click", showLockOverlay);

(function initLockOverlay() {
    const overlay = document.getElementById("lock-overlay");
    const hint = document.getElementById("lock-hint");
    const startHold = (e) => {
        e.preventDefault();
        hint.textContent = "Keep holding…";
        lockHoldTimer = setTimeout(() => {
            hint.textContent = "Hold for 2 seconds to unlock";
            hideLockOverlay();
        }, 2000);
    };
    const cancelHold = () => {
        clearTimeout(lockHoldTimer);
        hint.textContent = "Hold for 2 seconds to unlock";
    };
    overlay.addEventListener("pointerdown", startHold);
    overlay.addEventListener("pointerup", cancelHold);
    overlay.addEventListener("pointercancel", cancelHold);
    overlay.addEventListener("pointerleave", cancelHold);
    overlay.addEventListener("contextmenu", e => e.preventDefault());
})();

// ─── Status helpers ────────────────────────────────────────────────────────────

function updateGpsStatus(accuracy) {
    const el = document.getElementById("gps-status");
    if (accuracy == null) { el.textContent = ""; el.className = ""; return; }
    const good = accuracy <= MAX_ACCURACY_M;
    el.textContent = good ? `GPS ±${Math.round(accuracy)} m` : `Weak GPS ±${Math.round(accuracy)} m — waiting for a better signal`;
    el.className = good ? "gps-good" : "gps-weak";
}

function showToast(text, ms = 10000) {
    const toast = document.getElementById("toast");
    toast.textContent = text;
    toast.style.display = "block";
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { toast.style.display = "none"; }, ms);
}

function updateTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        elapsedTime = ((Date.now() - startTime) / 1000);
        document.getElementById("time").textContent = formatDuration(elapsedTime);
        if (totalDistance > 0) {
            const paceInSeconds = (elapsedTime / (totalDistance / 1000));
            document.getElementById("pace").textContent = formatPace(paceInSeconds);
        }
        renderCurrentPace();
        if (ghostRace) updateGhostPanel();
        updateLockOverlay();
        renderRunBar();
    }, 1000);
}

// Pace right now from the GPS filter's smoothed speed. Blank when you're
// paused, standing (slower than ~20 min/km) or the last fix is stale.
function renderCurrentPace() {
    const s = currentSpeed;
    const live = s && !isPaused && Date.now() - s.at < 5000 && s.mps >= 0.8;
    document.getElementById("current-pace").textContent = live ? formatPace(1000 / s.mps) : "--:--";
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

// Chrome/Safari stop delivering GPS to a page that isn't visible (screen off or
// app switched), so a gap between fixes is normal. Rather than throwing away the
// distance covered during a gap, bridge it with a straight line (an underestimate
// on curvy routes, but far better than zero) as long as the implied speed is
// plausible for running.
const GAP_THRESHOLD_MS = 10000;
const MAX_SPEED_MPS = 12.5;
const MAX_ACCURACY_M = 20;

function classifyFix(prev, curr) {
    const dist = getDistance(prev.lat, prev.lon, curr.lat, curr.lon);
    const dt = (curr.time - prev.time) / 1000;
    const isGap = curr.time - prev.lastRawTime > GAP_THRESHOLD_MS;
    if (dt > 0 && dist / dt > MAX_SPEED_MPS) return { action: "reject", dist, dt, isGap };
    if (!isGap && dist < 3) return { action: "skip", dist, dt, isGap };
    return { action: "accept", dist, dt, isGap };
}

function startTracking() {
    lastRawFixTime = null;
    return navigator.geolocation.watchPosition(position => {
        const now = Date.now();
        const accuracy = position.coords.accuracy;
        const rawGapStart = lastRawFixTime;
        lastRawFixTime = now;
        updateGpsStatus(accuracy);

        if (accuracy > MAX_ACCURACY_M) return;

        let { latitude, longitude } = position.coords;
        const gpsSpeed = Number.isFinite(position.coords.speed) ? position.coords.speed : null;
        const gpsBearing = Number.isFinite(position.coords.heading) ? position.coords.heading : null;
        lastGpsMotion = { speed: gpsSpeed, bearing: gpsBearing, at: now };

        // After a GPS gap the old velocity says nothing about where you are now
        if (!gpsFilter || (rawGapStart != null && now - rawGapStart > GAP_THRESHOLD_MS)) gpsFilter = new GpsFilter();
        const filtered = gpsFilter.update(latitude, longitude, accuracy, now, gpsSpeed, gpsBearing);
        if (!filtered) return; // a glitch, far from where the filter expects you
        latitude = filtered.lat;
        longitude = filtered.lng;
        currentSpeed = { mps: filtered.speed, at: now };

        if (!prevPosition) {
            // First fix of the run, or first fix after resuming from pause
            lastFixTime = now;
            if (currentSegment.length > 0) {
                pathSegments.push([...currentSegment]);
                currentSegment = [];
            }
            currentSegment.push([latitude, longitude]);
            pathLine.setLatLngs([...pathSegments, currentSegment]);
            userMarker.setLatLng([latitude, longitude]);
            map.setView([latitude, longitude]);
            prevPosition = { lat: latitude, lon: longitude };
            addTrackPoint(now, latitude, longitude, gpsSpeed, gpsBearing);
            return;
        }

        const fix = classifyFix(
            { lat: prevPosition.lat, lon: prevPosition.lon, time: lastFixTime, lastRawTime: rawGapStart ?? lastFixTime },
            { lat: latitude, lon: longitude, time: now }
        );

        if (fix.action === "skip") return;
        if (fix.action === "reject") {
            // After a long gap a bad first fix could otherwise poison every later
            // one; start a fresh segment without counting distance.
            if (fix.isGap) {
                pathSegments.push([...currentSegment]);
                currentSegment = [[latitude, longitude]];
                prevPosition = { lat: latitude, lon: longitude };
                lastFixTime = now;
                addTrackPoint(now, latitude, longitude, gpsSpeed, gpsBearing);
            }
            return;
        }

        const dist = fix.dist;
        const timeDelta = fix.dt;
        lastFixTime = now;

        if (fix.isGap && currentSegment.length > 0) {
            pathSegments.push([...currentSegment]);
            gapCoords.push([currentSegment[currentSegment.length - 1], [latitude, longitude]]);
            gapLine.setLatLngs(gapCoords);
            currentSegment = [[latitude, longitude]];
            estimatedDistance += dist;
        } else {
            currentSegment.push([latitude, longitude]);
        }
        prevPosition = { lat: latitude, lon: longitude };

        totalDistance += dist;
        addTrackPoint(now, latitude, longitude, gpsSpeed, gpsBearing);
        document.getElementById("distance").textContent = (totalDistance / 1000).toFixed(2);
        pathLine.setLatLngs([...pathSegments, currentSegment]);
        userMarker.setLatLng([latitude, longitude]);
        map.setView([latitude, longitude]);

        const currentTimeMs = now - startTime;
        const instantPace = timeDelta > 0 && dist > 0 ? (timeDelta / (dist / 1000)) : 0;

        if (totalDistance - lastTimeSeriesDistance >= timeSeriesInterval) {
            timeSeriesData.push({
                distance: Math.floor(totalDistance / timeSeriesInterval) * timeSeriesInterval,
                time: currentTimeMs,
                lat: latitude,
                lng: longitude,
                pace: instantPace
            });
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

        if (totalDistance >= nextMilestone) announceMilestone(now);
        if (ghostRace) {
            const cue = RunAnalysis.ghostCue(ghostRace.cue, {
                yourDist: totalDistance, targetM: ghostRace.targetM, now,
                ghostDist: getGhostDistanceAtTime(ghostRace.ghostTimeSeries, now - startTime),
            });
            if (cue) speakText(cue);
        }

        // Timers are throttled while the page is hidden, so also drive the ghost
        // panel from GPS fixes to catch the finish line promptly.
        if (ghostRace) updateGhostPanel();
    }, (error) => {
        console.error("Geolocation error:", error);
        if (error.code === error.PERMISSION_DENIED) {
            alert("Location permission denied. Please enable location access to track your run.");
        }
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
}

// Same shape and rounding as RunJson.trackPoint on Android.
function addTrackPoint(now, lat, lng, speed, bearing) {
    trackData.push([
        now - startTime,
        Math.round(totalDistance * 10) / 10,
        Math.round(lat * 1e7) / 1e7,
        Math.round(lng * 1e7) / 1e7,
        speed == null ? null : Math.round(speed * 100) / 100,
        bearing == null ? null : Math.round(bearing * 10) / 10,
    ]);
}

function announceMilestone(now) {
    // A gap can cross several kilometres at once; announce only the latest.
    const km = Math.floor(totalDistance / 1000);
    const splitSec = Math.round((now - lastMilestoneTime) / 1000);
    const kmCovered = km - (nextMilestone / 1000) + 1;
    let msg = kmCovered > 1
        ? `${km} kilometers. ${formatTime(Math.round((now - startTime) / 1000))} elapsed.`
        : `You've completed ${km} kilometer${km > 1 ? "s" : ""} in ${formatTime(splitSec)}.`;

    if (ghostRace) {
        const ghostTimeMs = getGhostTimeAtDistance(ghostRace.ghostTimeSeries, km * 1000);
        const yourTimeMs = now - startTime;
        if (ghostTimeMs !== null) {
            const diffStr = formatTime(Math.round(Math.abs(ghostTimeMs - yourTimeMs) / 1000));
            if (yourTimeMs < ghostTimeMs) msg += ` ${diffStr} ahead of your ghost.`;
            else if (yourTimeMs > ghostTimeMs) msg += ` ${diffStr} behind your ghost.`;
        }
    } else if (window.previousRunTimeSeries) {
        const previousTime = findPreviousTime(window.previousRunTimeSeries, km * 1000);
        if (previousTime !== null) {
            const diff = previousTime - (now - startTime);
            const diffStr = formatTime(Math.round(Math.abs(diff) / 1000));
            if (diff > 0) msg += ` ${diffStr} faster than your last run.`;
            else if (diff < 0) msg += ` ${diffStr} slower than your last run.`;
        }
    }

    speakText(msg);
    nextMilestone = (km + 1) * 1000;
    lastMilestoneTime = now;
}

// ─── Ghost Race ───────────────────────────────────────────────────────────────

// Starts a run against a ghost. `spec` says which ghost (see buildGhost in
// ghost-race.js): a past run, or an even pace to a target time.
function startGhostRaceMode(spec) {
    if (document.getElementById("start").disabled) {
        alert("Stop your current run before starting a ghost race.");
        return;
    }
    buildGhost(spec).then(ghost => {
        ghostRace = {
            spec,
            label: ghost.label,
            targetM: ghost.targetM,
            // Dense when the ghost's run has a per-fix track: exact path and pacing
            ghostTimeSeries: ghost.series,
            ghostSplits: ghost.splits,
            ghostPace: ghost.pace,
            finished: false,
            cue: {},
        };

        showGhostPanel(ghostRace.label, ghostRace.ghostPace);
        document.getElementById("start").click();
    }).catch(err => alert("Couldn't set up that ghost: " + (err && err.message || err)));
}

function showGhostPanel(label, ghostPace) {
    const panel = document.getElementById("ghost-panel");
    panel.style.display = "block";
    document.getElementById("ghost-panel-title").textContent = `Ghost Race: ${label}`;
    document.getElementById("ghost-your-dist").textContent = "0.00 km";
    document.getElementById("ghost-ghost-dist").textContent = "0.00 km";
    document.getElementById("ghost-your-pace").textContent = "--:-- /km";
    document.getElementById("ghost-ghost-pace").textContent = formatTime(Math.floor(ghostPace)) + " /km";
    document.getElementById("ghost-diff").textContent = "Starting...";
    document.getElementById("ghost-diff").className = "ghost-diff-bar";
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

    const targetDist = ghostRace.targetM;
    const yourFinished = totalDistance >= targetDist;
    const ghostFinished = ghostDist >= targetDist;

    const diff = totalDistance - ghostDist;
    const diffEl = document.getElementById("ghost-diff");

    if (ghostRace.finished) return;
    if (yourFinished) {
        ghostRace.finished = true;
        const ghostTimeMs = getGhostTimeAtDistance(ghostRace.ghostTimeSeries, targetDist);
        if (ghostTimeMs !== null && elapsedMs < ghostTimeMs) {
            diffEl.textContent = `You beat your ghost by ${formatTime(Math.round((ghostTimeMs - elapsedMs) / 1000))}!`;
            diffEl.className = "ghost-diff-bar ahead";
            if (!nativeRun) speakText("You beat your ghost!");
        } else {
            diffEl.textContent = "Ghost wins this time. Keep pushing!";
            diffEl.className = "ghost-diff-bar behind";
            if (!nativeRun) speakText("Ghost wins. Great effort, keep training!");
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

// ─── Run history ─────────────────────────────────────────────────────────────

const HISTORY_PAGE = 20;
let historyShown = HISTORY_PAGE;

function formatRunDate(t) {
    const d = new Date(t);
    return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) +
        " · " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// 1:05:09 for an hour or more, otherwise 54:27
function formatDuration(seconds) {
    const s = Math.floor(seconds);
    if (s < 3600) return formatTime(s);
    return `${Math.floor(s / 3600)}:${formatTime(s % 3600).padStart(5, "0")}`;
}

function runCardHtml(run) {
    const tag = run.guided ? run.guided.title : run.ghost ? `vs ${run.ghost.label || "ghost"}` : "";
    return `
        <button class="run-card" data-id="${run.runId}" ${run.endTime ? "" : "disabled"}>
            <div class="run-card-top">
                <span class="run-card-date">${formatRunDate(run.startTime)}</span>
                ${tag ? `<span class="run-card-tag">${escapeHtml(tag)}</span>` : ""}
                ${run.endTime ? "" : '<span class="run-card-tag warn">unfinished</span>'}
            </div>
            <div class="run-card-stats">
                <span><b>${(run.distance / 1000).toFixed(2)}</b> km</span>
                <span><b>${formatDuration(run.time || 0)}</b></span>
                <span><b>${run.distance > 0 && run.pace ? formatPace(run.pace) : "--:--"}</b> /km</span>
            </div>
        </button>`;
}

function bindRunCards(container) {
    container.querySelectorAll(".run-card").forEach(b =>
        b.addEventListener("click", () => openRunDetail(Number(b.dataset.id))));
}

function renderHistory() {
    const el = document.getElementById("history-list");
    loadAllRuns().then(all => {
        // The run in progress lives in the run bar, not here
        const runs = all.filter(r => !(isRunLive() && r.runId === currentRunId));
        if (!runs.length) {
            el.innerHTML = '<p class="empty-note">No runs yet. Your runs will show up here.</p>';
            return;
        }
        el.innerHTML = runs.slice(0, historyShown).map(runCardHtml).join("") +
            (runs.length > historyShown ? '<button class="btn-small history-more">Show more</button>' : "");
        bindRunCards(el);
        const more = el.querySelector(".history-more");
        if (more) more.addEventListener("click", () => { historyShown += HISTORY_PAGE; renderHistory(); });
    });
}

// The last few runs under the Start button
function renderHomeRecent() {
    const el = document.getElementById("home-recent");
    loadAllRuns().then(runs => {
        const done = runs.filter(r => r.endTime).slice(0, 3);
        if (!done.length) { el.innerHTML = ""; return; }
        el.innerHTML = `<div class="section-head"><h3>Recent runs</h3><button class="link-btn" id="home-all">See all</button></div>` +
            done.map(runCardHtml).join("");
        bindRunCards(el);
        document.getElementById("home-all").addEventListener("click", () => showTab("history"));
    });
}

function loadAllRuns() {
    return getAllRuns().then(runs => runs.sort((a, b) => b.startTime - a.startTime));
}

// ─── Run screen ────────────────────────────────────────────────────────────────
// Full screen while a run is in progress ("running"/"paused"), then the
// finished run's summary ("finished"). Back (or the chevron) minimises a live
// run to a bar on top of the tabs; it keeps going.

let summaryRunId = null;

function runScreen() { return document.getElementById("run-screen"); }

function isRunScreenOpen() { return runScreen().style.display !== "none"; }

function setRunScreenState(state) {
    runScreen().dataset.state = state;
}

function placeMap(slotId) {
    const slot = document.getElementById(slotId);
    const el = document.getElementById("map");
    if (el.parentNode !== slot) slot.appendChild(el);
    if (map) setTimeout(() => map.invalidateSize(), 50);
}

function openRunScreen() {
    const el = runScreen();
    if (!isRunScreenOpen()) {
        el.style.display = "flex";
        document.body.classList.add("rs-open");
        try { if (!(history.state && history.state.runScreen)) history.pushState({ runScreen: true }, ""); } catch (e) { /* not allowed here */ }
    }
    placeMap("rs-map-slot");
    renderRunBar();
}

// Hides the run screen; a live run stays reachable from the bar.
function minimiseRunScreen(fromHistory) {
    if (!isRunScreenOpen()) return;
    runScreen().style.display = "none";
    document.body.classList.remove("rs-open");
    placeMap("home-map-slot");
    if (!fromHistory && history.state && history.state.runScreen) history.back();
    if (runScreen().dataset.state === "finished") resetRunScreen();
    renderRunBar();
    updateHomeGpsWatch();
}

function closeRunScreen() {
    setRunScreenState("finished");
    minimiseRunScreen(false);
}

function resetRunScreen() {
    summaryRunId = null;
    document.getElementById("rs-summary").innerHTML = "";
    document.getElementById("guided-run-panel").style.display = "none";
    document.getElementById("ghost-panel").style.display = "none";
    if (pathLine) pathLine.setLatLngs([]);
    if (gapLine) gapLine.setLatLngs([]);
}

function isRunLive() {
    return document.getElementById("start").disabled;
}

function renderRunBar() {
    const bar = document.getElementById("run-bar");
    const show = isRunLive() && !isRunScreenOpen();
    bar.style.display = show ? "flex" : "none";
    if (show) {
        document.getElementById("run-bar-text").textContent =
            `${isPaused ? "Paused" : "Running"} · ${(totalDistance / 1000).toFixed(2)} km · ${document.getElementById("time").textContent}`;
    }
}

function renderPauseButton(paused) {
    document.getElementById("pause").innerHTML = paused
        ? '<span class="material-icons">play_arrow</span><span class="btn-label">Resume</span>'
        : '<span class="material-icons">pause</span><span class="btn-label">Pause</span>';
    runScreen().dataset.state = paused ? "paused" : "running";
}

document.getElementById("run-bar").addEventListener("click", openRunScreen);
document.getElementById("rs-minimise").addEventListener("click", () => minimiseRunScreen(false));
document.getElementById("rs-done-btn").addEventListener("click", () => closeRunScreen());
document.getElementById("rs-details").addEventListener("click", () => { if (summaryRunId) openRunDetail(summaryRunId); });

window.addEventListener("popstate", () => {
    // Back from the run detail page lands on the run screen's entry: stay
    if (history.state && history.state.runScreen) return;
    if (isRunScreenOpen()) minimiseRunScreen(true);
});

// ─── GPS status before a run ──────────────────────────────────────────────────
// Watches GPS only while the Run tab is on screen and no run is going, so you
// can see when it's locked on before you start.

let homeGpsWatch = null;

function updateHomeGpsWatch() {
    const want = !isRunLive() && !document.hidden &&
        document.getElementById("tab-track").classList.contains("active") && !isRunScreenOpen();
    if (want && homeGpsWatch == null && navigator.geolocation) {
        const el = document.getElementById("home-gps");
        el.textContent = "Finding GPS…";
        el.className = "home-gps";
        homeGpsWatch = navigator.geolocation.watchPosition(pos => {
            const acc = Math.round(pos.coords.accuracy);
            const good = pos.coords.accuracy <= MAX_ACCURACY_M;
            el.textContent = good ? `GPS ready · ±${acc} m` : `Weak GPS · ±${acc} m — move into the open`;
            el.className = "home-gps " + (good ? "gps-good" : "gps-weak");
            if (map && !isRunLive()) {
                userMarker.setLatLng([pos.coords.latitude, pos.coords.longitude]);
                map.setView([pos.coords.latitude, pos.coords.longitude], Math.max(map.getZoom(), 15));
            }
        }, err => {
            el.textContent = err.code === err.PERMISSION_DENIED ? "Location is off — allow it to track runs" : "Finding GPS…";
            el.className = "home-gps gps-weak";
        }, { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 });
    } else if (!want && homeGpsWatch != null) {
        navigator.geolocation.clearWatch(homeGpsWatch);
        homeGpsWatch = null;
    }
}

document.addEventListener("visibilitychange", updateHomeGpsWatch);

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
        startBtn.style.display = "";
        if (progress && progress.level === selectedLevel) {
            // The "Up next" card takes over
            startBtn.style.display = "none";
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

function sessionMinutes(sess) {
    return Math.round((sess.segments || []).reduce((sum, seg) => sum + seg.duration, 0));
}

// The first session not done yet, or -1 when the course is finished.
function nextSessionIndex(level, progress) {
    const done = new Set((progress ? progress.completedSessions : []).map(s => s.sessionIndex));
    return level.sessions.findIndex((_, i) => !done.has(i));
}

// A card with one big button to start a session.
function upNextHtml(course, levelKey, idx) {
    const sess = course.levels[levelKey].sessions[idx];
    return `
        <div class="up-next-card">
            <div class="up-next-label">Up next · Week ${sess.week}, day ${sess.day}</div>
            <div class="up-next-title">${sess.title}</div>
            <div class="up-next-meta">${sessionMinutes(sess)} min · ${sess.description}</div>
            <button class="up-next-start guided-run-btn" data-idx="${idx}" data-course="${course.id}" data-level="${levelKey}">
                <span class="material-icons">play_arrow</span> Start guided run
            </button>
        </div>`;
}

function bindGuidedButtons(container) {
    container.querySelectorAll(".guided-run-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            startGuidedRun(btn.dataset.course, btn.dataset.level, parseInt(btn.dataset.idx));
        });
    });
}

function renderSessionList(course, levelKey, progress) {
    const level = course.levels[levelKey];
    const container = document.getElementById("session-list");
    container.innerHTML = "";

    const enrolled = progress && progress.level === levelKey;
    const completedIndices = enrolled
        ? new Set(progress.completedSessions.map(s => s.sessionIndex))
        : new Set();
    const next = enrolled ? nextSessionIndex(level, progress) : -1;

    const upNext = document.getElementById("up-next");
    upNext.innerHTML = next >= 0 ? upNextHtml(course, levelKey, next)
        : enrolled ? '<div class="up-next-card done">🎉 Course complete!</div>' : "";
    bindGuidedButtons(upNext);

    // One collapsible block per week; the week you're on (or week 1) starts open
    const openWeek = next >= 0 ? level.sessions[next].week : 1;
    const weeks = new Map();
    level.sessions.forEach((sess, idx) => {
        if (!weeks.has(sess.week)) weeks.set(sess.week, []);
        weeks.get(sess.week).push(idx);
    });

    weeks.forEach((indices, week) => {
        const doneCount = indices.filter(i => completedIndices.has(i)).length;
        const block = document.createElement("details");
        block.className = "session-week";
        block.open = week === openWeek;
        block.innerHTML = `<summary class="session-week-header">
            <span>Week ${week}</span>
            <span class="week-progress">${doneCount === indices.length ? "✓ done" : enrolled ? `${doneCount}/${indices.length}` : `${indices.length} sessions`}</span>
        </summary>`;

        indices.forEach(idx => {
            const sess = level.sessions[idx];
            const isCompleted = completedIndices.has(idx);
            const card = document.createElement("div");
            card.className = `session-card type-${sess.type}${isCompleted ? " completed" : ""}${idx === next ? " is-next" : ""}`;

            let segmentsHtml = "";
            if (sess.segments && sess.segments.length > 0) {
                // Fun Runs have dozens of segments: show the games, not every easy stretch
                const shown = sess.type === "fun" ? sess.segments.filter(s => s.label !== "Easy cruise") : sess.segments;
                segmentsHtml = '<div class="sc-segments">' +
                    shown.map(s => {
                        const durStr = s.duration >= 1
                            ? `${Math.round(s.duration)} min`
                            : `${Math.round(s.duration * 60)}s`;
                        return `<span class="sc-segment seg-${s.type}">${s.label || s.type} ${durStr}</span>`;
                    }).join("") + "</div>";
            }

            let actionHtml = "";
            if (isCompleted) {
                actionHtml = '<span class="completed-badge">✓ Done</span>';
            } else {
                actionHtml = `<button class="guided-run-btn" data-idx="${idx}" data-course="${course.id}" data-level="${levelKey}">▶ Guided Run</button>`;
                if (enrolled) {
                    actionHtml += ` <button class="mark-complete-btn" data-idx="${idx}">Mark Complete</button>`;
                }
            }

            card.innerHTML = `
                <div class="sc-header">
                    <span class="sc-title">Day ${sess.day}: ${sess.title}</span>
                    <span class="sc-type">${sessionMinutes(sess)} min · ${sess.type}</span>
                </div>
                <p class="sc-desc">${sess.description}</p>
                ${segmentsHtml}
                ${actionHtml}`;
            block.appendChild(card);
        });
        container.appendChild(block);
    });

    container.querySelectorAll(".mark-complete-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            markSessionComplete(parseInt(btn.dataset.idx));
        });
    });
    bindGuidedButtons(container);
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
        const next = nextSessionIndex(level, prog);
        const nextEl = document.getElementById("acb-next");
        nextEl.innerHTML = next >= 0 ? upNextHtml(course, prog.level, next) : "";
        bindGuidedButtons(nextEl);
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
    sprint: "Sprint", jog: "Jog", walk: "Walk", rest: "Rest",
    play: "Play", stride: "Stride"
};

function segmentLabel(seg) {
    return seg.label || SEGMENT_NAMES[seg.type] || seg.type;
}

// ─── Tune-In coach (web runs; see coach.js) ────────────────────────────────────

function newCoach(segments) {
    return new TuneInCoach(segments.map(s => ({
        target: s.target, surges: !!s.surges, durationMs: Math.round(s.duration * 60) * 1000,
    })));
}

function runElapsedMs() {
    return (isPaused ? pausedTime : Date.now()) - startTime;
}

function coachSay(phrases) {
    phrases.forEach(p => speakText(p));
    if (guidedRun && guidedRun.coach) guidedRun.coachState = guidedRun.coach.state(runElapsedMs());
    renderCoach();
}

// You tapped a rating (1-5) on the run screen
function rateEffort(rating) {
    if (!guidedRun) return;
    if (nativeRun) {
        NativeTracker.rate(rating).catch(err => console.error("Rating failed:", err));
    } else if (guidedRun.coach) {
        runRatings = guidedRun.coach.ratings;
        coachSay(guidedRun.coach.rate(rating, runElapsedMs()));
    }
    showToast(`Got it: ${rating} · ${EFFORT_LABELS[rating]}`, 1500);
    const box = document.getElementById("gr-coach");
    box.classList.add("rated");
    setTimeout(() => box.classList.remove("rated"), 600);
}

// The coach box in the guided panel: what to aim for, and the 1-5 buttons
function renderCoach() {
    const box = document.getElementById("gr-coach");
    if (!guidedRun) { box.style.display = "none"; return; }
    if (guidedRun.coach) guidedRun.coachState = guidedRun.coach.state(runElapsedMs());
    const st = guidedRun.coachState;
    if (!st || !st.active) { box.style.display = "none"; return; }
    box.style.display = "block";
    box.classList.toggle("asking", !!st.asking);
    box.classList.toggle("surge", st.mode === "surge");
    box.classList.toggle("recover", st.mode === "recover");
    document.getElementById("gr-coach-aim").textContent = st.instruction;
    document.getElementById("gr-coach-ask").textContent = st.asking ? "How hard does it feel?" : "Tap any time to tell me how it feels";
    box.querySelectorAll(".rate-btn").forEach(b => b.classList.toggle("last", Number(b.dataset.r) === st.lastRating));
}

document.querySelectorAll("#gr-coach .rate-btn").forEach(btn =>
    btn.addEventListener("click", () => rateEffort(Number(btn.dataset.r))));

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
        // Tune-In sessions: the Android service runs its own coach and reports its state
        coach: TuneInCoach.isCoached(sess.segments) && !NativeTracker.available ? newCoach(sess.segments) : null,
        coachState: null,
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
        showGuidedPanel(sess);

        // Start the actual run (GPS + timer)
        document.getElementById("start").click();

        // Countdown then start first segment (the Android service runs its own)
        if (NativeTracker.available) return;
        speakText("Get ready. Starting in 5 seconds.");
        setTimeout(() => {
            if (guidedRun) startSegment(0);
        }, 5000);
    });
}

function showGuidedPanel(sess) {
    const panel = document.getElementById("guided-run-panel");
    panel.style.display = "block";
    panel.className = "";
    document.getElementById("gr-session-name").textContent = sess.title;
    document.getElementById("gr-segment-type").textContent = "GET READY";
    document.getElementById("gr-segment-intensity").textContent = "";
    document.getElementById("gr-time-remaining").textContent = "";
    document.getElementById("gr-next-segment").textContent = `First: ${segmentLabel(sess.segments[0])}`;
    guidedRun.coachState = null;
    renderCoach();
    document.getElementById("gr-segment-count").textContent = `${sess.segments.length} segments total`;
    document.getElementById("gr-segment-progress").style.width = "0%";
}

function startSegment(index, scheduledStart = Date.now()) {
    if (!guidedRun) return;
    if (index >= guidedRun.segments.length) {
        completeGuidedRun();
        return;
    }

    guidedRun.currentSegmentIndex = index;
    guidedRun.segmentStartTime = scheduledStart;
    guidedRun.segmentPausedElapsed = 0;
    guidedRun.announcedWarnings = {};

    const seg = guidedRun.segments[index];
    const durationSec = Math.round(seg.duration * 60);

    // When catching up after throttled timers, skip segments that already ended
    if (Date.now() < scheduledStart + durationSec * 1000) announceSegment(seg, durationSec);
    if (guidedRun.coach) coachSay(guidedRun.coach.startSegment(index, runElapsedMs()));
    updateGuidedRunUI();
    // updateGuidedRunUI may already have advanced past this segment
    if (!guidedRun || guidedRun.currentSegmentIndex !== index || guidedRun.completing) return;

    clearInterval(guidedRun.segmentInterval);
    guidedRun.segmentInterval = setInterval(() => updateGuidedRunUI(), 500);
}

function announceSegment(seg, durationSec) {
    if (seg.say) { speakText(seg.say); return; }
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

    if (guidedRun.coach) coachSay(guidedRun.coach.tick(runElapsedMs()));
    renderGuidedPanel(remaining);

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
        const segEnd = guidedRun.segmentStartTime + (durationSec + guidedRun.segmentPausedElapsed) * 1000;
        startSegment(guidedRun.currentSegmentIndex + 1, segEnd);
    }
}

// Draws the current segment of guidedRun with `remaining` seconds left.
function renderGuidedPanel(remaining) {
    const seg = guidedRun.segments[guidedRun.currentSegmentIndex];
    const durationSec = Math.round(seg.duration * 60);

    // Update panel color
    const panel = document.getElementById("guided-run-panel");
    panel.className = `seg-${seg.type}`;

    document.getElementById("gr-segment-type").textContent = segmentLabel(seg).toUpperCase();
    // Games and strides show what to do; coached segments show it in the coach box
    const intensity = document.getElementById("gr-segment-intensity");
    intensity.textContent = (seg.type === "play" || seg.type === "stride") && seg.say ? seg.say : seg.intensity;
    intensity.style.display = seg.target != null ? "none" : "";
    renderCoach();

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
            `Next: ${segmentLabel(next)} — ${nextDurStr}`;
    } else {
        document.getElementById("gr-next-segment").textContent = "Final segment!";
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
    if (!guidedRun || guidedRun.completing) return;
    guidedRun.completing = true;
    clearInterval(guidedRun.segmentInterval);

    speakText("Workout complete! Great job!");

    // Mark session complete in course progress
    markGuidedSessionComplete(guidedRun.courseId, guidedRun.level, guidedRun.sessionIndex).then(() => {
        document.getElementById("guided-run-panel").style.display = "none";
        guidedRun = null;

        // Stop the run
        stopRun();
    });
}

function markGuidedSessionComplete(courseId, level, sessionIndex) {
    return getCourseProgress(courseId).then(progress => {
        if (!progress || progress.level !== level) return;
        if (progress.completedSessions.find(s => s.sessionIndex === sessionIndex)) return;
        progress.completedSessions.push({ sessionIndex, date: Date.now() });
        const course = COURSES.find(c => c.id === courseId);
        const total = course.levels[progress.level].sessions.length;
        if (progress.completedSessions.length >= total) progress.status = "completed";
        return saveCourseProgress(progress);
    });
}
