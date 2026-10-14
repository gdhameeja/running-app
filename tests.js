// tests.js — Unit tests for pace calculation and ghost interpolation
// Run with: node tests.js

let passed = 0;
let failed = 0;

function assert(condition, name) {
    if (condition) {
        passed++;
        console.log(`  PASS: ${name}`);
    } else {
        failed++;
        console.log(`  FAIL: ${name}`);
    }
}

function assertApprox(actual, expected, tolerance, name) {
    const ok = Math.abs(actual - expected) < tolerance;
    if (ok) {
        passed++;
        console.log(`  PASS: ${name}`);
    } else {
        failed++;
        console.log(`  FAIL: ${name} (got ${actual}, expected ~${expected})`);
    }
}

// ─── Functions under test (extracted from source) ─────────────────────────────

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
                    ? (distance / timeSeries[0].distance) * timeSeries[0].time : timeSeries[0].time;
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

// ─── Pace Calculation Tests ──────────────────────────────────────────────────

console.log("\n=== Pace Calculation Tests ===\n");

// Normal run: 5km in 25 minutes = 300 sec/km pace
(function testNormalRun() {
    const runs = [{ startTime: 1000000, distance: 5000, time: 1500, pace: 300 }];
    const trend = calcPaceTrend(runs);
    assert(trend.length === 1, "Normal run: included in trend");
    assertApprox(trend[0].pace, 5.0, 0.01, "Normal run: pace is 5.0 min/km");
})();

// Stationary GPS noise: 10m distance in 600 seconds = 60000 sec/km pace
(function testStationaryNoise() {
    const runs = [{ startTime: 1000000, distance: 10, time: 600, pace: 60000 }];
    const trend = calcPaceTrend(runs);
    assert(trend.length === 0, "Stationary noise: filtered out (distance < 500m)");
})();

// Very slow pace: 1km in 25 minutes = 1500 sec/km (25 min/km)
(function testVerySlowPace() {
    const runs = [{ startTime: 1000000, distance: 1000, time: 1500, pace: 1500 }];
    const trend = calcPaceTrend(runs);
    assert(trend.length === 0, "Very slow pace: filtered out (pace > 1200 = 20 min/km)");
})();

// Very fast pace: 1km in 1.5 minutes = 90 sec/km
(function testVeryFastPace() {
    const runs = [{ startTime: 1000000, distance: 1000, time: 90, pace: 90 }];
    const trend = calcPaceTrend(runs);
    assert(trend.length === 0, "Very fast pace: filtered out (pace < 120 = 2 min/km)");
})();

// Edge case: impossible pace 250 min/km = 15000 sec/km
(function testImpossiblePace() {
    const runs = [{ startTime: 1000000, distance: 1000, time: 15000, pace: 15000 }];
    const trend = calcPaceTrend(runs);
    assert(trend.length === 0, "Impossible pace (250 min/km): filtered out");
})();

// Valid slow pace: 1km in 12 minutes = 720 sec/km
(function testValidSlowPace() {
    const runs = [{ startTime: 1000000, distance: 1000, time: 720, pace: 720 }];
    const trend = calcPaceTrend(runs);
    assert(trend.length === 1, "Valid slow pace (12 min/km): included");
    assertApprox(trend[0].pace, 12.0, 0.01, "Valid slow pace: 12.0 min/km");
})();

// Valid fast pace: 1km in 3 minutes = 180 sec/km
(function testValidFastPace() {
    const runs = [{ startTime: 1000000, distance: 1000, time: 180, pace: 180 }];
    const trend = calcPaceTrend(runs);
    assert(trend.length === 1, "Valid fast pace (3 min/km): included");
    assertApprox(trend[0].pace, 3.0, 0.01, "Valid fast pace: 3.0 min/km");
})();

// Zero time
(function testZeroTime() {
    const runs = [{ startTime: 1000000, distance: 5000, time: 0, pace: 0 }];
    const trend = calcPaceTrend(runs);
    assert(trend.length === 0, "Zero time: filtered out");
})();

// ─── Ghost Interpolation Tests ───────────────────────────────────────────────

console.log("\n=== Ghost Interpolation Tests ===\n");

const ghostTimeSeries = [
    { distance: 1000, time: 300000, lat: 12.97, lng: 77.59 },
    { distance: 2000, time: 600000, lat: 12.98, lng: 77.60 },
    { distance: 3000, time: 900000, lat: 12.99, lng: 77.61 },
    { distance: 5000, time: 1500000, lat: 13.00, lng: 77.62 }
];

// Ghost distance at time=0
(function testGhostDistanceAtZero() {
    const dist = getGhostDistanceAtTime(ghostTimeSeries, 0);
    assertApprox(dist, 0, 0.1, "Ghost distance at t=0 is 0");
})();

// Ghost distance at exact midpoint (t=450000 = between 1km@300s and 2km@600s)
(function testGhostDistanceMidpoint() {
    const dist = getGhostDistanceAtTime(ghostTimeSeries, 450000);
    assertApprox(dist, 1500, 1, "Ghost distance at midpoint between 1km and 2km is 1500m");
})();

// Ghost distance at exact data point
(function testGhostDistanceExact() {
    const dist = getGhostDistanceAtTime(ghostTimeSeries, 600000);
    assertApprox(dist, 2000, 0.1, "Ghost distance at exact 600s is 2000m");
})();

// Ghost distance past end
(function testGhostDistancePastEnd() {
    const dist = getGhostDistanceAtTime(ghostTimeSeries, 2000000);
    assertApprox(dist, 5000, 0.1, "Ghost distance past end returns last distance");
})();

// Ghost time at distance=0 (extrapolate from first point)
(function testGhostTimeAtZeroDistance() {
    const time = getGhostTimeAtDistance(ghostTimeSeries, 0);
    assertApprox(time, 0, 1, "Ghost time at d=0 is 0");
})();

// Ghost time at exact midpoint distance (1500m)
(function testGhostTimeMidpoint() {
    const time = getGhostTimeAtDistance(ghostTimeSeries, 1500);
    assertApprox(time, 450000, 1, "Ghost time at 1500m is 450000ms");
})();

