// ar-ghost.js — AR view for ghost races: the rear camera with your ghost drawn
// where it would be if it were running beside you.
//
// Where the ghost is: the race is decided on distance, and the ghost's recorded
// run may have been on a different route, so the ghost is placed relative to
// *your* route using the distance gap:
//   - ghost behind: on your own GPS trail, that many metres back
//   - ghost ahead, and you're on the same route as the ghost's run: on its
//     recorded route, shifted by your offset from that route (so the two GPS
//     tracks line up)
//   - ghost ahead otherwise: projected straight along your direction of travel
// Which way the camera points comes from the phone's fused rotation sensor
// (native in the app, deviceorientation in a browser), corrected to true north,
// with an optional one-tap alignment against your GPS direction of travel.

const ArGhost = (() => {
    const M = ArMath;
    const PHONE_HEIGHT_M = 1.35;   // camera height when held while running
    const GHOST_CENTER_M = 0.95;   // ghost's centre above the ground
    const GHOST_HALF_M = 0.85;     // half the ghost's height (a 1.7 m runner)
    const MIN_DIST_M = 2;          // never draw the ghost closer than this
    const MAX_EXTRAPOLATE_S = 1.5; // dead-reckon your position between GPS fixes for at most this long
    const GPS_BEARING_MIN_SPEED = 1.2; // m/s; below this the GPS bearing is noise
    const ROUTE_MATCH_M = 30, ROUTE_LOST_M = 60, ROUTE_FIXES = 3;
    const RADAR_RANGES = [25, 50, 100, 200, 500, 1000, 2000];

    let isOpen = false;
    let els = null;
    let stream = null;
    let raf = 0;
    let wakeLock = null;
    let view = { W: 0, H: 0, box: null };

    // Orientation
    let qTarget = null, qSmooth = null;
    let orientationSource = null;      // "native" | "compass" | "relative"
    let lastOrientationAt = 0;
    let headingAccuracy = null, sensorStatus = null;
    let nativeListenerAdded = false;
    let webEvent = null, webHandler = null;
    let openedAt = 0;

    // Heading corrections (radians, true heading = sensor heading + offset)
    let declination = 0, declinationAsked = false;
    let alignOffset = 0, alignRunId = null;

    // Camera optics
    let optics = null;

    // Your track, refreshed when a new GPS fix lands
    let trail = { key: "", segs: [], point: null, dist: 0, at: 0, heading: null, speed: 0 };
    let route = { hits: 0, misses: 0, same: false, offset: null };
    let radarTrail = [], radarRoute = [];

    let smoothRel = null;
    let lastFrame = 0, lastHud = 0;
    let paceSamples = [];
    let lead = null;
    let bannerTimer = null;

    // ─── Open / close ────────────────────────────────────────────────────────

    function open() {
        if (isOpen || !ghostRace) return;
        isOpen = true;
        els = els || grabElements();
        if (alignRunId !== currentRunId) { alignOffset = 0; alignRunId = currentRunId; }
        resetState();

        els.overlay.style.display = "block";
        measure();
        // These need the tap that opened the view, so start them before anything async
        if (els.overlay.requestFullscreen) els.overlay.requestFullscreen().catch(() => {});
        const askMotion = !NativeTracker.available && typeof DeviceOrientationEvent !== "undefined" &&
            typeof DeviceOrientationEvent.requestPermission === "function"
            ? DeviceOrientationEvent.requestPermission().catch(() => "denied")
            : Promise.resolve("granted");

        askMotion.then(() => { if (isOpen) startOrientation(); });
        startCamera();
        requestWakeLockAr();
        openedAt = performance.now();
        lastFrame = openedAt;
        raf = requestAnimationFrame(frame);
    }

    function close() {
        if (!isOpen) return;
        isOpen = false;
        cancelAnimationFrame(raf);
        els.overlay.style.display = "none";
        if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
        els.video.srcObject = null;
        stopOrientation();
        if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
        if (document.fullscreenElement === els.overlay && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    }

    function resetState() {
        qTarget = qSmooth = null;
        orientationSource = null;
        lastOrientationAt = 0;
        trail = { key: "", segs: [], point: null, dist: 0, at: 0, heading: null, speed: 0 };
        route = { hits: 0, misses: 0, same: false, offset: null };
        smoothRel = null;
        paceSamples = [];
        lead = null;
        lastHud = 0;
        els.cameraMsg.textContent = "";
        els.banner.classList.remove("show");
    }

    function grabElements() {
        const $ = (id) => document.getElementById(id);
        const e = {
            overlay: $("ar-overlay"), video: $("ar-video"), cameraMsg: $("ar-camera-msg"),
            ghost: $("ar-ghost"), tag: $("ar-ghost-tag"), shadow: $("ar-shadow"),
            edge: $("ar-edge"), edgeLabel: $("ar-edge-label"),
            gap: $("ar-gap"), gapSub: $("ar-gap-sub"), gapCard: $("ar-gap-card"),
            youDist: $("ar-you-dist"), youPace: $("ar-you-pace"),
            ghostDist: $("ar-ghost-dist"), ghostPace: $("ar-ghost-pace"),
            trackYou: $("ar-track-you"), trackGhost: $("ar-track-ghost"), trackEnd: $("ar-track-end"),
            status: $("ar-status"), chips: $("ar-chips"),
            top: document.querySelector(".ar-top"), bottom: document.querySelector(".ar-bottom"), banner: $("ar-banner"), radar: $("ar-radar"),
        };
        $("ar-close").addEventListener("click", close);
        $("ar-align").addEventListener("click", align);
        e.video.addEventListener("loadedmetadata", measure);
        return e;
    }

    function measure() {
        if (!els) return;
        view.W = els.overlay.clientWidth || window.innerWidth;
        view.H = els.overlay.clientHeight || window.innerHeight;
        // Free area between the top HUD and the bottom bar, for off-screen arrows
        const top = els.top.getBoundingClientRect().bottom + 40;
        const bottom = view.H - els.bottom.offsetHeight - 40;
        view.box = { left: 40, right: view.W - 40, top: Math.min(top, view.H / 2 - 20), bottom: Math.max(bottom, view.H / 2 + 20) };
        const dpr = window.devicePixelRatio || 1;
        const size = els.radar.clientWidth || 120;
        els.radar.width = Math.round(size * dpr);
        els.radar.height = Math.round(size * dpr);
    }

    function requestWakeLockAr() {
        if (!("wakeLock" in navigator)) return;
        navigator.wakeLock.request("screen").then(l => {
            if (isOpen) wakeLock = l; else l.release();
        }).catch(() => {});
    }

    // ─── Camera ──────────────────────────────────────────────────────────────

    function startCamera() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            els.cameraMsg.textContent = "Camera not available here (the browser needs HTTPS). The ghost is still placed using the compass.";
            return;
        }
        navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        }).then(s => {
            if (!isOpen) { s.getTracks().forEach(t => t.stop()); return; }
            stream = s;
            els.video.srcObject = s;
            els.video.play().catch(() => {});
            const track = s.getVideoTracks()[0];
            // Chrome labels Android cameras "camera2 <id>, facing back"
            const m = track && /camera2 (\d+)/.exec(track.label || "");
            requestOptics(m ? m[1] : null);
        }).catch(err => {
            els.cameraMsg.textContent = err && err.name === "NotAllowedError"
                ? "Camera permission denied. The ghost is still placed using the compass."
                : "Couldn't open the camera. The ghost is still placed using the compass.";
            requestOptics(null);
        });
    }

    // Asks the app for the real optics of the camera the WebView opened.
    function requestOptics(cameraId) {
        if (!NativeTracker.available) return;
        NativeTracker.getArInfo(cameraId != null ? { cameraId } : {})
            .then(info => { if (info.camera) optics = info.camera; })
            .catch(() => {});
    }

    // Magnetic declination turns the sensor's magnetic north into true north (GPS bearings).
    function requestDeclination(point) {
        if (!NativeTracker.available || declinationAsked) return;
        declinationAsked = true;
        NativeTracker.getArInfo({ lat: point[0], lon: point[1] })
            .then(info => { if (info.declination != null) declination = info.declination * M.DEG; })
            .catch(() => { declinationAsked = false; });
    }

    // Focal length in CSS pixels of what's on screen.
    function screenFocal() {
        const v = els.video;
        let vw = v.videoWidth, vh = v.videoHeight;
        if (!vw || !vh) {
            // Not streaming: assume a 16:9 stream oriented like the screen
            const portrait = view.H >= view.W;
            vw = portrait ? 720 : 1280;
            vh = portrait ? 1280 : 720;
        }
        return M.displayFocal(M.streamFocalPx(vw, vh, optics), vw, vh, view.W, view.H);
    }

    // ─── Orientation ─────────────────────────────────────────────────────────

    function startOrientation() {
        if (NativeTracker.available) {
            if (!nativeListenerAdded) {
                NativeTracker.onOrientation(onNativeOrientation);
                nativeListenerAdded = true;
            }
            NativeTracker.startOrientation().catch(startWebOrientation);
            return;
        }
        startWebOrientation();
    }

    function stopOrientation() {
        if (NativeTracker.available) NativeTracker.stopOrientation().catch(() => {});
        if (webHandler) {
            window.removeEventListener(webEvent, webHandler);
            webHandler = null;
        }
    }

    function onNativeOrientation(e) {
        if (!isOpen || !e || !e.q) return;
        qTarget = e.q;
        headingAccuracy = e.headingAccuracy;
        sensorStatus = e.status;
        orientationSource = "native";
        lastOrientationAt = performance.now();
    }

    function startWebOrientation() {
        if (webHandler) return;
        const hasAbsolute = "ondeviceorientationabsolute" in window;
        webEvent = hasAbsolute ? "deviceorientationabsolute" : "deviceorientation";
        webHandler = (e) => {
            if (e.alpha == null || e.beta == null || e.gamma == null) return;
            let alpha = e.alpha;
            let absolute = hasAbsolute || e.absolute === true;
            if (typeof e.webkitCompassHeading === "number") {
                alpha = 360 - e.webkitCompassHeading; // iOS
                absolute = true;
            }
            qTarget = M.quatFromEuler(alpha, e.beta, e.gamma);
            orientationSource = absolute ? "compass" : "relative";
            lastOrientationAt = performance.now();
        };
        window.addEventListener(webEvent, webHandler);
    }

    function headingOffset() {
        return declination + alignOffset;
    }

    // Tap while pointing the camera the way you're running: corrects compass error.
    function align() {
        if (!qSmooth) { flash("No motion sensor data yet"); return; }
        if (trail.heading == null) { flash("Start running first. Align uses your GPS direction of travel."); return; }
        const R = M.quatToMatrix(qSmooth);
        if (Math.hypot(R[0][2], R[1][2]) < 0.5) { flash("Hold the phone upright, camera facing where you're running"); return; }
        const camTrue = M.cameraHeading(R) + headingOffset();
        const delta = M.wrapAngle(trail.heading - camTrue);
        alignOffset = M.wrapAngle(alignOffset + delta);
        flash(`Aligned: compass corrected by ${Math.round(delta / M.DEG)}°`);
    }

    // ─── Your track and the ghost's position ─────────────────────────────────

    function elapsedMs() {
        return (isPaused ? pausedTime : Date.now()) - startTime;
    }

    function refreshTrail(now) {
        const key = `${pathSegments.length}:${currentSegment.length}:${totalDistance}`;
        if (key === trail.key) return;
        const segs = pathSegments.concat([currentSegment]);
        const point = M.lastTrailPoint(segs);
        if (trail.point && now > trail.at) {
            const inst = (totalDistance - trail.dist) / ((now - trail.at) / 1000);
            if (inst >= 0 && inst < 12) trail.speed = trail.speed ? trail.speed * 0.6 + inst * 0.4 : inst;
        }
        trail.key = key;
        trail.segs = segs;
        trail.point = point;
        trail.dist = totalDistance;
        trail.at = now;
        trail.heading = M.trailHeading(segs);
        // The receiver's Doppler bearing and speed are instant and accurate while moving;
        // the trail-based heading lags ~15 m behind at corners, so it's only the fallback.
        const gm = lastGpsMotion;
        if (gm && Date.now() - gm.at < 3000 && gm.speed != null) {
            trail.speed = gm.speed;
            if (gm.speed > GPS_BEARING_MIN_SPEED && gm.bearing != null) trail.heading = gm.bearing * M.DEG;
        }
        if (point) {
            requestDeclination(point);
            if (route.hits + route.misses === 0) {
                // Just opened: judge the last stretch of trail too, so a match doesn't wait for new fixes
                for (const back of [30, 20, 10]) {
                    if (totalDistance - back > 0) updateRouteMatch(M.trailPointBack(segs, back), totalDistance - back);
                }
            }
            updateRouteMatch(point, totalDistance);
            cacheRadarPaths(point);
        }
    }

    // Are you running the same route as the ghost's recorded run?
    function updateRouteMatch(point, distance) {
        const gp = M.ghostRoutePointAt(ghostRace.ghostTimeSeries, distance);
        if (!gp) { route.misses++; route.hits = 0; }
        else {
            const off = M.enu(gp, point);
            const d = Math.hypot(off[0], off[1]);
            if (d < ROUTE_MATCH_M) {
                route.hits++; route.misses = 0;
                route.offset = route.offset
                    ? [route.offset[0] * 0.7 + off[0] * 0.3, route.offset[1] * 0.7 + off[1] * 0.3]
                    : off;
            } else if (d > ROUTE_LOST_M) {
                route.misses++; route.hits = 0;
            }
        }
        if (route.hits >= ROUTE_FIXES) route.same = true;
        if (route.misses >= ROUTE_FIXES) { route.same = false; route.offset = null; }
    }

    // Ghost position relative to you, in metres east/north (true north).
    function ghostState(now) {
        const target = ghostRace.targetM;
        const el = elapsedMs();
        const ghostDist = Math.min(getGhostDistanceAtTime(ghostRace.ghostTimeSeries, el), target);
        const h = trail.heading;
        const sinceFix = (now - trail.at) / 1000;
        const extrap = !isPaused && h != null && trail.speed > 0.5
            ? trail.speed * Math.min(Math.max(sinceFix, 0), MAX_EXTRAPOLATE_S) : 0;
        const yourDist = trail.point ? trail.dist + extrap : totalDistance;
        const s = { ghostDist, yourDist, gap: yourDist - ghostDist, el, rel: null, placement: null, reason: null };

        if (!trail.point) { s.reason = "Waiting for GPS…"; return s; }

        const along = ghostDist - trail.dist; // ghost's position relative to your last fix, along the course
        let ghost = null;
        if (along <= 0) {
            ghost = M.enu(trail.point, M.trailPointBack(trail.segs, -along));
            s.placement = "trail";
        } else if (route.same && route.offset) {
            const gp = M.ghostRoutePointAt(ghostRace.ghostTimeSeries, ghostDist);
            if (gp) {
                const v = M.enu(trail.point, gp);
                ghost = [v[0] + route.offset[0], v[1] + route.offset[1]];
                s.placement = "route";
            }
        }
        if (!ghost) {
            if (h == null) { s.reason = "Start running so I know which way is forward"; return s; }
            ghost = [Math.sin(h) * along, Math.cos(h) * along];
            s.placement = "projected";
        }
        const you = h != null ? [Math.sin(h) * extrap, Math.cos(h) * extrap] : [0, 0];
        let rel = [ghost[0] - you[0], ghost[1] - you[1]];

        const r = Math.hypot(rel[0], rel[1]);
        if (r < MIN_DIST_M) {
            if (h != null) {
                const sign = s.gap > 0 ? -1 : 1;
                rel = [Math.sin(h) * MIN_DIST_M * sign, Math.cos(h) * MIN_DIST_M * sign];
            } else if (r > 0.05) {
                rel = [rel[0] / r * MIN_DIST_M, rel[1] / r * MIN_DIST_M];
            } else {
                s.reason = "Ghost is right with you";
                return s;
            }
        }
        s.rel = rel;
        return s;
    }

    // ─── Frame loop ──────────────────────────────────────────────────────────

    function frame(now) {
        if (!isOpen) return;
        if (!ghostRace) { close(); return; }
        raf = requestAnimationFrame(frame);
        const dt = Math.min((now - lastFrame) / 1000, 0.25);
        lastFrame = now;

        if (qTarget) {
            qSmooth = qSmooth ? M.quatNlerp(qSmooth, qTarget, 1 - Math.exp(-dt / 0.06)) : qTarget.slice();
        }
        refreshTrail(now);
        const s = ghostState(now);
        if (s.rel) {
            const a = 1 - Math.exp(-dt / 0.3);
            smoothRel = smoothRel ? [smoothRel[0] + (s.rel[0] - smoothRel[0]) * a, smoothRel[1] + (s.rel[1] - smoothRel[1]) * a] : s.rel.slice();
        } else {
            smoothRel = null;
        }

        const sensorsStale = !qSmooth || now - lastOrientationAt > 2000;
        let R = null;
        if (!sensorsStale) R = M.quatToMatrix(qSmooth);

        drawGhost(R, s);
        drawRadar(R, s);
        if (now - lastHud > 250) {
            lastHud = now;
            updateHud(s, sensorsStale, now);
        }
    }

    function screenAngle() {
        const a = (screen.orientation && typeof screen.orientation.angle === "number")
            ? screen.orientation.angle : (window.orientation || 0);
        return ((a % 360) + 360) % 360;
    }

    function drawGhost(R, s) {
        const { W, H } = view;
        const hide = (el) => { el.style.display = "none"; };
        if (!R || !smoothRel) {
            [els.ghost, els.tag, els.shadow, els.edge, els.edgeLabel].forEach(hide);
            return;
        }
        const off = headingOffset();
        const F = screenFocal();
        const angle = screenAngle();
        const at = (z) => M.project(R, M.trueToSensor([smoothRel[0], smoothRel[1], z - PHONE_HEIGHT_M], off), angle, F, W, H);
        const c = at(GHOST_CENTER_M);
        const top = at(GHOST_CENTER_M + GHOST_HALF_M);
        const ground = at(0);

        const tdx = top.x - c.x, tdy = top.y - c.y;
        const size = Math.min(Math.max(2 * Math.hypot(tdx, tdy), 44), H * 0.6);
        const onScreen = c.depth > 0.5 && top.depth > 0.5 &&
            c.x > -size / 3 && c.x < W + size / 3 && c.y > -size / 3 && c.y < H + size / 3;
        const dist = Math.hypot(smoothRel[0], smoothRel[1]);
        const gapLabel = gapPhrase(s.gap);

        if (onScreen) {
            const roll = Math.atan2(tdx, -tdy) / M.DEG;
            els.ghost.style.display = "block";
            els.ghost.style.transform = `translate(${c.x - 50}px, ${c.y - 50}px) rotate(${roll}deg) scale(${size / 100})`;
            // Farther ghosts fade a little, like haze
            els.ghost.style.opacity = String(Math.max(0.55, 0.95 - dist / 600));

            els.tag.style.display = "block";
            els.tag.style.transform = `translate(${c.x}px, ${c.y + size / 2 + 8}px) translateX(-50%)`;
            els.tag.textContent = `${Math.round(dist)} m · ${gapLabel.short}`;

            if (ground.depth > 0.5) {
                els.shadow.style.display = "block";
                const w = size * 0.55;
                els.shadow.style.transform = `translate(${ground.x - w / 2}px, ${ground.y - w * 0.12}px)`;
                els.shadow.style.width = `${w}px`;
                els.shadow.style.height = `${w * 0.24}px`;
            } else hide(els.shadow);
            hide(els.edge);
            hide(els.edgeLabel);
        } else {
            [els.ghost, els.tag, els.shadow].forEach(hide);
            // Arrow at the edge of the free area pointing the way to turn
            let dx = c.sx, dy = -c.sy;
            if (c.depth <= 0 && Math.abs(dx) < Math.abs(dy) * 0.2) dy = Math.abs(dy) || 1; // straight behind: point down
            const box = view.box;
            const p = M.edgePoint(dx, dy, W / 2, H / 2, box);
            const rot = Math.atan2(dy, dx) / M.DEG;
            els.edge.style.display = "flex";
            els.edge.style.transform = `translate(${p.x - 28}px, ${p.y - 28}px) rotate(${rot}deg)`;

            const camTrue = M.cameraHeading(R) + off;
            const rb = M.wrapAngle(Math.atan2(smoothRel[0], smoothRel[1]) - camTrue) / M.DEG;
            const halfFov = M.fovDeg(F, W) / 2;
            const turn = Math.abs(rb) > 135 ? "turn around"
                : Math.abs(rb) < halfFov ? (c.sy > 0 ? "tilt the phone up" : "tilt the phone down")
                : rb > 0 ? `${Math.round(rb)}° to your right` : `${Math.round(-rb)}° to your left`;
            const html = `👻 ${gapLabel.long}<small>${turn}</small>`;
            if (els.edgeLabel.innerHTML !== html) els.edgeLabel.innerHTML = html;
            els.edgeLabel.style.display = "block";
            // Sit just inside the arrow, towards the centre, without covering it
            const lw = els.edgeLabel.offsetWidth, lh = els.edgeLabel.offsetHeight;
            const n = Math.hypot(dx, dy) || 1;
            const ux = dx / n, uy = dy / n;
            const reach = Math.min((lw / 2 + 36) / Math.max(Math.abs(ux), 1e-3), (lh / 2 + 36) / Math.max(Math.abs(uy), 1e-3));
            const lx = Math.min(Math.max(p.x - ux * reach, lw / 2 + 8), W - lw / 2 - 8);
            const ly = Math.min(Math.max(p.y - uy * reach, box.top + lh / 2), box.bottom - lh / 2);
            els.edgeLabel.style.transform = `translate(${lx - lw / 2}px, ${ly - lh / 2}px)`;
        }
    }

    function gapPhrase(gap) {
        const m = Math.round(Math.abs(gap));
        if (m < 5) return { short: "level", long: "Ghost is level with you" };
        return gap > 0
            ? { short: `${m} m behind`, long: `Ghost ${m} m behind you` }
            : { short: `${m} m ahead`, long: `Ghost ${m} m ahead of you` };
    }

    // ─── Radar ───────────────────────────────────────────────────────────────

    // Your recent trail and (on the same route) the ghost's route ahead, as
    // east/north metres from your last fix.
    function cacheRadarPaths(point) {
        radarTrail = [];
        let total = 0, prev = null;
        outer:
        for (let s = trail.segs.length - 1; s >= 0; s--) {
            for (let i = trail.segs[s].length - 1; i >= 0; i--) {
                const v = M.enu(point, trail.segs[s][i]);
                if (prev) total += Math.hypot(v[0] - prev[0], v[1] - prev[1]);
                radarTrail.push(v);
                prev = v;
                if (total > 2500 || radarTrail.length > 800) break outer;
            }
        }
        radarRoute = [];
        if (route.same && route.offset) {
            for (let d = totalDistance; d <= totalDistance + 1500; d += 15) {
                const gp = M.ghostRoutePointAt(ghostRace.ghostTimeSeries, d);
                if (!gp) break;
                const v = M.enu(point, gp);
                radarRoute.push([v[0] + route.offset[0], v[1] + route.offset[1]]);
            }
        }
    }

    function drawRadar(R, s) {
        const cv = els.radar;
        const ctx = cv.getContext("2d");
        const size = cv.width;
        const dpr = window.devicePixelRatio || 1;
        const r0 = size / 2 - 4 * dpr;
        ctx.clearRect(0, 0, size, size);
        ctx.save();
        ctx.translate(size / 2, size / 2);

        ctx.fillStyle = "rgba(10, 6, 30, 0.55)";
        ctx.beginPath(); ctx.arc(0, 0, r0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.25)";
        ctx.lineWidth = dpr;
        ctx.beginPath(); ctx.arc(0, 0, r0 / 2, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, r0, 0, Math.PI * 2); ctx.stroke();

        const dist = smoothRel ? Math.hypot(smoothRel[0], smoothRel[1]) : 0;
        const range = RADAR_RANGES.find(x => x >= dist * 1.25) || RADAR_RANGES[RADAR_RANGES.length - 1];
        const k = r0 / range;

        // Heading-up: the direction the camera faces (or you run) points up
        const up = R ? M.cameraHeading(R) + headingOffset() : (trail.heading || 0);
        const cu = Math.cos(up), su = Math.sin(up);
        const toXY = (e, n) => [(e * cu - n * su) * k, -(e * su + n * cu) * k];

        // Trail and route are relative to your last fix; you're drawn at your extrapolated position
        const h = trail.heading;
        const ext = h != null ? Math.max(0, s.yourDist - trail.dist) : 0;
        const ox = h != null ? Math.sin(h) * ext : 0, oy = h != null ? Math.cos(h) * ext : 0;
        ctx.save();
        ctx.beginPath(); ctx.arc(0, 0, r0, 0, Math.PI * 2); ctx.clip();
        ctx.lineWidth = 2.5 * dpr;
        const path = (pts, style, dash) => {
            if (pts.length < 2) return;
            ctx.strokeStyle = style;
            ctx.setLineDash(dash.map(d => d * dpr));
            ctx.beginPath();
            pts.forEach((p, i) => {
                const [x, y] = toXY(p[0] - ox, p[1] - oy);
                if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
            });
            ctx.stroke();
        };
        path(radarTrail, "rgba(255, 82, 82, 0.85)", []);
        path(radarRoute, "rgba(179, 136, 255, 0.85)", [4, 4]);
        ctx.restore();
        ctx.setLineDash([]);

        if (R) {
            // Camera field of view
            const half = M.fovDeg(screenFocal(), view.W) / 2 * M.DEG;
            ctx.fillStyle = "rgba(255,255,255,0.13)";
            ctx.beginPath(); ctx.moveTo(0, 0);
            ctx.arc(0, 0, r0, -Math.PI / 2 - half, -Math.PI / 2 + half);
            ctx.closePath(); ctx.fill();
        }

        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        const [nx, ny] = toXY(0, 1);
        const nl = Math.hypot(nx, ny) || 1;
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.font = `bold ${10 * dpr}px Roboto, sans-serif`;
        ctx.fillText("N", nx / nl * (r0 - 8 * dpr), ny / nl * (r0 - 8 * dpr));

        ctx.fillStyle = "#ff5252"; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2 * dpr;
        ctx.beginPath(); ctx.arc(0, 0, 5 * dpr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

        if (smoothRel) {
            let [x, y] = toXY(smoothRel[0], smoothRel[1]);
            const len = Math.hypot(x, y), max = r0 - 9 * dpr;
            if (len > max) { x *= max / len; y *= max / len; }
            ctx.font = `${17 * dpr}px sans-serif`;
            ctx.fillText("👻", x, y);
        }

        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.font = `${9 * dpr}px Roboto, sans-serif`;
        ctx.fillText(range >= 1000 ? `${range / 1000} km` : `${range} m`, 0, r0 / 2 + 8 * dpr);
        ctx.restore();
    }

    // ─── HUD ─────────────────────────────────────────────────────────────────

    function updateHud(s, sensorsStale, now) {
        const target = ghostRace.targetM;
        const g = gapPhrase(s.gap);
        const m = Math.round(Math.abs(s.gap));
        els.gap.textContent = m < 5 ? "Level" : `${m} m`;
        els.gapCard.className = "ar-gap-card " + (m < 5 ? "tied" : s.gap > 0 ? "ahead" : "behind");

        // Time gap: your time at this distance vs the ghost's
        const ghostT = getGhostTimeAtDistance(ghostRace.ghostTimeSeries, Math.min(totalDistance, target));
        let sub = m < 5 ? "neck and neck" : s.gap > 0 ? "ahead of your ghost" : "behind your ghost";
        if (ghostT != null && totalDistance > 20) {
            const dtSec = Math.round((s.el - ghostT) / 1000);
            if (Math.abs(dtSec) >= 1) sub += ` · ${dtSec > 0 ? "+" : "−"}${formatTime(Math.abs(dtSec))}`;
        }
        if (ghostRace.finished) sub = document.getElementById("ghost-diff").textContent;
        else if (s.ghostDist >= target) sub = `Ghost finished · ${((target - totalDistance) / 1000).toFixed(2)} km to go`;
        els.gapSub.textContent = sub;

        // Rolling 30 s pace for you, local pace for the ghost
        paceSamples.push({ t: now, d: totalDistance });
        while (paceSamples.length > 2 && now - paceSamples[0].t > 30000) paceSamples.shift();
        const first = paceSamples[0];
        const dd = totalDistance - first.d;
        let yourPace = null;
        if (dd > 20 && now - first.t > 5000) yourPace = ((now - first.t) / 1000) / (dd / 1000);
        else if (totalDistance > 50) yourPace = (s.el / 1000) / (totalDistance / 1000);
        els.youDist.textContent = `${(totalDistance / 1000).toFixed(2)} km`;
        els.youPace.textContent = yourPace && !isPaused ? `${formatTime(Math.round(yourPace))} /km` : "--:-- /km";
        els.ghostDist.textContent = `${(s.ghostDist / 1000).toFixed(2)} km`;
        const gp = ghostPaceAt(s.ghostDist);
        els.ghostPace.textContent = gp && s.ghostDist < target ? `${formatTime(Math.round(gp))} /km` : "--:-- /km";

        const pct = (d) => `${Math.min(Math.max(d / target, 0), 1) * 100}%`;
        els.trackYou.style.left = pct(totalDistance);
        els.trackGhost.style.left = pct(s.ghostDist);
        els.trackEnd.textContent = RunAnalysis.formatDistance(ghostRace.targetM);

        // Status line
        let status = "";
        if (s.reason) status = s.reason;
        else if (sensorsStale && now - openedAt > 2000) status = "No motion sensor data. The radar still shows where the ghost is.";
        else if (orientationSource === "relative" && !alignOffset) status = "No compass. Face the way you're running and tap Align.";
        else if (orientationSource === "native" && (headingAccuracy != null ? headingAccuracy > 25 : sensorStatus === 1)) status = "Compass needs calibrating: wave the phone in a figure 8";
        else if (isPaused) status = "Paused";
        els.status.textContent = status;
        els.status.style.display = status ? "block" : "none";

        // Chips
        const chips = [];
        if (s.placement === "trail") chips.push("📍 On your trail");
        else if (s.placement === "route") chips.push("📍 On your PB route");
        else if (s.placement === "projected") chips.push("➜ Along your heading");
        if (orientationSource === "native" || orientationSource === "compass") {
            chips.push(headingAccuracy != null && headingAccuracy > 0
                ? `🧭 ±${Math.round(headingAccuracy)}°` : "🧭 Compass");
        }
        if (alignOffset) chips.push("✓ Aligned");
        els.chips.innerHTML = chips.map(c => `<span>${c}</span>`).join("");

        // Overtakes
        const newLead = s.gap > 3 ? "you" : s.gap < -3 ? "ghost" : lead;
        if (lead && newLead !== lead && !ghostRace.finished && totalDistance > 30) {
            flash(newLead === "you" ? "You passed the ghost! 🎉" : "The ghost passed you! 👻💨");
            if (navigator.vibrate) navigator.vibrate(newLead === "you" ? [80, 60, 80] : 300);
        }
        lead = newLead;
    }

    // Ghost's pace (s/km) around a distance, from its recorded splits.
    function ghostPaceAt(d) {
        const ts = ghostRace.ghostTimeSeries;
        const end = ts.length ? ts[ts.length - 1].distance : 0;
        const a = Math.max(0, Math.min(d - 100, end - 200));
        const b = Math.min(end, a + 200);
        if (b - a < 50) return null;
        const ta = getGhostTimeAtDistance(ts, a), tb = getGhostTimeAtDistance(ts, b);
        if (ta == null || tb == null || tb <= ta) return null;
        return ((tb - ta) / 1000) / ((b - a) / 1000);
    }

    function flash(text) {
        els.banner.textContent = text;
        els.banner.classList.add("show");
        clearTimeout(bannerTimer);
        bannerTimer = setTimeout(() => els.banner.classList.remove("show"), 2600);
    }

    // ─── Wiring ──────────────────────────────────────────────────────────────

    document.getElementById("ar-open").addEventListener("click", open);
    window.addEventListener("resize", measure);
    document.addEventListener("visibilitychange", () => { if (document.hidden) close(); });
    document.addEventListener("fullscreenchange", () => setTimeout(measure, 50));

    return { open, close, isOpen: () => isOpen };
})();
