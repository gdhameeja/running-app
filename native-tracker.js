// native-tracker.js — Android integration.
//
// In the Android app (Capacitor), a run is owned by a native foreground service
// (RunTrackerService.kt) that keeps GPS, the clock and voice cues going with the
// screen locked. This page becomes a viewer: it starts/pauses/stops the service,
// mirrors its state into script.js's globals so the existing UI keeps working,
// and saves the finished run to IndexedDB. In a normal browser NativeTracker
// is unavailable and script.js uses its own web tracking.

const NativeTracker = (() => {
    const cap = window.Capacitor;
    const available = !!(cap && cap.isNativePlatform && cap.isNativePlatform() &&
        (cap.PluginHeaders || []).some(p => p.name === "RunTracker"));
    const call = (method, options = {}) => cap.nativePromise("RunTracker", method, options);
    return {
        available,
        start: (config) => call("start", config),
        pause: () => call("pause"),
        resume: () => call("resume"),
        stop: () => call("stop").then(r => r.run || null),
        getState: () => call("getState").then(r => r.run || null),
        clear: () => call("clear"),
        speak: (text) => call("speak", { text }),
        isIgnoringBatteryOptimizations: () => call("isIgnoringBatteryOptimizations").then(r => r.value),
        requestBatteryExemption: () => call("requestBatteryExemption"),
        onUpdate: (cb) => cap.addListener("RunTracker", "update", cb),
        // AR ghost view (ar-ghost.js)
        startOrientation: () => call("startOrientation"),
        stopOrientation: () => call("stopOrientation"),
        onOrientation: (cb) => cap.addListener("RunTracker", "orientation", cb),
        getArInfo: (options) => call("getArInfo", options),
    };
})();

// True while the current run is driven by the native service.
let nativeRun = false;
let nativeResyncing = false;
let nativeFinishedRunId = null;
let lastLocalPauseToggle = 0;

function startNativeRun() {
    const meta = {
        // Meta rides along with every update from the service, so it carries the 100 m
        // splits only; attachNativeRun reloads the full track from IndexedDB.
        ghostRace: ghostRace ? Object.assign({}, ghostRace, { ghostTimeSeries: ghostRace.ghostSplits, ghostSplits: undefined, cue: undefined }) : null,
        guided: guidedRun ? { courseId: guidedRun.courseId, level: guidedRun.level, sessionIndex: guidedRun.sessionIndex } : null,
    };
    return NativeTracker.start({
        runId: currentRunId,
        previousTimeSeries: window.previousRunTimeSeries || null,
        ghost: ghostRace ? { targetM: ghostRace.targetM, timeSeries: ghostRace.ghostTimeSeries } : null,
        guided: guidedRun ? guidedRun.segments.map(s => ({
            type: s.type, durationSec: Math.round(s.duration * 60), intensity: s.intensity
        })) : null,
        meta: JSON.stringify(meta),
    });
}

function parseNativeMeta(run) {
    try { return JSON.parse(run.meta || "{}") || {}; } catch (e) { return {}; }
}

// Called once at startup in the Android app, before checkForInterruptedRun().
function resumeNativeSession() {
    NativeTracker.onUpdate(handleNativeUpdate);
    askForBatteryExemptionOnce();
    return NativeTracker.getState().then(run => {
        if (!run) return;
        if (run.status === "running" || run.status === "paused") {
            attachNativeRun(run);
        } else if (run.status === "finished") {
            // Finished while the page was gone (guided run completed, or "Finish" in the notification)
            nativeRun = true;
            currentRunId = run.runId;
            return handleNativeFinished(run);
        } else if (run.status === "orphaned") {
            // The app was killed mid-run; store what we have so checkForInterruptedRun offers to keep it
            return saveNativeSnapshot(run).then(() => NativeTracker.clear());
        }
    }).catch(err => console.error("Could not restore native run:", err));
}