// Ghost time at end distance (5000m)
(function testGhostTimeAtEnd() {
    const time = getGhostTimeAtDistance(ghostTimeSeries, 5000);
    assertApprox(time, 1500000, 1, "Ghost time at 5000m is 1500000ms");
})();

// Ghost time past end (6000m) — should return null
(function testGhostTimePastEnd() {
    const time = getGhostTimeAtDistance(ghostTimeSeries, 6000);
    assert(time === null, "Ghost time past last distance returns null");
})();

// Empty time series
(function testGhostEmptySeries() {
    assert(getGhostDistanceAtTime([], 1000) === 0, "Empty series: distance is 0");
    assert(getGhostTimeAtDistance([], 1000) === null, "Empty series: time is null");
    assert(getGhostDistanceAtTime(null, 1000) === 0, "Null series: distance is 0");
    assert(getGhostTimeAtDistance(null, 1000) === null, "Null series: time is null");
})();

// ─── Ghost Position Interpolation Tests ──────────────────────────────────────

console.log("\n=== Ghost Position Interpolation Tests ===\n");

// Position at exact data point
(function testGhostPositionExact() {
    const pos = getGhostPositionAtTime(ghostTimeSeries, 300000);
    assert(pos !== null, "Position at t=300000 exists");
    assertApprox(pos[0], 12.97, 0.001, "Lat at first point");
    assertApprox(pos[1], 77.59, 0.001, "Lng at first point");
})();

// Position at midpoint
(function testGhostPositionMidpoint() {
    const pos = getGhostPositionAtTime(ghostTimeSeries, 450000);
    assert(pos !== null, "Position at midpoint exists");
    assertApprox(pos[0], 12.975, 0.001, "Lat interpolated at midpoint");
    assertApprox(pos[1], 77.595, 0.001, "Lng interpolated at midpoint");
})();

// Position at time=0 (before first point)
(function testGhostPositionAtZero() {
    const pos = getGhostPositionAtTime(ghostTimeSeries, 0);
    assert(pos !== null, "Position at t=0 exists (returns first point)");
    assertApprox(pos[0], 12.97, 0.001, "Lat at t=0");
})();

// Position past end
(function testGhostPositionPastEnd() {
    const pos = getGhostPositionAtTime(ghostTimeSeries, 2000000);
    assert(pos !== null, "Position past end exists (returns last point)");
    assertApprox(pos[0], 13.00, 0.001, "Lat at past-end");
    assertApprox(pos[1], 77.62, 0.001, "Lng at past-end");
})();

// No coordinates in time series
(function testGhostPositionNoCoords() {
    const noCoords = [{ distance: 1000, time: 300000 }];
    const pos = getGhostPositionAtTime(noCoords, 150000);
    assert(pos === null, "No position when time series lacks lat/lng");
})();

// Empty/null
(function testGhostPositionEmpty() {
    assert(getGhostPositionAtTime([], 1000) === null, "Empty series: no position");
    assert(getGhostPositionAtTime(null, 1000) === null, "Null series: no position");
})();

// ─── Haversine Distance Tests ────────────────────────────────────────────────

console.log("\n=== Haversine Distance Tests ===\n");

(function testSamePoint() {
    const d = getDistance(12.97, 77.59, 12.97, 77.59);
    assertApprox(d, 0, 0.1, "Same point: distance is 0");
})();

(function testKnownDistance() {
    // ~111km per degree of latitude
    const d = getDistance(0, 0, 1, 0);
    assertApprox(d, 111195, 500, "1 degree latitude ~111km");
})();

(function testShortDistance() {
    // ~10m movement
    const d = getDistance(12.970000, 77.590000, 12.970090, 77.590000);
    assertApprox(d, 10, 2, "Small lat change ~10m");
})();

// ─── GPS Fix Classification Tests ────────────────────────────────────────────

console.log("\n=== GPS Fix Classification Tests ===\n");

const GAP_THRESHOLD_MS = 10000;
const MAX_SPEED_MPS = 12.5;

function classifyFix(prev, curr) {
    const dist = getDistance(prev.lat, prev.lon, curr.lat, curr.lon);
    const dt = (curr.time - prev.time) / 1000;
    const isGap = curr.time - prev.lastRawTime > GAP_THRESHOLD_MS;
    if (dt > 0 && dist / dt > MAX_SPEED_MPS) return { action: "reject", dist, dt, isGap };
    if (!isGap && dist < 3) return { action: "skip", dist, dt, isGap };
    return { action: "accept", dist, dt, isGap };
}

// ~0.000009 deg latitude per metre
(function testNormalFix() {
    const r = classifyFix({ lat: 12.97, lon: 77.59, time: 0, lastRawTime: 0 },
                          { lat: 12.97 + 0.000009 * 3.5, lon: 77.59, time: 1000 });
    assert(r.action === "accept" && !r.isGap, "3.5m in 1s: accepted, not a gap");
})();

(function testJitterSkipped() {
    const r = classifyFix({ lat: 12.97, lon: 77.59, time: 0, lastRawTime: 0 },
                          { lat: 12.97 + 0.000009, lon: 77.59, time: 1000 });
    assert(r.action === "skip", "1m jitter: skipped");
})();

(function testScreenOffGapBridged() {
    // Screen off for 3 minutes, ran ~540m (3:00/km-ish would be 1km; this is 5:33/km)
    const r = classifyFix({ lat: 12.97, lon: 77.59, time: 0, lastRawTime: 0 },
                          { lat: 12.97 + 0.000009 * 540, lon: 77.59, time: 180000 });
    assert(r.action === "accept", "3-minute gap at running speed: distance kept");
    assert(r.isGap, "3-minute gap: flagged as gap");
    assertApprox(r.dist, 540, 10, "3-minute gap: straight-line distance ~540m");
})();

(function testTeleportRejected() {
    const r = classifyFix({ lat: 12.97, lon: 77.59, time: 0, lastRawTime: 0 },
                          { lat: 12.97 + 0.000009 * 500, lon: 77.59, time: 5000 });
    assert(r.action === "reject", "500m in 5s: rejected as GPS glitch");
})();

(function testStandingStillWithWeakFixesNotGap() {
    // Last accepted fix 30s ago, but weak fixes kept arriving (last raw 1s ago)
    const r = classifyFix({ lat: 12.97, lon: 77.59, time: 0, lastRawTime: 29000 },
                          { lat: 12.97 + 0.000009 * 60, lon: 77.59, time: 30000 });
    assert(r.action === "accept" && !r.isGap, "Weak-signal stretch: distance kept, drawn solid");
})();

// ─── Dense Ghost Track Tests ─────────────────────────────────────────────────

console.log("\n=== Dense Ghost Track Tests ===\n");

function ghostSeriesFromTrack(track) {
    if (!track || track.length < 2) return null;
    return track.map(p => ({ time: p[0], distance: p[1], lat: p[2], lng: p[3] }));
}

(function testGhostReplaysStopAndSurge() {
    // First fix 2 s in; 100 m at 4 m/s, a 20 s stop at a crossing, then 50 m at 5 m/s
    const track = [[2000, 0, 12.97, 77.59, 0, null]];
    for (let t = 1; t <= 25; t++) track.push([2000 + t * 1000, t * 4, 12.97 + t * 4 / 111195, 77.59, 4, 0]);
    for (let t = 1; t <= 20; t++) track.push([27000 + t * 1000, 100, 12.97 + 100 / 111195, 77.59, 0, null]);
    for (let t = 1; t <= 10; t++) track.push([47000 + t * 1000, 100 + t * 5, 12.97 + (100 + t * 5) / 111195, 77.59, 5, 0]);
    const ts = ghostSeriesFromTrack(track);
    assert(ts.length === track.length && ts[0].lat === 12.97, "Track converts point for point");
    assertApprox(getGhostDistanceAtTime(ts, 1000), 0, 0.001, "Ghost waits at the start until its first fix");
    assertApprox(getGhostDistanceAtTime(ts, 14500), 50, 0.001, "Steady stretch: 50 m at 14.5 s");
    assertApprox(getGhostDistanceAtTime(ts, 37000), 100, 0.001, "Ghost stands still during the stop");
    assertApprox(getGhostDistanceAtTime(ts, 50000), 115, 0.001, "Surge after the stop: 5 m/s");
    assertApprox(getGhostTimeAtDistance(ts, 0), 2000, 0.001, "Time at the start line is its first fix");
    assertApprox(getGhostTimeAtDistance(ts, 125), 52000, 0.001, "Time at 125 m includes the stop");
    assert(ghostSeriesFromTrack(null) === null && ghostSeriesFromTrack([[0, 0, 1, 1]]) === null, "No usable track: fall back to splits");
})();

// ─── AR Ghost Geometry Tests ─────────────────────────────────────────────────

console.log("\n=== AR Ghost Geometry Tests ===\n");

const ArMath = require("./ar-math.js");
const DEG_ = Math.PI / 180;

// Phone held upright (beta 90), camera facing north, portrait 400x800, focal 600px
(function testProjectAhead() {
    const R = ArMath.quatToMatrix(ArMath.quatFromEuler(0, 90, 0));
    assertApprox(ArMath.cameraHeading(R) / DEG_, 0, 0.01, "Upright phone facing north: camera heading 0°");
    const p = ArMath.project(R, [0, 20, 0], 0, 600, 400, 800);
    assertApprox(p.x, 200, 0.01, "Point straight ahead: horizontal centre");
    assertApprox(p.y, 400, 0.01, "Point straight ahead at eye level: vertical centre");
    const right = ArMath.project(R, [2, 20, 0], 0, 600, 400, 800);
    assertApprox(right.x, 260, 0.01, "2 m right at 20 m: 600 * 2/20 = 60 px right");
    const below = ArMath.project(R, [0, 20, -1], 0, 600, 400, 800);
    assert(below.y > 400, "Point below eye level: lower on screen");
    const behind = ArMath.project(R, [0, -20, 0], 0, 600, 400, 800);
    assert(behind.depth < 0, "Point behind: negative depth");
})();

(function testCompassDirections() {
    // W3C alpha grows counter-clockwise: alpha 90 faces west
    const R = ArMath.quatToMatrix(ArMath.quatFromEuler(90, 90, 0));
    assertApprox(ArMath.cameraHeading(R) / DEG_, -90, 0.01, "alpha 90 upright: camera faces west");
    const p = ArMath.project(R, [-15, 0, 0], 0, 600, 400, 800);
    assert(p.depth > 0 && Math.abs(p.x - 200) < 0.01, "Point to the west is centred when facing west");
})();

(function testLandscape() {
    // Rotated counter-clockwise (top edge to the left), camera facing north
    const R = [[0, -1, 0], [0, 0, -1], [1, 0, 0]];
    const p = ArMath.project(R, [1, 10, 0], 90, 600, 800, 400);
    assertApprox(p.x, 460, 0.01, "Landscape: point east of north is right of centre");
    assertApprox(p.y, 200, 0.01, "Landscape: eye-level point is vertically centred");
})();

(function testQuaternionEulerMatchesMatrix() {
    const q = ArMath.quatFromEuler(30, 70, -20);
    const R = ArMath.quatToMatrix(q);
    const a = 30 * DEG_, b = 70 * DEG_, g = -20 * DEG_;
    const expected02 = Math.cos(a) * Math.sin(g) + Math.sin(a) * Math.sin(b) * Math.cos(g);
    const expected21 = Math.sin(b);
    assertApprox(R[0][2], expected02, 1e-9, "Euler→quaternion→matrix matches W3C rotation matrix (R02)");
    assertApprox(R[2][1], expected21, 1e-9, "Euler→quaternion→matrix matches W3C rotation matrix (R21)");
})();

(function testDeclination() {
    // Magnetic north is 10° east of true north: true north reads as -10° on the sensor
    const v = ArMath.trueToSensor([0, 1, 0], 10 * DEG_);
    assertApprox(Math.atan2(v[0], v[1]) / DEG_, -10, 1e-9, "True north is 10° left of magnetic north with 10° E declination");
})();