function askForBatteryExemptionOnce() {
    let asked = false;
    try { asked = localStorage.getItem("batteryExemptionAsked") === "1"; } catch (e) { /* storage unavailable */ }
    if (asked) return;
    NativeTracker.isIgnoringBatteryOptimizations().then(ignoring => {
        try { localStorage.setItem("batteryExemptionAsked", "1"); } catch (e) { /* storage unavailable */ }
        if (ignoring) return;
        if (confirm("To keep tracking reliably with the screen locked, allow Run Tracker to run without battery restrictions on the next screen.")) {
            NativeTracker.requestBatteryExemption();
        }
    });
}

// Re-attach the UI to a run that is still in progress (app reopened, page reloaded).
function attachNativeRun(run) {
    nativeRun = true;
    currentRunId = run.runId;
    const meta = parseNativeMeta(run);
    if (meta.ghostRace) {
        ghostRace = meta.ghostRace;
        // Runs started before ghost specs existed carried targetKm
        if (ghostRace.targetM == null) ghostRace.targetM = (ghostRace.targetKm || 0) * 1000;
        if (!ghostRace.label) ghostRace.label = RunAnalysis.formatDistance(ghostRace.targetM) + " PB";
        ghostRace.ghostSplits = ghostRace.ghostTimeSeries;
        ghostRace.cue = {}; // the service speaks the ghost updates
        showGhostPanel(ghostRace.label, ghostRace.ghostPace);
        if (ghostRace.spec) {
            // Meta only carries the 100 m splits; rebuild the exact ghost
            const race = ghostRace;
            buildGhost(race.spec).then(g => { if (ghostRace === race) race.ghostTimeSeries = g.series; }).catch(() => {});
        }
    }
    if (meta.guided) {
        const course = COURSES.find(c => c.id === meta.guided.courseId);
        const sess = course && course.levels[meta.guided.level].sessions[meta.guided.sessionIndex];
        if (sess) {
            guidedRun = {
                courseId: meta.guided.courseId, level: meta.guided.level, sessionIndex: meta.guided.sessionIndex,
                session: sess, segments: sess.segments, currentSegmentIndex: -1
            };
            showGuidedPanel(sess);
        }
    }
    document.getElementById("start").disabled = true;
    document.getElementById("pause").disabled = false;
    document.getElementById("stop").disabled = false;
    document.getElementById("lock-screen").disabled = false;
    isPaused = false;
    applyNativeSnapshot(run);
    redrawPath();
    updateTimer();
    startAutoSave();
    if (run.status === "paused") setPausedUI(true);
    applyNativeSummary(run);
}

function handleNativeUpdate(s) {
    if (!nativeRun || s.runId !== currentRunId) return;
    if (s.status === "finished") {
        NativeTracker.getState().then(handleNativeFinished);
        return;
    }
    applyNativeSummary(s);
}

// Mirrors a per-fix/per-second summary from the service into the UI.
function applyNativeSummary(s) {
    // A pause/resume tapped in the notification shows up here; ignore the echo of our own taps.
    if (Date.now() - lastLocalPauseToggle > 1500) {
        if (s.status === "paused" && !isPaused) setPausedUI(true);
        else if (s.status === "running" && isPaused) setPausedUI(false);
    }
    syncNativeClock(s);
    totalDistance = s.distance;
    estimatedDistance = s.estimatedDistance;
    if (s.motionAgeMs != null) lastGpsMotion = { speed: s.speed, bearing: s.bearing, at: Date.now() - s.motionAgeMs };
    updateGpsStatus(s.accuracy);
    document.getElementById("distance").textContent = `${(totalDistance / 1000).toFixed(2)} kms`;

    const localPoints = pathSegments.reduce((n, seg) => n + seg.length, 0) + currentSegment.length;
    const sameShape = s.segmentCount === pathSegments.length + 1 && s.gapCount === gapCoords.length;
    if (sameShape && s.pointCount === localPoints + 1 && s.lastPoint) {
        currentSegment.push(s.lastPoint);
        pathLine.setLatLngs([...pathSegments, currentSegment]);
        userMarker.setLatLng(s.lastPoint);
        map.setView(s.lastPoint);
    } else if (!sameShape || s.pointCount !== localPoints) {
        resyncNativeRun();
    }

    if (guidedRun && s.guided) {
        guidedRun.currentSegmentIndex = s.guided.index;
        if (s.guided.index >= 0 && s.guided.index < guidedRun.segments.length) {
            renderGuidedPanel(s.guided.remainingMs / 1000);
        }
    }
    if (ghostRace) updateGhostPanel();
    updateLockOverlay();
}