(function testCameraOptics() {
    // 4.2 mm lens on a 5.6 x 4.2 mm 4:3 sensor, streaming 1280x720 (crops the short side)
    const f = ArMath.streamFocalPx(1280, 720, { focalMm: 4.2, sensorW: 5.6, sensorH: 4.2 });
    assertApprox(f, 960, 0.01, "Stream focal length: 4.2 mm * 1280/5.6 px/mm");
    assertApprox(ArMath.fovDeg(f, 1280), 67.38, 0.05, "Long-side FOV ~67°");
    // Portrait phone 400x870 CSS px showing a 720x1280 stream with object-fit: cover
    const F = ArMath.displayFocal(f, 720, 1280, 400, 870);
    assertApprox(F, 960 * 870 / 1280, 0.01, "Cover scaling uses the larger ratio");
    assert(ArMath.fovDeg(F, 400) < 40, "Portrait visible horizontal FOV is much narrower than the lens");
    const guess = ArMath.streamFocalPx(1280, 720, null);
    assertApprox(ArMath.fovDeg(guess, 1280), 66, 0.01, "Unknown optics: assume a 66° long side");
})();

const M_N = 1 / 111195; // degrees latitude per metre
(function testTrailWalkBack() {
    const lat0 = 12.97, lng0 = 77.59;
    const mE = M_N / Math.cos(lat0 * DEG_);
    // 40 m north, then (across a GPS gap) 30 m east
    const segs = [
        [[lat0, lng0], [lat0 + 20 * M_N, lng0], [lat0 + 40 * M_N, lng0]],
        [[lat0 + 40 * M_N, lng0 + 30 * mE]],
    ];
    const p = ArMath.trailPointBack(segs, 10);
    const v = ArMath.enu(segs[1][0], p);
    assertApprox(v[0], -10, 0.05, "10 m back along the trail: 10 m west of the end");
    assertApprox(v[1], 0, 0.05, "10 m back along the trail: same latitude");
    const q = ArMath.enu(segs[0][0], ArMath.trailPointBack(segs, 50));
    assertApprox(q[1], 20, 0.05, "50 m back: crosses the gap and 20 m down the first leg");
    const start = ArMath.trailPointBack(segs, 500);
    assert(start[0] === lat0 && start[1] === lng0, "Further back than the trail: clamps to its start");
    assertApprox(ArMath.trailHeading(segs, 15) / DEG_, 90, 0.5, "Heading over the last 15 m (all east leg): 90°");
    assert(ArMath.trailHeading([[[lat0, lng0], [lat0 + 3 * M_N, lng0]]]) === null, "Heading unknown after only 3 m");
    assert(ArMath.trailPointBack([], 10) === null, "Empty trail: no point");
})();

(function testGhostRoutePoint() {
    const ts = [
        { distance: 100, time: 30000, lat: 12.97 + 100 * M_N, lng: 77.59 },
        { distance: 200, time: 60000, lat: 12.97 + 200 * M_N, lng: 77.59 },
        { distance: 250, time: 75000 }, // no coordinates
    ];
    const p = ArMath.ghostRoutePointAt(ts, 150);
    assertApprox(ArMath.enu([12.97, 77.59], p)[1], 150, 0.05, "Ghost route at 150 m: interpolated");
    assert(ArMath.ghostRoutePointAt(ts, 240) === null, "Beyond the last coordinate: unknown");
    assert(ArMath.ghostRoutePointAt(ts, 20) === null, "Long before the first coordinate: unknown");
    assert(ArMath.ghostRoutePointAt([{ distance: 100, time: 1 }], 50) === null, "Simulated ghost (no coords): unknown");
})();

(function testEdgePoint() {
    const box = { left: 40, top: 300, right: 360, bottom: 600 };
    const p = ArMath.edgePoint(1, 0, 200, 400, box);
    assert(p.x === 360 && p.y === 400, "Edge arrow to the right sits on the right of the free area");
    const q = ArMath.edgePoint(0, -1, 200, 400, box);
    assert(q.x === 200 && q.y === 300, "Edge arrow up stops below the top HUD");
    const r = ArMath.edgePoint(-1, 1, 200, 400, box);
    assert(r.x === 40 && r.y === 560, "Diagonal arrow hits the nearer side first");
})();

// ─── Run Analysis Tests ──────────────────────────────────────────────────────

console.log("\n=== Run Analysis Tests ===\n");

const RA = require("./analysis.js");
const M_LAT = 1 / 111195;

// A run north at 4 m/s (one fix per second) with a 30 s stop at 500 m
function straightTrack(totalM, speed = 4, stopAt = null, stopMs = 0, lng = 77.59, bearingLat = 1) {
    const track = [];
    let t = 1000, d = 0;
    while (d <= totalM) {
        track.push([t, d, 12.97 + bearingLat * d * M_LAT, lng, speed, 0]);
        if (stopAt != null && d === stopAt) t += stopMs;
        t += 1000; d += speed;
    }
    return track;
}

(function testEvenPaceGhost() {
    const ts = RA.evenPaceSeries(5000, 25 * 60000);
    assertApprox(RA.timeAtDistance(ts, 5000), 1500000, 0.01, "Target ghost: 5K in exactly 25:00");
    assertApprox(RA.distanceAtTime(ts, 750000), 2500, 0.01, "Target ghost: halfway at 12:30");
    assertApprox(RA.distanceAtTime(ts, 2000000), 5000, 0.01, "Target ghost waits at the finish");
    assertApprox(RA.timeAtDistance(RA.evenPaceSeries(1609, 360000), 1609), 360000, 0.01, "Odd distance ends exactly on target");
})();

(function testDenseHelpersMatchLinear() {
    const ts = RA.seriesFromTrack(straightTrack(2000, 4, 500, 30000));
    assertApprox(RA.timeAtDistance(ts, 400), 101000, 0.01, "Binary search: time at 400 m");
    assertApprox(RA.distanceAtTime(ts, 140000), 500, 0.01, "Standing still during the stop");
    const p = RA.pointAtDistance(ts, 1002);
    assertApprox((p[0] - 12.97) / M_LAT, 1002, 0.05, "Position at a distance");
    const sparse = RA.sparseSeries(ts);
    assert(sparse.length === 20 && sparse[4].distance === 500 && sparse[4].lat != null, "Sparse copy: every 100 m with coordinates");
})();

(function testSplitsAndStops() {
    const track = straightTrack(2400, 4, 500, 30000);
    const ts = RA.seriesFromTrack(track);
    const last = track[track.length - 1];
    const splits = RA.kmSplits(ts, last[1], last[0]);
    assert(splits.length === 3 && splits[2].partial, "Two full km plus a partial");
    assertApprox(splits[0].timeMs, 1000 + 250000 + 30000, 1, "First km includes the stop");
    assertApprox(splits[1].paceSec, 250, 0.01, "Second km at 4 m/s: 4:10/km");
    const stops = RA.findStops(track);
    assert(stops.length === 1 && stops[0].distance === 500 && stops[0].durationMs === 31000, "One 31 s stop at 500 m");
    const gapTrack = [[0, 0, 12.97, 77.59], [60000, 300, 12.973, 77.59]];
    assert(RA.findStops(gapTrack).length === 0, "A GPS gap (distance covered) is not a stop");
    const segs = RA.paceSegments(track);
    assert(segs.some(s => s.kind === "stop") && segs.filter(s => s.kind === "run").every(s => Math.abs(s.paceSec - 250) < 1),
        "Pace segments: steady 4:10/km, the stop marked");
})();

(function testRouteMatching() {
    const run = (id, track) => ({ runId: id, startTime: id, endTime: id + 1, distance: track[track.length - 1][1], time: track[track.length - 1][0] / 1000, track });
    const a = run(1, straightTrack(3000, 4));
    const b = run(2, straightTrack(3020, 3.2, null, 0, 77.59 + 0.0002)); // ~22 m east, slower, a bit longer
    const c = run(3, straightTrack(3000, 4, null, 0, 77.60));           // ~1 km east: another route
    const d = run(4, straightTrack(3000, 4).map(p => [p[0], p[1], 12.97 + (3000 - p[1]) * M_LAT, p[3]])); // same road, reversed
    const e = run(5, straightTrack(6000, 4));                           // twice as long
    assert(RA.sameRoute(RA.routeSignature(a), RA.routeSignature(b)), "Same road, 22 m apart, different pace: same route");
    assert(!RA.sameRoute(RA.routeSignature(a), RA.routeSignature(c)), "A parallel road 1 km away: different route");
    assert(!RA.sameRoute(RA.routeSignature(a), RA.routeSignature(d)), "Same road the other way: different route");
    assert(!RA.sameRoute(RA.routeSignature(a), RA.routeSignature(e)), "Much longer run: different route");
    const groups = RA.groupRoutes([a, b, c, d, e], new Map());
    assert(groups.length === 4 && groups[0].runs.length === 2, "Grouping: a+b together, the rest alone");
    const ranked = RA.rankRoute(groups[0]);
    assert(ranked.distance === 3000 && ranked.entries[0].run.runId === 1, "Ranking over the shorter distance: faster run first");
    const old = { runId: 9, startTime: 9, endTime: 10, distance: 3000, time: 750,
        pathSegments: [straightTrack(3000, 4).map(p => [p[2], p[3]])], timeSeries: [] };
    assert(RA.sameRoute(RA.routeSignature(a), RA.routeSignature(old)), "Older runs match using their saved path");
})();

(function testGhostCues() {
    const st = {};
    const step = (yourDist, ghostDist, now) => RA.ghostCue(st, { yourDist, ghostDist, targetM: 5000, now });
    assert(step(10, 8, 0) === null, "Nothing at the start");
    assert(step(240, 230, 60000) === null, "Nothing before 250 m");
    assert(step(300, 285, 75000) === "Ghost 15 metres behind.", "First cue at 250 m+: ghost 15 m behind");
    assert(step(400, 390, 100000) === null, "Not again until 250 m later");
    assert(step(560, 520, 140000) === "Ghost 40 metres behind, you're pulling away.", "Gap grew: pulling away");
    assert(step(600, 610, 150000) === "Your ghost has overtaken you.", "Lead change is announced at once");
    assert(step(980, 1000, 240000) === null, "Quiet just before a km announcement");
    assert(step(1100, 1130, 270000) === "Ghost 30 metres ahead, and pulling away.", "Behind and dropping back");
    assert(step(1400, 1415, 330000) === "Ghost 15 metres ahead, you're closing in.", "Behind but closing");
    assert(RA.ghostCue({}, { yourDist: 4000, ghostDist: 5000, targetM: 5000, now: 0 }) === "Your ghost has finished. 1 kilometre to go.", "Ghost finished");
    assert(RA.spokenMetres(1234) === "1.2 kilometres" && RA.spokenMetres(123) === "120 metres" && RA.spokenMetres(2) === "5 metres", "Spoken distances");
})();

(function testGuidedReport() {
    // 5 s countdown, 1 min easy, 1 min hard, 1 min rest; 5K pace 5:00/km
    const guided = { segments: [
        { type: "run", duration: 1, intensity: "Conversational pace" },
        { type: "run", duration: 1, intensity: "90% max effort" },
        { type: "rest", duration: 1, intensity: "Complete rest" },
    ] };
    const track = [];
    let d = 0;
    for (let t = 0; t <= 185000; t += 1000) {
        const speed = t < 65000 ? 2.8 : t < 125000 ? 3.4 : 0;
        track.push([t, d, 12.97 + d * M_LAT, 77.59]);
        d += speed;
    }
    const run = { time: 185, distance: d, track };
    const rep = RA.guidedReport(run, guided, 300);
    assert(rep.rows[0].status === "ok", "Easy at 5:57/km with a 5:00 5K pace: on target (5:54–7:30)");
    assert(rep.rows[1].status === "ok", "1 min hard at 4:54/km: on target (4:15–5:00)");
    assert(rep.rows[2].status === "ok", "Rest: stood still");
    assert(rep.onTarget === 3 && rep.judged === 3, "3 of 3 on target");
    const fast = RA.guidedReport(run, guided, 360);
    assert(fast.rows[1].status === "fast", "Same run with a 6:00 5K pace: the hard bit was too fast");
    const slow = RA.guidedReport(run, guided, 280);
    assert(slow.rows[1].status === "slow", "Same run with a 4:40 5K pace: the hard bit was too slow");
    assert(RA.segmentTarget({ type: "run", duration: 4, intensity: "90-95% HRmax" }).range[0] === 0.95, "Longer hard reps: around 5K-10K pace");
    const cut = RA.guidedReport({ time: 90, distance: 250, track: track.filter(p => p[0] <= 90000) }, guided, 300);
    assert(cut.rows[1].partial && cut.rows[2].status === "skipped", "Stopped early: partial and skipped segments");
    assert(RA.segmentTarget({ type: "run", intensity: "Comfortably hard — short phrases only" }).kind === "tempo"
        && RA.segmentTarget({ type: "run", intensity: "Hard, 5K race pace" }).kind === "5k"
        && RA.segmentTarget({ type: "run", intensity: "Zone 2: 60-70% max HR" }).kind === "easy"
        && RA.segmentTarget({ type: "run", intensity: "90-95% HRmax" }).kind === "hard", "Intensity text maps to targets");
})();