function syncNativeClock(s) {
    if (s.status === "paused") {
        pausedTime = Date.now();
        startTime = pausedTime - s.elapsedMs;
    } else {
        startTime = Date.now() - s.elapsedMs;
    }
}

// Pulls the full path from the service (after missed updates, e.g. while hidden).
function resyncNativeRun() {
    if (nativeResyncing || !nativeRun) return;
    nativeResyncing = true;
    NativeTracker.getState().then(run => {
        nativeResyncing = false;
        if (!run || run.runId !== currentRunId) return;
        if (run.status === "finished") return handleNativeFinished(run);
        applyNativeSnapshot(run);
        redrawPath();
    }).catch(() => { nativeResyncing = false; });
}

function applyNativeSnapshot(run) {
    syncNativeClock(run);
    totalDistance = run.distance;
    estimatedDistance = run.estimatedDistance;
    timeSeriesData = run.timeSeries || [];
    trackData = run.track || [];
    const segs = run.pathSegments && run.pathSegments.length ? run.pathSegments : [[]];
    pathSegments = segs.slice(0, -1);
    currentSegment = segs[segs.length - 1];
    gapCoords = run.gapCoords || [];
}

function redrawPath() {
    pathLine.setLatLngs([...pathSegments, currentSegment]);
    gapLine.setLatLngs(gapCoords);
    const last = currentSegment[currentSegment.length - 1];
    if (last) {
        userMarker.setLatLng(last);
        map.setView(last, Math.max(map.getZoom(), 15));
    }
    document.getElementById("distance").textContent = `${(totalDistance / 1000).toFixed(2)} kms`;
}

function nativePauseToggle() {
    lastLocalPauseToggle = Date.now();
    if (!isPaused) {
        NativeTracker.pause();
        setPausedUI(true);
    } else {
        NativeTracker.resume();
        setPausedUI(false);
    }
}

function setPausedUI(paused) {
    const pauseButton = document.getElementById("pause");
    if (paused) {
        clearInterval(timerInterval);
        pausedTime = Date.now();
        isPaused = true;
        pauseButton.innerHTML = '<span class="material-icons">play_arrow</span>';
    } else {
        startTime += (Date.now() - pausedTime);
        updateTimer();
        isPaused = false;
        pauseButton.innerHTML = '<span class="material-icons">pause</span>';
    }
}

function nativeStop() {
    document.getElementById("stop").disabled = true;
    NativeTracker.stop()
        .then(handleNativeFinished)
        .catch(err => {
            console.error("Could not stop native run:", err);
            document.getElementById("stop").disabled = false;
        });
}

// Saves a finished native run (stop button, notification, or guided run completing).
function handleNativeFinished(run) {
    if (!run || run.runId !== currentRunId || nativeFinishedRunId === run.runId) return;
    nativeFinishedRunId = run.runId;
    applyNativeSnapshot(run);
    const meta = parseNativeMeta(run);
    const guidedDone = run.guided && run.guided.completed && meta.guided
        ? markGuidedSessionComplete(meta.guided.courseId, meta.guided.level, meta.guided.sessionIndex)
        : Promise.resolve();
    return guidedDone.then(() => {
        isPaused = false;
        startTime = run.endTime - run.elapsedMs;
        nativeRun = false;
        return endRun(run.endTime);
    }).then(() => NativeTracker.clear());
}

// Writes an unfinished snapshot into IndexedDB (endTime stays null).
function saveNativeSnapshot(run) {
    const time = run.elapsedMs / 1000;
    return getRunById(run.runId).then(existing => updateRun(Object.assign(existing || { runId: run.runId, startTime: run.startTime }, {
        endTime: null,
        distance: run.distance,
        time: time,
        pace: run.distance > 0 ? time / (run.distance / 1000) : 0,
        timeSeries: run.timeSeries || [],
        track: run.track || [],
        pathSegments: run.pathSegments || [],
        estimatedDistance: run.estimatedDistance,
    })));
}