(function testParsing() {
    assert(RA.parseDuration("24:59") === 1499000 && RA.parseDuration("1:05:00") === 3900000, "Parses mm:ss and h:mm:ss");
    assert(RA.parseDuration("24:75") === null && RA.parseDuration("abc") === null && RA.parseDuration("") === null, "Rejects bad times");
    assert(RA.parseDuration("25") === 1500000 && RA.parseDuration("2459") === 1499000 && RA.parseDuration("245") === 165000,
        "Digits only (number pad): 25 = 25:00, 2459 = 24:59, 245 = 2:45");
    assert(RA.parseDuration("10500") === 3900000 && RA.parseDuration("14500") === 6300000 && RA.parseDuration("2475") === null,
        "Digits only with hours: 10500 = 1:05:00; 2475 rejected");
    assert(RA.formatDistance(5000) === "5K" && RA.formatDistance(5230) === "5.23 km", "Distance labels");
    const runs = [{ endTime: 1, startTime: 1000, distance: 10000, time: 3000 }];
    assertApprox(RA.fiveKPace(runs, 2000), 3000 * Math.pow(0.5, 1.06) / 5, 0.01, "Riegel 5K pace from a 10K");
})();

(function testBestEfforts() {
    // 2 km at 6:00/km, then 1 km at 4:00/km, then 1 km at 6:00/km; one fix every 3 m
    const track = [];
    let t = 2000;
    for (let d = 0; d <= 4000; d += 3) {
        track.push([Math.round(t), d, 12.97 + d * M_LAT, 77.59]);
        t += 3 * (d >= 2000 && d < 3000 ? 0.24 : 0.36) * 1000;
    }
    const run = { startTime: 1, endTime: 2, distance: 4000, time: t / 1000, track };
    const e1 = RA.runBestEffort(run, 1000);
    assertApprox(e1.timeMs, 240000, 1500, "Best 1K is the fast kilometre in the middle (4:00)");
    assertApprox(e1.startM, 2000, 6, "...and it starts 2 km in");
    const e3 = RA.runBestEffort(run, 3000);
    assertApprox(e3.timeMs, 960000, 2000, "Best 3K: 2 km slow + the fast km = 16:00, not the start");
    assert(RA.runBestEffort(run, 5000) === null, "No 5K effort in a 4 km run");

    const noData = RA.runBestEffort({ distance: 5000, time: 1500 }, 1000);
    assert(noData.even && noData.timeMs === 300000, "No timing data: even pace at the run's average");

    // 100 m splits from older runs start at 100 m; the start line is added back
    const splits = [];
    for (let d = 100; d <= 1000; d += 100) splits.push({ distance: d, time: d * 300 });
    const old = { distance: 1050, time: 316, timeSeries: splits };
    const full = RA.completeSeries(old);
    assert(full[0].distance === 0 && full[0].time === 0 && full[full.length - 1].distance === 1050, "Older runs: series gets its start and finish");
    assertApprox(RA.runBestEffort(old, 1000).timeMs, 300000, 1, "Older runs: best 1K from their splits");

    const slice = RA.sliceSeries(RA.completeSeries(run), e1.startM);
    assert(slice[0].distance === 0 && slice[0].time === 0 && slice[0].lat != null, "Sliced ghost starts at 0 m, 0 s, with a position");
    assertApprox(RA.timeAtDistance(slice, 1000), e1.timeMs, 1, "Sliced ghost runs the fast km in the PB time");
})();

// ─── GPS Filter ─────────────────────────────────────────────────────────────

console.log("\n=== GPS Filter Tests (synthetic runs) ===\n");

const GpsFilter = require("./gps-filter.js");

(function testGpsFilter() {
    // Seeded RNG so the "GPS noise" is the same every run
    let seed = 42;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
    const LAT0 = 12.97, LNG0 = 77.59, M = 6371000 * Math.PI / 180;
    const toLL = (x, y) => [LAT0 + y / M, LNG0 + x / (M * Math.cos(LAT0 * Math.PI / 180))];

    // A route as a function of distance along it -> [x, y] metres
    const straight = s => [s, 0];
    const oval = s => { // 400 m running track
        const st = 84.39, r = 36.5, lap = 2 * st + 2 * Math.PI * r;
        s %= lap;
        if (s < st) return [s, 0];
        if (s < st + Math.PI * r) { const a = -Math.PI / 2 + (s - st) / r; return [st + r * Math.cos(a), r + r * Math.sin(a)]; }
        if (s < 2 * st + Math.PI * r) return [st - (s - st - Math.PI * r), 2 * r];
        const a = Math.PI / 2 + (s - 2 * st - Math.PI * r) / r;
        return [r * Math.cos(a), r + r * Math.sin(a)];
    };

    // 1 Hz fixes along `route`. GPS error is mostly slowly wandering
    // (Gauss-Markov, 3 m, 40 s) plus a little white jitter; Doppler speed and
    // bearing have 0.15 m/s noise.
    function simulate(route, lengthM, speedAt, { doppler = true, standSec = 0 } = {}) {
        const phi = Math.exp(-1 / 40), q = 3 * Math.sqrt(1 - phi * phi);
        let ex = 3 * gauss(), ey = 3 * gauss(), s = 0;
        const fixes = [];
        for (let t = 1; s < lengthM; t++) {
            const v = t <= standSec ? 0 : speedAt(t);
            const [x0, y0] = route(s);
            s = Math.min(lengthM, s + v);
            const [x, y] = route(s);
            ex = phi * ex + q * gauss(); ey = phi * ey + q * gauss();
            const [lat, lng] = toLL(x + ex + 0.5 * gauss(), y + ey + 0.5 * gauss());
            let speed = null, bearing = null;
            if (doppler) {
                const vx = x - x0 + 0.15 * gauss(), vy = y - y0 + 0.15 * gauss();
                speed = Math.hypot(vx, vy);
                bearing = speed > 0.5 ? (Math.atan2(vx, vy) * 180 / Math.PI + 360) % 360 : null;
            }
            fixes.push({ time: t * 1000, lat, lng, accuracy: 4 + 2 * rnd(), speed, bearing, trueSpeed: v });
        }
        return fixes;
    }

    // Distance the way the trackers add it up: skip moves under 3 m
    function measure(fixes, useFilter) {
        const f = new GpsFilter();
        let prev = null, d = 0, speedErr = 0, n = 0;
        for (const fix of fixes) {
            const p = useFilter ? f.update(fix.lat, fix.lng, fix.accuracy, fix.time, fix.speed, fix.bearing) : fix;
            if (!p) continue;
            if (useFilter && fix.trueSpeed > 1) { speedErr += (p.speed - fix.trueSpeed) ** 2; n++; }
            if (!prev) { prev = p; continue; }
            const step = getDistance(prev.lat, prev.lng, p.lat, p.lng);
            if (step < 3) continue;
            d += step;
            prev = p;
        }
        return { d, speedRmse: n ? Math.sqrt(speedErr / n) : null };
    }

    const cases = [
        ["5 km straight at 5:30/km", straight, 5000, () => 3.03, {}],
        ["10 laps of a 400 m track at 5:00/km", oval, 4000, () => 3.33, {}],
        ["Intervals on the track (5.0 / 2.2 m/s)", oval, 3200, t => (Math.floor(t / 60) % 2 ? 2.2 : 5.0), {}],
        ["3 min standing at the start, then 2 km", straight, 2000, () => 3.2, { standSec: 180 }],
    ];
    for (const [name, route, length, speed, opts] of cases) {
        let raw = 0, filt = 0, rmse = 0;
        const N = 5;
        for (let i = 0; i < N; i++) {
            const fixes = simulate(route, length, speed, opts);
            raw += Math.abs(measure(fixes, false).d - length) / length / N;
            const m = measure(fixes, true);
            filt += Math.abs(m.d - length) / length / N;
            rmse += m.speedRmse / N;
        }
        assert(filt < 0.015 && filt < raw,
            `${name}: filtered error ${(filt * 100).toFixed(1)}% (raw fixes ${(raw * 100).toFixed(1)}%)`);
        assert(rmse < 0.35, `${name}: current speed within ${rmse.toFixed(2)} m/s RMS`);
    }

    // Without Doppler (some browsers) it should still beat raw fixes
    let raw = 0, filt = 0;
    for (let i = 0; i < 5; i++) {
        const fixes = simulate(oval, 4000, () => 3.33, { doppler: false });
        raw += Math.abs(measure(fixes, false).d - 4000) / 4000 / 5;
        filt += Math.abs(measure(fixes, true).d - 4000) / 4000 / 5;
    }
    assert(filt < raw, `No Doppler: filtered ${(filt * 100).toFixed(1)}% vs raw ${(raw * 100).toFixed(1)}%`);

    // A single wild fix is ignored; three in a row mean the filter is wrong and it restarts there
    const f = new GpsFilter();
    let p;
    for (let t = 1; t <= 30; t++) p = f.update(LAT0 + 3 * t / M, LNG0, 5, t * 1000, 3, 0);
    assert(f.update(LAT0 + 93 / M + 80 / M, LNG0, 5, 31000, 3, 0) === null, "80 m jump in one second: rejected");
    p = f.update(LAT0 + 96 / M, LNG0, 5, 32000, 3, 0);
    assert(p && Math.abs((p.lat - LAT0) * M - 96) < 3, "Next good fix: back on track");
    let r = [];
    for (let t = 33; t <= 35; t++) r.push(f.update(LAT0 + 500 / M, LNG0, 5, t * 1000, 0, null));
    assert(r[0] === null && r[1] === null && r[2] && Math.abs((r[2].lat - LAT0) * M - 500) < 1,
        "Three far fixes in a row: filter restarts at the new position");

    // Standing still with Doppler says 0 m/s
    const g = new GpsFilter();
    for (let t = 1; t <= 20; t++) p = g.update(LAT0 + gauss() / M, LNG0 + gauss() / M, 5, t * 1000, 0.1, null);
    assert(p.speed < 0.3, `Standing still: speed ${p.speed.toFixed(2)} m/s`);
})();

// ─── Tune-In coach ──────────────────────────────────────────────────────────

console.log("\n=== Tune-In Coach Tests ===\n");

const { TuneInCoach, EFFORT_ANCHORS } = require("./coach.js");

(function testCoachChecksAndNudges() {
    const MIN = 60000;
    const c = new TuneInCoach([{ target: null, durationMs: 5 * MIN }, { target: 3, durationMs: 20 * MIN }]);
    const said = [];
    const run = (from, to) => { for (let t = from; t <= to; t += 500) said.push(...c.tick(t).map(p => [t, p])); };
    assert(c.startSegment(0, 0).length === 0 && !c.active, "Uncoached segment: coach stays quiet");
    run(0, 5 * MIN - 500);
    assert(said.length === 0, "No check-ins outside coached segments");

    c.startSegment(1, 5 * MIN);
    run(5 * MIN, 5 * MIN + 89000);
    assert(said.length === 0, "No check-in in the first 90 s");
    run(5 * MIN + 90000, 5 * MIN + 90000);
    assert(said.length === 1 && /1 to 5/.test(said[0][1]) && c.state(0).asking, "First check-in at 90 s");

    let r = c.rate(4, 5 * MIN + 95000);
    assert(/Ease off/.test(r[0]) && c.target() === 3, "4 when aiming for 3: ease off");
    r = c.rate(4, 5 * MIN + 160000);
    assert(c.target() === 2 && /gentler/.test(r[0]), "Too hard twice: target drops to 2");

    r = c.rate(5, 6 * MIN);
    assert(c.state(6 * MIN).mode === "recover" && /back right off/.test(r[0]), "5: back right off into recovery");
    assert(c.tick(6 * MIN + 30000).length === 0, "Quiet during recovery");
    r = c.tick(7 * MIN);
    assert(/settle back in/.test(r[0]), "After a minute: settle back in");
    assert(c.target() === 2, "The target never drops more than one step below the plan");

    const d = new TuneInCoach([{ target: 3, durationMs: 30 * MIN }]);
    d.startSegment(0, 0);
    d.rate(2, 100000);
    r = d.rate(1, 170000);
    assert(d.target() === 4 && /flying/.test(r[0]), "Too easy twice: target rises to 4");
    d.rate(1, 240000); d.rate(1, 300000);
    assert(d.target() === 4, "Target never goes above 4");
    assert(d.ratings.length === 4 && d.ratings[0][1] === 2, "Ratings are recorded");
    r = d.rate(4, 360000);
    assert(/Perfect|Spot on|Lovely/.test(r[0]), "On target: praise");
})();

(function testCoachQuietEndAndTimeout() {
    const c = new TuneInCoach([{ target: 3, durationMs: 100000 }]);
    c.startSegment(0, 0);
    let said = [];
    for (let t = 0; t < 100000; t += 500) said.push(...c.tick(t));
    assert(said.length === 0, "No check-in in a segment's last 30 s");

    const d = new TuneInCoach([{ target: 2, durationMs: 600000 }]);
    d.startSegment(0, 0);
    said = [];
    for (let t = 0; t <= 200000; t += 500) said.push(...d.tick(t));
    assert(said.length === 2, `Unanswered check-ins time out and come back (${said.length} asks by 200 s)`);
})();

(function testCoachSurges() {
    const MIN = 60000;
    const c = new TuneInCoach([{ target: 3, surges: true, durationMs: 20 * MIN }]);
    c.startSegment(0, 0);
    let said = [];
    const run = (from, to) => { for (let t = from; t <= to; t += 500) said.push(...c.tick(t).map(p => [t, p])); };
    run(0, 90000);
    c.rate(3, 92000); // on target
    said = [];
    run(92000, 170000);
    const surge = said.find(x => /Surge! 30 seconds/.test(x[1]));
    assert(surge && surge[0] === 167000, "On target and 150 s+ in: a 30 s surge at the next check-in");
    said = [];
    run(170000, 200000);
    assert(said.some(x => /How was that surge/.test(x[1])), "After the surge: asks how it was");
    let r = c.rate(2, 200000);
    assert(/45 seconds/.test(r[0]), "Surge felt easy: next one is 45 s");
    c.rate(3, 300000);
    said = [];
    run(300000, 430000);
    assert(said.some(x => /Surge! 45 seconds/.test(x[1])), "Next surge is 45 s");
    r = c.rate(5, said.find(x => /How was that surge/.test(x[1]))[0] + 1000);
    assert(/shorter/.test(r[0]) && c.state(0).mode === "recover", "Surge maxed you out: recover, next one shorter");

    const easy = new TuneInCoach([{ target: 3, surges: false, durationMs: 20 * MIN }]);
    easy.startSegment(0, 0);
    easy.rate(3, 92000);
    said = [];
    for (let t = 92000; t < 15 * MIN; t += 500) said.push(...easy.tick(t));
    assert(!said.some(p => /Surge/.test(p)), "No surges unless the segment asks for them");
})();

(function testNewCourses() {
    global.EFFORT_ANCHORS = EFFORT_ANCHORS;
    const { COURSES } = new Function(require("fs").readFileSync("./courses.js", "utf8") + "; return { COURSES };")();
    const fun = COURSES.find(c => c.id === "fun-run");
    const tune = COURSES.find(c => c.id === "tune-in");
    assert(fun && tune, "Fun Run and Tune-In courses exist");
    const all = [...Object.values(fun.levels), ...Object.values(tune.levels)].flatMap(l => l.sessions);
    assert(all.every(s => s.segments.every(x => x.duration > 0 && x.intensity)), "Every segment has a duration and intensity");
    const funSegs = Object.values(fun.levels).flatMap(l => l.sessions).flatMap(s => s.segments);
    assert(funSegs.every(x => x.say && x.label), "Every Fun Run segment has its own words and label");
    assert(!funSegs.some(x => /all-out|sprint|max/i.test(x.say + x.intensity) && !/not all out/i.test(x.say)), "Fun Run never asks for all-out efforts");
    assert(funSegs.every(x => x.type !== "stride" && x.type !== "play" || x.duration * 60 <= 60), "Fun Run bursts are a minute or less");
    const funSessions = Object.values(fun.levels).flatMap(l => l.sessions);
    assert(funSessions.every(s => s.segments[s.segments.length - 1].type === "cooldown" &&
        s.segments[s.segments.length - 2].label === "Victory!"), "Every Fun Run ends with a celebration, then an easy cool-down");
    const lastHard = funSessions.map(s => {
        const total = s.segments.reduce((a, x) => a + x.duration, 0);
        let t = 0, last = 0;
        s.segments.forEach(x => { if (x.type === "stride") last = t + x.duration; t += x.duration; });
        return last / total;
    });
    assert(Math.max(...lastHard) < 0.9, `Last stride ends before 90% of the session (latest ${(Math.max(...lastHard) * 100).toFixed(0)}%)`);
    const titles = funSessions.slice(0, 6).map(s => s.title);
    assert(new Set(titles).size === 6, "The first two weeks use six different themes");
    const tuneSessions = Object.values(tune.levels).flatMap(l => l.sessions);
    assert(tuneSessions.every(s => s.segments.some(x => x.target != null) && s.segments[s.segments.length - 1].target == null),
        "Tune-In sessions are coached, and the cool-down isn't");
    assert(tuneSessions.some(s => s.segments.some(x => x.surges)), "Waves sessions have adaptive surges");
})();

// ─── Pace Formatting ─────────────────────────────────────────────────────────

console.log("\n=== Pace Formatting Tests ===\n");

function formatPace(totalSeconds) {
    const total = Math.round(totalSeconds);
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
}

assert(formatPace(299.8) === "5:00", "299.8 s rounds up to 5:00, not 4:60");
assert(formatPace(299.4) === "4:59" && formatPace(61) === "1:01", "Ordinary paces");

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
