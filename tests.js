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

// ─── The real code under test ─────────────────────────────────────────────────

global.RunAnalysis = require("./analysis.js");
const { getDistance, classifyFix, formatTime, formatDuration } = require("./run-core.js");
const { calcPaceTrend, weekSoFar, formatPace, getGhostDistanceAtTime, getGhostTimeAtDistance, getGhostPositionAtTime } = require("./performance.js");

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

const RA = RunAnalysis;
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

// ─── Tune-In: pace coach and planner ─────────────────────────────────────────

(function testMovingWithNoBearing() {
    // First fix after a pause: Doppler speed, but no bearing yet
    const f = new GpsFilter();
    const t0 = 1000000;
    let est;
    for (let i = 0; i <= 2; i++) est = f.update(28.6 + i * 3 / 111195, 77.2, 5, t0 + i * 1000, 3, null);
    assert(est.speed > 1.5, `Moving at 3 m/s with no bearing: 2 s in, the filter has noticed (${est.speed.toFixed(2)} m/s)`);
})();

console.log("\n=== Tune-In Tests ===\n");

const { PaceCoach, TuneInPlanner, spokenPace } = require("./coach.js");

(function testSpokenPace() {
    assert(spokenPace(340) === "5 40 per kilometre" && spokenPace(305) === "5 oh 5 per kilometre" &&
        spokenPace(360) === "6 minutes per kilometre", "Paces are spoken the way a runner says them");
})();

// Drives a coach through one segment at a steady pace (s/km), ticking every 500 ms
function runCoach(c, index, startT, startD, durationMs, paceSec) {
    const said = c.startSegment(index, startT, startD).map(p => [startT, p]);
    for (let t = startT; t < startT + durationMs; t += 500) {
        said.push(...c.tick(t, startD + (t - startT) / paceSec).map(p => [t, p]));
    }
    return { said, endT: startT + durationMs, endD: startD + durationMs / paceSec };
}

(function testCoachAnnouncesAndChecks() {
    const c = new PaceCoach([
        { role: "warmup", pace: 420, durationMs: 300000 },
        { role: "cruise", pace: 360, durationMs: 120000 },
        { role: "surge", pace: 300, durationMs: 20000 },
    ]);
    let r = runCoach(c, 0, 0, 0, 300000, 330);
    assert(/Warm up easy, around 7 minutes per kilometre/.test(r.said[0][1]) && r.said.length === 1,
        "Warm-up: announced with an easy pace, never nagged even when quick");

    r = runCoach(c, 1, r.endT, r.endD, 120000, 360);
    assert(/^Steady\. 6 minutes per kilometre, for 2 minutes/.test(r.said[0][1]), "Steady part announced with its pace");
    assert(r.said.length === 2 && /On pace/.test(r.said[1][1]) && r.said[1][0] === 325000,
        "On pace: one 'on pace' at 25 s, then quiet");

    const slow = new PaceCoach([{ role: "cruise", pace: 360, durationMs: 180000 }]);
    r = runCoach(slow, 0, 0, 0, 180000, 390);
    const nags = r.said.slice(1).map(x => x[1]);
    assert(nags.length === 4 && nags.every(m => /A little quicker\. Aim for 6 minutes/.test(m)),
        `8% slow: 'a little quicker' at each check (${nags.length} checks in 3 min, none in the last 15 s)`);

    const fast = new PaceCoach([{ role: "push", pace: 330, durationMs: 60000 }]);
    r = runCoach(fast, 0, 0, 0, 60000, 290);
    assert(r.said.length === 2 && /Strong!.*save a bit/.test(r.said[1][1]), "Push run far too fast: told to save a bit");

    const surge = new PaceCoach([{ role: "surge", pace: 300, durationMs: 20000 }]);
    r = runCoach(surge, 0, 0, 0, 20000, 400);
    assert(r.said.length === 1 && /Surge! 20 seconds at 5 minutes per kilometre/.test(r.said[0][1]),
        "Short surges are announced, never nagged (GPS can't judge 20 s)");
})();

(function testCoachEasesAfterMisses() {
    const parts = [];
    for (let i = 0; i < 4; i++) parts.push({ role: "push", pace: 330, durationMs: 60000 }, { role: "float", pace: 380, durationMs: 60000 });
    parts.push({ role: "cooldown", pace: null, durationMs: 180000 });
    const c = new PaceCoach(parts);
    let r = runCoach(c, 0, 0, 0, 60000, 370);            // push 1: 12% slow, a miss
    r = runCoach(c, 1, r.endT, r.endD, 60000, 380);      // float isn't judged
    assert(c.scale === 1, "One missed push: no change yet");
    r = runCoach(c, 2, r.endT, r.endD, 60000, 370);      // push 2: miss
    const next = c.startSegment(3, r.endT, r.endD);
    assert(/a little gentler/.test(next[0]) && c.eases === 1, "Two missed pushes: the rest of the run eases off");
    assert(c.pace(4) === 345 && c.pace(5) === 395, "Eased paces are 4% gentler, to the nearest 5 s");
    assert(c.pace(8) === null && /Cool down/.test(c.startSegment(8, 1e6, 3000)[0]), "The cool-down has no pace");

    const ok = new PaceCoach(parts);
    r = runCoach(ok, 0, 0, 0, 60000, 370);
    r = runCoach(ok, 1, r.endT, r.endD, 60000, 380);
    r = runCoach(ok, 2, r.endT, r.endD, 60000, 335);     // back on target: the streak resets
    r = runCoach(ok, 3, r.endT, r.endD, 60000, 380);
    r = runCoach(ok, 4, r.endT, r.endD, 60000, 370);
    ok.startSegment(5, r.endT, r.endD);
    assert(ok.eases === 0, "Misses must be in a row");

    const stopped = new PaceCoach([{ role: "cruise", pace: 360, durationMs: 120000 }]);
    stopped.startSegment(0, 0, 50);
    const quiet = [];
    for (let t = 0; t < 120000; t += 500) quiet.push(...stopped.tick(t, 50));
    assert(quiet.length === 0 && stopped.state().status === null, "Standing at a crossing: no pace, no nagging");
})();

// Synthetic history: `n` runs of `km` at `pace` s/km, one every 2 days before `now`
function fakeRuns(n, km, pace, now) {
    return Array.from({ length: n }, (_, i) => {
        const start = now - (i + 1) * 2 * 86400000;
        const time = km * pace;
        return {
            runId: start, startTime: start, endTime: start + time * 1000, distance: km * 1000, time, pace,
            timeSeries: [{ distance: 0, time: 0 }, { distance: km * 1000, time: time * 1000 }],
        };
    });
}

(function testPlannerLearns() {
    const now = Date.UTC(2026, 9, 21);
    let p = TuneInPlanner.plan(fakeRuns(4, 5, 360, now), now);
    assert(!p.ready && p.have === 4 && p.need === 5, "Needs 5 recent runs before planning");

    // Usually 6:00 /km; a 5K race at 5:00 a month ago sets the predicted 5K pace
    const race = fakeRuns(1, 5, 300, now - 30 * 86400000);
    const runs = [...fakeRuns(8, 5, 360, now), ...race];
    p = TuneInPlanner.plan(runs, now);
    const info = p.info;
    assert(p.ready && Math.abs(info.usualPace - 360) < 0.5, `Usual pace learned: ${info.usualPace.toFixed(1)} s/km`);
    assert(info.targetPace < 360 && info.targetPace > 342, `Target just outside comfort: ${info.targetPace.toFixed(1)} s/km (~3% quicker)`);
    const segs = p.session.segments;
    const main = segs.filter(s => !["warmup", "cooldown"].includes(s.role));
    const mainS = main.reduce((a, s) => a + s.duration * 60, 0);
    assert(Math.round(mainS) === info.mainMin * 60 && info.mainMin === 22, `Main set sized from your usual run: ${info.mainMin} min`);
    const avg = mainS / main.reduce((a, s) => a + s.duration * 60 / s.pace, 0);
    assert(Math.abs(avg - info.targetPace) < 0.01, "Interval paces average out to the target");
    assert(new Set(main.map(s => s.pace)).size >= 3, "Reached with intervals, not one pace");
    assert(main.every(s => s.pace >= info.p5 * 0.9 - 2.5), "No part faster than the cap from your 5K pace");
    assert(segs[0].role === "warmup" && segs[segs.length - 1].role === "cooldown" && segs[segs.length - 1].pace == null,
        "Warm-up first, unpaced cool-down last");
    assert(p.session.tuneIn.mainStartMs === 305000, "Main set starts after the 5 s countdown and warm-up");

    const tired = TuneInPlanner.plan(runs, now, "tired").info;
    const fresh = TuneInPlanner.plan(runs, now, "fresh").info;
    assert(tired.targetPace > info.targetPace && fresh.targetPace < info.targetPace, "Tired: gentler; fresh: a bit more");

    // A Tune-In run, hit or missed, moves the step
    const tuneRun = (paceSec, minutes) => {
        const start = now - 3600000;
        const tune = p.session.tuneIn;
        const time = minutes * 60;
        return {
            runId: start, startTime: start, endTime: start + time * 1000, distance: time / paceSec * 1000, time, pace: paceSec,
            timeSeries: [{ distance: 0, time: 0 }, { distance: time / paceSec * 1000, time: time * 1000 }],
            guided: { title: p.session.title, segments: segs, tuneIn: tune },
        };
    };
    const later = now + 1000;
    const hit = TuneInPlanner.plan([...runs, tuneRun(info.targetPace - 3, info.totalMin)], later).info;
    const missed = TuneInPlanner.plan([...runs, tuneRun(info.targetPace * 1.08, info.totalMin)], later).info;
    const quit = TuneInPlanner.plan([...runs, tuneRun(info.targetPace, 15)], later).info;
    assert(hit.baseStep > info.baseStep, `Hit it: next step grows (${(hit.baseStep * 100).toFixed(1)}%)`);
    assert(missed.baseStep < info.baseStep && quit.baseStep < info.baseStep, "Missed it or stopped early: next step shrinks");
    assert(hit.template !== info.template, "Each Tune-In run uses the next template");
    const res = TuneInPlanner.result(tuneRun(info.targetPace * 1.08, info.totalMin));
    assert(res.finished && Math.abs(res.ratio - 1.08) < 0.01, "Result compares the main set with its target");

    // Someone whose every run is a race: never asked for more than race pace
    const racer = TuneInPlanner.plan(fakeRuns(6, 5, 300, now), now).info;
    assert(racer.capped && racer.targetPace >= racer.p5 - 0.01, `Capped at 5K pace: ${racer.targetPace.toFixed(1)} vs 5K ${racer.p5.toFixed(1)}`);
})();

(function testFunRunCourse() {
    const { COURSES } = new Function(require("fs").readFileSync("./courses.js", "utf8") + "; return { COURSES };")();
    const fun = COURSES.find(c => c.id === "fun-run");
    assert(fun && !COURSES.some(c => c.id === "tune-in"), "Fun Run course exists; Tune-In is a run of its own now");
    const funSessions = Object.values(fun.levels).flatMap(l => l.sessions);
    const funSegs = funSessions.flatMap(s => s.segments);
    assert(funSegs.every(x => x.duration > 0 && x.intensity), "Every segment has a duration and intensity");
    assert(funSegs.every(x => x.say && x.label), "Every Fun Run segment has its own words and label");
    assert(funSessions.every(s => s.segments.every((x, i) => x.type !== "stride" ||
        (x.duration * 60 <= 20 && s.segments[i + 1].type === "walk"))), "Speed bursts are 20 s or less, each followed by a walk");
    // Longest easy cruise between two challenges
    const gaps = funSessions.map(s => Math.max(...s.segments.filter(x => x.label === "Easy cruise").map(x => x.duration * 60)));
    assert(Math.max(...gaps) <= 90, `Something happens at least every 90 s (longest easy stretch ${Math.max(...gaps)} s)`);
    assert(funSessions.every(s => s.segments[s.segments.length - 1].type === "cooldown" &&
        s.segments[s.segments.length - 2].label === "Victory!"), "Every Fun Run ends with a celebration, then an easy cool-down");
    const easyEnd = funSessions.map(s => {
        const total = s.segments.reduce((a, x) => a + x.duration * 60, 0);
        let t = 0, last = 0;
        s.segments.forEach(x => { t += x.duration * 60; if (x.type === "stride") last = t; });
        return total - last;
    });
    assert(Math.min(...easyEnd) >= 240, `At least 4 easy minutes after the last burst (shortest ${Math.round(Math.min(...easyEnd))} s)`);
    // The games (FunCoach)
    assert(funSessions.every(s => s.segments.some(x => x.game === "finish") && s.segments.some(x => x.game === "burst")), "Every Fun Run has timed bursts and a photo finish");
    assert(funSessions.every(s => s.segments.filter(x => x.game === "chase").every(x => x.duration * 60 <= 60 && x.chaser)), "Chases last a minute at most, and something is chasing");
    assert(funSessions.filter(s => s.segments.some(x => x.game === "chase")).length >= funSessions.length * 0.8, "Most Fun Runs have a chase");
    assert(funSessions.some(s => s.segments.some(x => x.game === "steps")), "Quick feet counts your steps");
    const beginner = fun.levels.beginner.sessions;
    assert([2, 5, 8, 11, 14, 17].every(i => /^Agent Runner \d/.test(beginner[i].title)) && /To be continued/.test(beginner[2].segments[beginner[2].segments.length - 1].say),
        "Every week's third run is the next Agent Runner episode, ending on a cliffhanger");
    const { mysteryFunRun, adaptFunRun } = new Function(require("fs").readFileSync("./courses.js", "utf8") + "; return { mysteryFunRun, adaptFunRun };")();
    const mystery = mysteryFunRun("beginner", 7);
    assert(mystery.mystery && mystery.segments.some(x => x.game === "burst") && JSON.stringify(mysteryFunRun("beginner", 7)) === JSON.stringify(mystery), "Surprise me: a mystery run, the same for the same seed");
    const plain = beginner[0];
    const hot = adaptFunRun(plain, { feelsC: 35 }, 9);
    assert(hot.session.segments.filter(x => x.game === "burst" || x.game === "finish").every(x => Math.round(x.duration * 60) === 10), "Hot day: bursts of 10 s");
    assert(hot.session.segments.filter(x => x.type === "walk").every((x, i) => x.duration > plain.segments.filter(y => y.type === "walk")[i].duration), "Hot day: longer walks");
    assert(hot.session.segments.some(x => x.label === "Shade hunt") && /hot today, 35 degrees/.test(hot.session.segments[0].say), "Hot day: shade, and it says why");
    assert(plain.segments.every(x => x.label !== "Shade hunt"), "...without changing the course itself");
    assert(adaptFunRun(plain, { feelsC: 20, precipMm: 2 }, 9).session.segments.some(x => x.label === "Puddle dodge"), "Rain: puddle dodging");
    assert(/Night run/.test(adaptFunRun(plain, null, 21).session.segments[0].say), "After dark: be seen");
    assert(adaptFunRun(plain, { feelsC: 20 }, 9).notes.length === 0, "A mild day changes nothing");
    const titles = funSessions.slice(0, 6).map(s => s.title);
    assert(new Set(titles).size === 6, "The first two weeks use six different themes");
    const said = funSegs.map(x => x.say).join(" ");
    assert(/Naruto run/.test(said) && /Shoulder taps/.test(said) && /best pace/.test(said), "Naruto runs, shoulder taps and best-pace bursts are in");
})();

// ─── Hills, heat, heart rate, readiness ──────────────────────────────────────

console.log("\n=== Run Data Tests ===\n");

(function testHillsAndHeat() {
    assertApprox(RA.minettiFactor(0), 1, 1e-9, "Flat costs what flat costs");
    assert(RA.minettiFactor(0.05) > 1.25 && RA.minettiFactor(-0.05) < 0.8 && RA.minettiFactor(-0.25) > RA.minettiFactor(-0.2),
        "Uphill costs more, gentle downhill less, steep downhill more again (braking)");
    const flat = { elevation: { points: [[0, 10], [1000, 10]] } };
    const hill = { elevation: { points: [[0, 10], [500, 35], [1000, 10]] } }; // 5% up, 5% down
    assertApprox(RA.flatMetres(flat, 0, 1000), 1000, 1e-6, "Flat route: flat metres = metres");
    assert(RA.flatMetres(hill, 0, 1000) > 1000, `Up and back down costs more than flat (${RA.flatMetres(hill, 0, 1000).toFixed(0)} m)`);
    assertApprox(RA.flatMetres({}, 0, 800), 800, 1e-9, "No elevation data: just the distance");
    assert(RA.heatSlowdown(null) === 0 && RA.heatSlowdown({ feelsC: 15 }) === 0, "Cool or unknown weather: no allowance");
    assertApprox(RA.heatSlowdown({ feelsC: 33 }), 0.06, 1e-9, "33°C feels-like: 6% slower is expected");
    assert(RA.heatSlowdown({ tempC: 50 }) === 0.1, "Heat allowance is capped at 10%");
})();

(function testPausesHeartRateCadence() {
    // Paused for 60 s after 120 s of moving time
    const run = {
        startTime: 0, time: 300, pauses: [[120000, 60000]],
        hr: { samples: [[60000, 120], [100000, 130], [150000, 90], [200000, 160], [240000, 170]] },
        steps: [[0, 0], [60000, 170], [120000, 340], [180000, 520], [240000, 700]],
    };
    assert(RA.wallOffset(run, 60000) === 60000 && RA.wallOffset(run, 180000) === 240000, "Moving time maps to clock time across a pause");
    const hr = RA.hrBetween(run, 120000, 200000);
    assert(hr && hr.n === 2 && hr.avg === 165, "Heart rate for a stretch skips samples from the pause");
    assertApprox(RA.cadenceBetween(run, 120000, 240000), 180, 1e-9, "Cadence over a stretch from step samples");
})();

(function testPlannerHillsHeatHr() {
    const now = Date.UTC(2026, 9, 21);
    const race = fakeRuns(1, 5, 300, now - 30 * 86400000);
    const flatRuns = [...fakeRuns(8, 5, 360, now), ...race];
    const base = TuneInPlanner.plan(flatRuns, now).info;

    // The same runs on a hilly route: usual pace on that route is unchanged
    const hilly = flatRuns.map(r => Object.assign({}, r, { elevation: { points: [[0, 0], [1250, 50], [2500, 0], [3750, 50], [5000, 0]] } }));
    const h = TuneInPlanner.plan(hilly, now).info;
    assert(h.hillFactor > 1.01 && Math.abs(h.usualPace - base.usualPace) < 1, `Hilly usual route: same usual pace on it (hill factor ${h.hillFactor.toFixed(2)})`);

    // One hot run among cool ones doesn't drag "usual" down
    const hotSlow = flatRuns.map((r, i) => i === 0 ? Object.assign({}, r, { time: r.time * 1.06, pace: r.pace * 1.06, weather: { feelsC: 33 } }) : r);
    assert(Math.abs(TuneInPlanner.plan(hotSlow, now).info.usualPace - base.usualPace) < 1.5, "A slow run in the heat counts as a normal one");

    const hot = TuneInPlanner.plan(flatRuns, now, "normal", { tempC: 31, feelsC: 33 }).info;
    assert(hot.targetPace > base.targetPace * 1.04 && hot.heat === 0.06, `Hot today: target eased (${hot.targetPace.toFixed(0)} vs ${base.targetPace.toFixed(0)} s/km)`);

    // A Tune-In hit on pace, but with heart rate near max: the next one doesn't step up
    const plan = TuneInPlanner.plan(flatRuns, now);
    const tune = plan.session.tuneIn;
    const tuneRun = (avgHr) => {
        const time = plan.info.totalMin * 60, pace = plan.info.targetPace - 3, start = now - 3600000;
        return {
            runId: start, startTime: start, endTime: start + time * 1000, distance: time / pace * 1000, time, pace,
            timeSeries: [{ distance: 0, time: 0 }, { distance: time / pace * 1000, time: time * 1000 }],
            guided: { tuneIn: tune }, hr: { samples: [[400000, avgHr], [900000, avgHr]], avg: avgHr, max: avgHr },
        };
    };
    const withMax = flatRuns.map((r, i) => i < 3 ? Object.assign({}, r, { hr: { samples: [], avg: 150, max: 190 } }) : r);
    const redline = TuneInPlanner.plan([...withMax, tuneRun(182)], now + 1000).info;
    const comfy = TuneInPlanner.plan([...withMax, tuneRun(155)], now + 1000).info;
    assert(redline.baseStep < base.baseStep, `Hit, but at ${Math.round(182 / 190 * 100)}% of max heart rate: next step shrinks`);
    assert(comfy.baseStep > base.baseStep + 0.007, "Hit with heart rate to spare: next step grows more");
})();

(function testReadinessSuggestion() {
    global.RunAnalysis = RA;
    const Enrich = require("./enrich.js");
    const now = Date.UTC(2026, 9, 21, 7);
    const H = 3600000, D = 86400000;
    const usualRhr = [2, 3, 4, 5, 6].map(d => [now - d * D, 55]);
    const short = Enrich.suggest([[now - 6 * H, now - 1 * H]], [...usualRhr, [now - 2 * H, 56]], now);
    assert(short.feel === "tired" && short.sleepMin === 300 && /5h 0m sleep/.test(short.why), "5 h of sleep: tired");
    const high = Enrich.suggest([[now - 9 * H, now - H]], [...usualRhr, [now - 2 * H, 62]], now);
    assert(high.feel === "tired" && high.baseline === 55, "Resting HR 7 above usual: tired, even after a full night");
    const good = Enrich.suggest([[now - 9 * H, now - H]], [...usualRhr, [now - 2 * H, 54]], now);
    assert(good.feel === "fresh", "8 h sleep and normal resting HR: fresh");
    assert(Enrich.suggest([], [], now).feel === null, "No watch data: no suggestion");
})();

const weatherTest = (async function testWeatherNearMidnight() {
    global.RunAnalysis = RA;
    const Enrich = require("./enrich.js");
    // Answers like Open-Meteo: only the hours of the day(s) that were asked for
    const realFetch = global.fetch;
    global.fetch = async (url) => {
        const day = /start_date=([\d-]+)/.exec(url)[1];
        const time = Array.from({ length: 24 }, (_, h) => `${day}T${String(h).padStart(2, "0")}:00`);
        const col = (v) => time.map(() => v);
        return { ok: true, json: async () => ({ hourly: {
            time, temperature_2m: col(20), apparent_temperature: col(21), relative_humidity_2m: col(50),
            dew_point_2m: col(9), wind_speed_10m: col(5), wind_direction_10m: col(90), precipitation: col(0),
        } }) };
    };
    const runAt = (startTime) => ({ startTime, distance: 1000, track: [[0, 0, 28.6, 77.2], [300000, 1000, 28.609, 77.2]] });
    // 23:40 GMT is 05:10 in India: rounds up to the next day's 00:00
    const late = await Enrich.weather(runAt(Date.UTC(2026, 9, 20, 23, 40)));
    assert(late && late.tempC === 20 && late.at === "2026-10-21T00:00Z", "A run at 23:40 GMT gets the next day's midnight weather");
    const noon = await Enrich.weather(runAt(Date.UTC(2026, 9, 20, 12, 10)));
    assert(noon && noon.at === "2026-10-20T12:00Z", "A midday run gets its own hour");
    global.fetch = realFetch;
})();

(function testAppStartsOffline() {
    const fs = require("fs");
    const html = fs.readFileSync("./index.html", "utf8");
    const tags = html.match(/<(script|link)\b[^>]*>/g);
    assert(!tags.some(t => /(src|href)="(https?:)?\/\//.test(t)), "index.html loads nothing from the network (no signal must still start)");
    const local = tags.map(t => /(?:src|href)="([^"]+)"/.exec(t)[1]);
    assert(local.every(f => fs.existsSync(f)), "Everything index.html loads is in the repo");
    const build = fs.readFileSync("./scripts/build-web.js", "utf8");
    assert(local.every(f => f.startsWith("vendor/") ? /"vendor"/.test(build) : build.includes(`"${f}"`)), "The build copies everything index.html loads");
})();

// ─── Pace Formatting ─────────────────────────────────────────────────────────

console.log("\n=== Pace Formatting Tests ===\n");

assert(formatPace(299.8) === "5:00", "299.8 s rounds up to 5:00, not 4:60");
assert(formatPace(299.4) === "4:59" && formatPace(61) === "1:01", "Ordinary paces");

// ─── Editing a run, VO2max, GPS warnings ─────────────────────────────────────

console.log("\n=== Run Editing Tests ===\n");

// A run of `n` fixes, 3 m and 1 s apart, with a 60 s pause after 10 s
function sampleRun(n = 600, startTime = Date.UTC(2026, 9, 1, 6)) {
    const track = [], raw = [];
    for (let i = 0; i < n; i++) {
        track.push([i * 1000, i * 3, 28.6 + i * 3 / 111195, 77.2, 3, 0, 200]);
        raw.push([i * 1000, 28.6 + i * 3 / 111195, 77.2, 5, 200, 3, 0]);
    }
    const distance = (n - 1) * 3, time = n - 1;
    return {
        runId: startTime, startTime, endTime: startTime + time * 1000 + 60000, distance, time, pace: time / (distance / 1000),
        track, raw, pathSegments: [track.slice(0, 10).map(p => [p[2], p[3]]), track.slice(10).map(p => [p[2], p[3]])],
        timeSeries: track.filter(p => p[1] % 99 === 0 && p[1] > 0).map(p => ({ distance: p[1], time: p[0], lat: p[2], lng: p[3], pace: 333 })),
        pauses: [[10000, 60000]], steps: [[0, 0], [300000, 900], [500000, 1500]], coachLog: [[1000, "go"], [500000, "late"]],
        hr: { samples: [[1000, 120], [100000, 140], [550000, 190]], avg: 150, max: 190 },
        elevation: { points: [[0, 200], [1000, 210]], gain: 10, loss: 0 }, estimatedDistance: 1500,
    };
}

(function testTrimRun() {
    const run = sampleRun();
    const t = RA_TRIM(run, 300500);
    assert(t.track.length === 301 && t.distance === 900 && t.time === 300, "Trim: cuts at the last fix before the mark");
    assertApprox(t.pace, 300 / 0.9, 0.01, "Trim: pace worked out again");
    assert(t.endTime === run.startTime + 360000, "Trim: end time counts the pause before the cut");
    assert(t.raw.length === 301 && t.steps.length === 2 && t.coachLog.length === 1, "Trim: raw fixes, steps and spoken cues cut too");
    assert(t.pathSegments.length === 2 && t.pathSegments.flat().length === 301, "Trim: the drawn path keeps its segments and matches the track");
    assert(t.hr.samples.length === 2 && t.hr.max === 140 && t.hr.avg === 130, "Trim: heart rate worked out from what's left");
    assert(!t.elevation && !t.derived, "Trim: the old hill profile and summary go");
    assert(t.estimatedDistance === 900, "Trim: estimated distance can't exceed the distance");
    assert(run.track.length === 600 && run.distance === 1797, "Trim: the run passed in isn't changed");
    assert(RA_TRIM(run, 600000) === null, "Trim past the end: nothing to do");
    assert(RA_TRIM(run, 0) === null, "Trim to nothing: refused");
    assert(RA_TRIM({ timeSeries: [] }, 100) === null, "Old run without a track: can't be trimmed");
})();

function RA_TRIM(run, ms) { return RunAnalysis.trimRun(run, ms); }

(function testVo2max() {
    const now = Date.UTC(2026, 9, 1);
    const run = (km, min, daysAgo = 3) => ({ endTime: 1, startTime: now - daysAgo * 86400000, distance: km * 1000, time: min * 60, pace: min * 60 / km });
    assertApprox(RunAnalysis.vo2max([run(5, 20)], now), 49.8, 0.3, "5K in 20:00: VO2max about 50 (Daniels)");
    assertApprox(RunAnalysis.vo2max([run(5, 30)], now), 30.8, 0.4, "5K in 30:00: VO2max about 31");
    assert(RunAnalysis.vo2max([run(2, 24)], now) === null, "A 12-minute walk says nothing about VO2max");
    assert(RunAnalysis.vo2max([run(5, 20, 30), run(1.5, 12, 1)], now) >= 49, "A recent easy jog doesn't drag it down");
    assert(RunAnalysis.vo2max([], now) === null, "No runs: none");
})();

(function testGpsWatch() {
    const { GpsWatch } = require("./gps-filter.js");
    const w = new GpsWatch(0);
    assert(w.tick(59000) === null, "GPS: a minute's grace to lock on at the start");
    assert(/Still no GPS/.test(w.tick(60000)) && w.lost, "GPS: no first fix after a minute: says so");
    assert(w.tick(61000) === null, "GPS: says it once");
    assert(w.fix(62000) === "GPS is back.", "GPS: says when it's back");
    assert(w.tick(91000) === null, "GPS: 29 s without a fix: nothing yet");
    assert(/signal lost/.test(w.tick(92000)), "GPS: 30 s without a fix: warns");
    assert(w.tick(391000) === null && /signal lost/.test(w.tick(392000)), "GPS: reminds every 5 minutes");
    w.reset(400000);
    assert(!w.lost && w.tick(420000) === null, "GPS: resuming starts the wait over");
    assert(w.fix(421000) === null, "GPS: a normal fix says nothing");
})();

(function testCarIsNotAPb() {
    const { findBestEfforts } = require("./performance.js");
    const car = { startTime: 2, endTime: 3, distance: 6000, time: 600, pace: 100 };
    const real = { startTime: 1, endTime: 2, distance: 5000, time: 1500, pace: 300 };
    assert(findBestEfforts([car, real], [5])[5].run === real, "A car you forgot to stop for doesn't set a PB");
    assert(Math.abs(RunAnalysis.fiveKPace([car, real], 10) - 300) < 1, "Nor does it set your predicted 5K");
})();

(function testWeekSoFar() {
    const now = new Date(2026, 10, 11, 12).getTime(); // a Wednesday
    const at = (d, h = 9) => new Date(2026, 10, d, h).getTime();
    const w = weekSoFar([
        { startTime: at(9), endTime: at(9) + 1, distance: 5000 },
        { startTime: at(11), endTime: null, distance: 900 },
        { startTime: at(8, 23), endTime: at(9), distance: 9000 },
        { startTime: at(10), endTime: at(10) + 1, distance: 2000, activity: "walk" },
        { startTime: at(10), endTime: at(10) + 1, distance: 0, activity: "strength" },
    ], now);
    assert(w.runs === 1 && w.runKm === 5 && w.walks === 1 && w.walkKm === 2 && w.workouts === 1, "This week: from Monday, finished only, each kind counted apart");
})();

(function testBuildListsEveryScript() {
    const fs = require("fs");
    const list = fs.readFileSync("scripts/build-web.js", "utf8");
    const scripts = [...fs.readFileSync("index.html", "utf8").matchAll(/<script src="([^"]+)"/g)].map(m => m[1]).filter(f => !f.startsWith("vendor/"));
    assert(scripts.length > 10 && scripts.every(f => list.includes(`"${f}"`)), "Every script the page loads goes into the APK");
})();

// ─── Weekly report ───────────────────────────────────────────────────────────

global.StrengthPlanner = require("./strength-plan.js");
const WR = require("./weekly-report.js");

function seeded(seed) { return () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296; }

(function testWeeklyReport() {
    console.log("\n=== Weekly Report Tests ===\n");
    const start = new Date(2026, 10, 2).getTime(); // a Monday
    const at = (week, day, hour = 8) => { const d = new Date(start); d.setDate(d.getDate() + week * 7 + day); d.setHours(hour); return d.getTime(); };
    const run = (t, km = 5, pace = 330, extra = {}) => Object.assign({ runId: t, startTime: t, endTime: t + km * pace * 1000, distance: km * 1000, time: km * pace, pace, timeSeries: [] }, extra);
    const walk = (t, min = 30, extra = {}) => Object.assign({ runId: t, activity: "walk", startTime: t, endTime: t + min * 60000, distance: min * 80, time: min * 60, pace: 750 }, extra);
    const gym = (t, ex = [{ id: "push", name: "Push-ups", variation: "Push-up", level: 3, levels: 6, sets: [{ reps: 8, target: 8 }] }]) =>
        ({ runId: t, activity: "strength", startTime: t, endTime: t + 1800000, distance: 0, time: 1800, exercises: ex });
    const usualWeeks = (from, to, rpe = 3) => {
        const out = [];
        for (let w = from; w <= to; w++) out.push(run(at(w, 0), 5, 330, { rpe }), run(at(w, 2), 5, 330, { rpe }), run(at(w, 5), 8, 340, { rpe }), gym(at(w, 1)), gym(at(w, 4)));
        return out;
    };
    const report = (sessions, extra = {}) => WR.build(Object.assign({ sessions, start }, extra));

    assert(new Date(WR.monday(at(0, 6, 23))).getDay() === 1 && WR.monday(at(0, 6, 23)) === start, "Week: Sunday night belongs to the Monday before");
    const spring = new Date(2026, 2, 23).getTime();
    assert(new Date(WR.addWeeks(spring, 1)).getHours() === 0, "Week: a clock change doesn't move Monday");

    // Empty, light and paused weeks
    assert(report([]).light && /Nothing logged/.test(report([]).line), "Nothing logged: a line, no comparison");
    let r = report([...usualWeeks(-5, -1), run(at(0, 1))]);
    assert(r.light && /A light week/.test(r.line) && !r.rows, "One day logged: a light week, no comparison");
    r = report([...usualWeeks(-5, -1), ...usualWeeks(0, 0)], { paused: new Set([start]) });
    assert(r.light && /Left out/.test(r.line), "A paused week is left out");
    const pausedBefore = report([...usualWeeks(-4, -2), run(at(-1, 0), 30, 330, { rpe: 3 }), run(at(-1, 3), 30, 330, { rpe: 3 }), ...usualWeeks(0, 0)], { paused: new Set([WR.addWeeks(start, -1)]) });
    assert(pausedBefore.rows[0].close, "A paused week doesn't count towards your usual");

    // The usual week says little
    const quiet = [...usualWeeks(-6, 0)];
    r = report(quiet);
    assert(r.rows.every(x => x.close || x.usual === "0"), "A usual week reads about the same");
    assert(r.observation === null, "A usual week has nothing to notice");
    assert(r.line.startsWith("3 runs, 2 strength days."), `Summary counts the week (${r.line})`);
    assert(r.active.active === 7 && r.active.counted === 8, "Consistency: active weeks of the last 8, not a streak");
    assert(r.longest.km === 8 && Math.abs(r.longest.top - 8.8) < 1e-9, "Next week: the top of your usual range");

    // Nothing after the week is looked at
    const later = report([...quiet, run(at(1, 0), 30)]);
    assert(later.longest.km === 8, "A report only knows what happened up to its end");

    // Current week is never part of its own usual
    const big = report([...usualWeeks(-5, -1), run(at(0, 0), 8, 340, { rpe: 3 }), run(at(0, 2), 8, 340, { rpe: 3 }), run(at(0, 4), 8, 340, { rpe: 3 }), gym(at(0, 1)), gym(at(0, 3))]);
    assert(big.observation && big.observation.rule === "load" && /above your usual/.test(big.observation.text), "A much bigger week is stated");
    assert(!big.observation.next, "Stated, with no instruction unless you felt tired");

    // Load: ratings, or minutes without them
    const unrated = usualWeeks(-5, 0).map(s => { const c = Object.assign({}, s); delete c.rpe; return c; });
    assert(report(unrated).rows[1].label === "Run minutes", "Without ratings, minutes stand in for load");
    assert(report(quiet).rows[1].label === "Run load", "With ratings, load is how hard x how long");
    assert(WR.load({ rpe: 5, time: 1800 }) === 150, "Load: RPE x minutes");

    // The long run
    const stretch = [...usualWeeks(-5, -1), run(at(0, 0), 5, 330, { rpe: 3 }), gym(at(0, 1)), gym(at(0, 3)), run(at(0, 6), 10, 340, { rpe: 3 })];
    r = report(stretch);
    assert(r.observation.rule === "long-run" && /longest in 30 days, by 25%/.test(r.observation.text), `Long run past 1.1x the last 30 days (${r.observation.text})`);
    assert(/Most runs like this are fine/.test(r.observation.text) && !/risk/i.test(r.observation.text), "Worded without alarm");
    const shortRuns = (t) => run(t, 3, 330, { rpe: 3 });
    const shortWeeks = []; for (let i = -5; i <= -1; i++) shortWeeks.push(shortRuns(at(i, 0)), shortRuns(at(i, 3)), gym(at(i, 1)), gym(at(i, 4)));
    const little = report([...shortWeeks, shortRuns(at(0, 0)), run(at(0, 3), 3.4, 330, { rpe: 3 }), gym(at(0, 1)), gym(at(0, 4))]);
    assert(little.observation === null, "13% longer but under half a km: not worth a mention");
    const jump = report([...usualWeeks(-5, -1), run(at(0, 0), 5), gym(at(0, 1)), gym(at(0, 3)), run(at(0, 6), 18, 340)]);
    assert(/big jump/.test(jump.observation.text), "More than double is a big jump");
    assert(report([run(at(-9, 0), 3), gym(at(0, 0)), run(at(0, 2), 10)]).observation.rule !== "long-run", "Nothing in the last 30 days: not a spike");
    const walkOnly = [...usualWeeks(-5, 0), walk(at(0, 6), 200)];
    assert(report(walkOnly).observation === null, "A long walk isn't a long run");

    // Pain comes first, and only if it's there
    const note = (text) => report([...stretch.slice(0, -1), run(at(0, 6), 10, 340, { rpe: 3, note: text })]);
    assert(note("left calf sore from km 3").observation.rule === "pain", "A sore calf in your notes comes first");
    assert(note("no pain at all, felt great").observation.rule === "long-run", "\"No pain\" isn't pain");

    // Resting heart rate
    const days = (n, bpm, end = at(1, 0, 0)) => Array.from({ length: n }, (_, i) => [end - (i + 0.5) * 86400000, typeof bpm === "function" ? bpm(i) : bpm]);
    const end = at(1, 0, 0);
    let rhr = WR.restingHeartRate([...days(7, 62), ...days(28, 55, end - 7 * 86400000)], end);
    assert(rhr.known && rhr.rise && rhr.shift === 7, "Resting HR: an unusual rise, against the 4 weeks before");
    rhr = WR.restingHeartRate([...days(7, 58), ...days(28, 55, end - 7 * 86400000)], end);
    assert(rhr.known && !rhr.rise && rhr.shift === 3, "Resting HR: a small shift isn't a rise");
    rhr = WR.restingHeartRate(days(10, 55), end);
    assert(!rhr.known, "Resting HR: no verdict without a baseline");
    const health = (week, base) => ({ sleep: [], resting: [...days(7, week), ...days(28, base, end - 7 * 86400000)] });
    r = report(quiet, { health: health(62, 55) });
    assert(r.observation.rule === "rest-alone" && /may mean nothing/i.test(r.observation.text), "Resting HR alone stays unconfirmed");
    const tired = quiet.map(s => s.startTime >= start ? Object.assign({}, s, { feel: "tired" }) : s);
    assert(report(tired, { health: health(62, 55) }).observation.rule === "rest-and-feel", "Resting HR and how you feel together say more");
    assert(!/illness/.test(report(quiet, { health: health(62, 55) }).observation.text), "Never a diagnosis from one signal");

    // Sleep
    const nights = (n, min, endAt = end) => Array.from({ length: n }, (_, i) => { const e = endAt - i * 86400000 - 3600000 * 12; return [e - min * 60000, e]; });
    const s1 = WR.sleepSummary([...nights(7, 360), ...nights(28, 450, end - 7 * 86400000)], end);
    assert(s1.known && s1.change === -90, "Sleep: the week's typical night against the 4 weeks before");
    assert(!WR.sleepSummary(nights(4, 360), end).known, "Sleep: no verdict from a few nights");
    r = report(quiet, { health: { resting: [], sleep: [...nights(7, 360), ...nights(28, 450, end - 7 * 86400000)] } });
    assert(r.observation.rule === "sleep" && !/score|poor|bad/i.test(r.observation.text), "Short sleep is stated, never scored");

    // Effort at the same pace
    const paced = (t, pace, rpe) => run(t, 6, pace, { rpe });
    const effortHistory = (bump) => {
        const rand = seeded(7), out = [];
        for (let w = -10; w <= 0; w++) [0, 2, 4].forEach(d => {
            const pace = 300 + Math.round(rand() * 60);
            const rpe = Math.round(4 + (330 - pace) / 12 + (w >= -1 ? bump : 0));
            out.push(paced(at(w, d), pace, rpe));
        });
        return out;
    };
    const flat = WR.effortDrift(effortHistory(0), end);
    assert(flat && Math.abs(flat.drift) < 1, `Effort: steady runs feel as their pace says (${flat && flat.drift.toFixed(2)})`);
    const harder = WR.effortDrift(effortHistory(2), end);
    assert(harder && harder.drift >= 1.8, `Effort: two weeks feeling harder shows in full, not diluted by being its own baseline (${harder && harder.drift.toFixed(2)})`);
    const noSense = []; { const rnd = seeded(3); for (let i = -10; i <= 0; i++) [0, 2, 4].forEach(d => { const pace = 300 + Math.round(rnd() * 60); noSense.push(paced(at(i, d), pace, Math.round(3 + (pace - 300) / 15))); }); }
    assert(WR.effortDrift(noSense, end) === null, "Effort: if quicker doesn't feel harder, it says nothing");
    assert(WR.effortDrift(effortHistory(0).slice(-5), end) === null, "Effort: no verdict without a history");
    const gyms = []; for (let w = -10; w <= 0; w++) gyms.push(gym(at(w, 1)), gym(at(w, 3)));
    assert(report([...effortHistory(2), ...gyms]).observation.rule === "effort", "Effort feeling harder is noticed");
    assert(WR.steady(run(at(0, 0), 6, 330, { guided: {} })) === false, "An interval session isn't a steady run");
    assert(WR.steady(run(at(0, 0), 2, 330)) === false, "Nor is a short one");

    // Strength
    let w = report([...usualWeeks(-5, -1), run(at(0, 0)), run(at(0, 2)), run(at(0, 5), 8, 340), gym(at(0, 1))]);
    assert(w.observation.rule === "strength" && /One strength day/.test(w.observation.text), "Under two strength days is noticed");
    assert(report(usualWeeks(-5, 0).filter(s => s.activity !== "strength")).observation === null, "No nagging if you've never done strength");
    const moved = [{ id: "push", name: "Push-ups", variation: "Diamond push-up", level: 4, levels: 6, sets: [{ reps: 6, target: 6 }] }];
    w = report([...usualWeeks(-5, -1), run(at(0, 0)), run(at(0, 2)), gym(at(0, 1), moved), gym(at(0, 3), moved)]);
    assert(/moved up to Diamond push-up/.test(w.wentWell), "Fewer reps on a harder step reads as progress");
    const dropped = (t) => gym(t, [{ id: "squat", name: "Squats", variation: "Squat", level: 1, levels: 6, sets: [{ reps: 8, target: 8 }] }]);
    const noPush = [...usualWeeks(-8, -4), ...[-3, -2, -1, 0].flatMap(x => [run(at(x, 0)), run(at(x, 2)), run(at(x, 5), 8, 340), dropped(at(x, 1)), dropped(at(x, 4))])];
    assert(report(noPush).observation.rule === "pattern" && /pushing/.test(report(noPush).observation.text), "A movement dropped for three weeks is noticed");
    const noPull = report(quiet);
    assert(noPull.observation === null, "A movement you never did isn't nagged about (no pull-up bar)");

    // Walks
    const steps = []; for (let m = 0; m <= 20; m++) steps.push([m * 60000, m * (m < 10 ? 110 : 80)]);
    assert(WR.briskMinutes({ steps: steps.map((p, i) => [p[0], i <= 10 ? i * 110 : 1100 + (i - 10) * 80]) }) === 10, "Walks: brisk minutes at 100 steps a minute");
    assert(WR.briskMinutes({}) === 0, "Walks: none without a step counter");

    // Heart rate from a wrist
    const hrRun = (samples) => run(at(0, 0), 6, 300, { hr: { samples } });
    const full = []; for (let t = 0; t < 1800000; t += 60000) full.push([t, 150]);
    assert(WR.cleanHeartRate(hrRun(full), 55) === 150, "HR: covered runs give a value");
    assert(WR.cleanHeartRate(hrRun(full.slice(0, 5)), 55) === null, "HR: sparse runs give none, not a guess");
    assert(WR.cleanHeartRate(hrRun(full.map(s => [s[0], 62])), 55) === null, "HR: readings near resting aren't a run");

    // Language follows the noise
    assert(WR.tier(0.01, 12, 12, 0.05) === 0, "1% between 4-week blocks: no clear change");
    assert(WR.tier(0.04, 12, 12, 0.05) === 1 && WR.tier(0.06, 12, 12, 0.05) === 2, "Bigger changes earn surer words");

    // Only every fourth report judges fitness
    const blocks = []; for (let i = 0; i < 8; i++) blocks.push(WR.isBlockWeek(WR.addWeeks(start, i)));
    assert(blocks.filter(Boolean).length === 2, "A block review every fourth week");
    const reviewWeek = WR.addWeeks(start, blocks.indexOf(true));
    const rv = WR.build({ sessions: [...usualWeeks(-9, 3)], start: reviewWeek });
    assert(rv.review && /No clear change/.test(rv.review[0].text), "Even pace for 8 weeks: no clear change");
    assert(/step 4 of 6/.test(rv.review.map(x => x.text).join()), "The review shows where you are on the ladder");
    assert(!report(quiet).review === !WR.isBlockWeek(start), "Other weeks don't judge fitness");
    const words = JSON.stringify([rv, report(stretch), report(quiet, { health: health(62, 55) })]);
    assert(!/readiness|injury risk|failed|you should|vo2/i.test(words.replace(/overuse injury/g, "")), "No scores, verdicts or \"should\"");

    // Backtest: a stable athlete, with ordinary noise, a year of weeks
    const rand = seeded(42), year = [];
    for (let i = -60; i <= 0; i++) {
        const noisy = (x, by) => x * (1 + (rand() - 0.5) * 2 * by);
        [0, 2, 5].forEach((d, n) => {
            const km = noisy(n === 2 ? 8 : 5, 0.05), pace = noisy(330, 0.05);
            year.push(run(at(i, d), km, pace, { rpe: Math.max(1, Math.round(3 + (330 - pace) / 15 + (rand() - 0.5) * 2)) }));
        });
        year.push(gym(at(i, 1)), gym(at(i, 4)));
    }
    let fired = 0, weeks = 0;
    for (let i = -40; i <= 0; i++) { weeks++; if (WR.build({ sessions: year, start: WR.addWeeks(start, i) }).observation) fired++; }
    assert(fired / weeks <= 0.15, `Backtest: a stable athlete isn't told something most weeks (${fired} of ${weeks})`);
})();

// ─── Gym and walks ───────────────────────────────────────────────────────────

console.log("\n=== Strength Planner Tests ===\n");

const SP = require("./strength-plan.js");
const benchEx = { id: "bench", name: "Bench press", sets: 3, repLow: 8, repHigh: 12, stepKg: 2.5, restSec: 120 };
const pushEx = { id: "pushup", name: "Push-up", sets: 3, repLow: 8, repHigh: 12, stepKg: 0, restSec: 90 };

// A session where you did `done` reps on each set against `target`
function gym(day, weight, target, done, ex = benchEx) {
    return { activity: "strength", startTime: day * 86400000, endTime: day * 86400000 + 1,
        exercises: [{ id: ex.id, name: ex.name, sets: done.map(reps => ({ weight, reps, target })) }] };
}

(function testStrengthTargets() {
    let t = SP.target(benchEx, []);
    assert(t.action === "first" && t.weight === null && t.reps === 8 && t.sets === 3, "First time: you pick the weight, bottom of the rep range");
    assert(SP.target(pushEx, []).weight === 0, "Bodyweight first time: no weight to pick");

    t = SP.target(benchEx, [gym(1, 60, 8, [8, 8, 9])]);
    assert(t.action === "rep" && t.weight === 60 && t.reps === 9, "Hit every set: one more rep, same weight");
    t = SP.target(benchEx, [gym(1, 60, 12, [12, 12, 12])]);
    assert(t.action === "step" && t.weight === 62.5 && t.reps === 8, "Hit the top of the range: add weight, back to the bottom");
    t = SP.target({ ...benchEx, stepKg: 5 }, [gym(1, 100, 12, [12, 12, 12])]);
    assert(t.weight === 105, "Steps by the exercise's own increment");
    t = SP.target(pushEx, [gym(1, 0, 12, [12, 12, 12], pushEx)]);
    assert(t.action === "rep" && t.reps === 13 && t.weight === 0, "Bodyweight: reps keep climbing");

    t = SP.target(benchEx, [gym(1, 60, 10, [10, 9, 8])]);
    assert(t.action === "hold" && t.weight === 60 && t.reps === 10, "Missed once: same target again");
    t = SP.target(benchEx, [gym(1, 60, 10, [10, 10])]);
    assert(t.action === "hold", "Fewer sets than planned counts as a miss");
    t = SP.target(benchEx, [gym(1, 60, 10, [10, 9, 8]), gym(2, 60, 10, [10, 8, 8])]);
    assert(t.action === "back" && t.weight === 55 && t.reps === 8, "Missed twice: 10% off, rounded to a real weight, bottom of the range");
    t = SP.target(benchEx, [gym(1, 60, 10, [9, 9, 9]), gym(2, 60, 10, [9, 9, 9]), gym(3, 55, 8, [7, 7, 7])]);
    assert(t.action === "hold" && t.weight === 55, "A miss after backing off starts counting again at the new weight");
    t = SP.target(benchEx, [gym(1, 60, 10, [10, 9, 8]), gym(2, 60, 10, [10, 10, 10]), gym(3, 60, 11, [11, 10, 10])]);
    assert(t.action === "hold", "Misses have to be in a row");
    t = SP.target(pushEx, [gym(1, 0, 10, [8, 8, 8], pushEx), gym(2, 0, 10, [8, 8, 8], pushEx)]);
    assert(t.action === "back" && t.reps === 8, "Bodyweight missed twice: fewer reps");

    t = SP.target(benchEx, [gym(1, 60, 12, [12, 12, 12])], "tired");
    assert(t.action === "hold" && t.weight === 60 && t.reps === 12, "Tired today: no step up");
    t = SP.target(benchEx, [gym(1, 60, 8, [8, 8, 8]), { activity: "strength", startTime: 9e12, endTime: null, exercises: [] }, { startTime: 9e12, endTime: 1, distance: 5000 }]);
    assert(t.reps === 9, "Unfinished sessions and runs don't affect suggestions");
    t = SP.target(benchEx, [gym(1, 60, 8, [8, 8, 8]), gym(2, 40, 8, [8, 8, 8], { id: "row", name: "Row" })]);
    assert(t.weight === 60, "Other exercises don't affect this one");
})();

(function testStrengthVoiceAndNumbers() {
    assert(SP.spokenSet("Bench press", 8, 60) === "Bench press. 8 reps at 60 kilos.", "Spoken set with weight");
    assert(SP.spokenSet("Push-up", 12, 0) === "Push-up. 12 reps.", "Spoken set, bodyweight");
    const cues = SP.restCues(90, "Squat. 8 reps at 80 kilos.");
    assert(cues.length === 3 && cues[0].inMs === 0 && /Rest 90 seconds/.test(cues[0].text) && /Next: Squat/.test(cues[0].text), "Rest: says how long and what's next");
    assert(cues[1].inMs === 80000 && cues[1].text === "10 seconds.", "Rest: warns at 10 seconds");
    assert(cues[2].inMs === 90000 && /^Go\. Squat/.test(cues[2].text), "Rest: calls the next set");
    assert(SP.restCues(15, "x").length === 2, "Short rest: no 10-second warning");

    assertApprox(SP.oneRepMax(100, 10), 133.3, 0.1, "Estimated 1RM (Epley)");
    assert(SP.oneRepMax(100, 1) === 100, "A single is your 1RM");
    assert(SP.volume(gym(1, 60, 8, [8, 8, 8])) === 1440, "Volume: weight times reps");
    const p = SP.progress([gym(1, 60, 8, [8, 8, 8]), gym(2, 70, 8, [8, 8, 7])]);
    assert(p.length === 1 && p[0].sessions === 2 && p[0].weight === 70 && p[0].reps === 8 && p[0].change > 0, "Progress: latest lift and gain per exercise");
    const c = SP.custom("  Cable Fly! ", { weights: true });
    assert(c.id === "custom-cable-fly" && c.name === "Cable Fly!" && c.stepKg === 2.5, "Your own exercise with weights");
    assert(SP.custom("Plank").id !== "plank", "Your own Plank doesn't share history with the preset");
    assert(SP.custom("पुश अप").id.length > "custom-".length, "A name in another script still gets an id");
    const own = SP.custom("Bear crawl");
    assert(own.stepKg === 0 && !own.ladder && !own.unit && SP.target(own, []).weight === 0, "Your own exercise is bodyweight by default");
    const ownHold = SP.custom("Dead hang", { timed: true });
    assert(ownHold.unit === "s" && SP.target(ownHold, []).reps === 20, "Your own timed hold");
    assert(SP.DEFAULT_ROUTINES.every(r => r.exercises.every(Boolean)), "Starter workouts all use real exercises");
    assert(SP.DEFAULT_ROUTINES.every(r => r.exercises.every(e => e.group === "No equipment")), "Starter workouts need no equipment at all");
    assert(SP.PRESETS.every(p => SP.GROUPS.includes(p.group)) && new Set(SP.PRESETS.map(p => p.id)).size === SP.PRESETS.length, "Every preset has a group and its own id");
    assert(SP.PRESETS.filter(p => p.ladder).every(p => p.level < p.ladder.length), "Every ladder starts on a real rung");
})();

(function testBodyweightLadders() {
    const push = SP.PRESETS.find(p => p.id === "push");
    const plank = SP.PRESETS.find(p => p.id === "plank");
    const on = (day, level, target, done, ex = push) => {
        const s = gym(day, 0, target, done, ex);
        s.exercises[0].level = level;
        s.exercises[0].unit = ex.unit;
        return s;
    };
    let t = SP.target(push, []);
    assert(t.variation === "Push-up" && t.reps === 6 && t.level === 3 && t.weight === 0, "First time: a sensible rung, no weight to pick");

    t = SP.target(push, [on(1, 3, 6, [6, 6, 7])]);
    assert(t.action === "rep" && t.reps === 7 && t.variation === "Push-up", "Hit it: one more rep on the same variation");
    t = SP.target(push, [on(1, 3, 6, [10, 9, 9])]);
    assert(t.reps === 10, "Did more than asked: builds on what you did, not the old target");
    t = SP.target(push, [on(1, 3, 6, [20, 15, 14])]);
    assert(t.action === "harder" && t.variation === "Diamond push-up" && t.reps === 6, "Far too easy: straight on to the next variation");
    t = SP.target(push, [on(1, 3, 12, [12, 12, 12])]);
    assert(t.action === "harder" && t.level === 4 && t.reps === 6 && /Mastered Push-up/.test(t.why), "Top of the range: next variation, bottom of the range");
    t = SP.target(push, [on(1, 3, 11, [12, 12, 11])]);
    assert(t.action === "rep" && t.level === 3 && t.reps === 12, "All sets must reach the top before moving up");
    t = SP.target(push, [on(1, 5, 12, [12, 12, 12])]);
    assert(t.action === "load" && t.level === 5 && t.reps === 12 && /backpack/.test(t.why), "Top of the ladder: reps stop at the top of the range, and it asks for load instead");
    t = SP.target(push, [on(1, 5, 10, [10, 10, 10])]);
    assert(t.action === "rep" && t.reps === 11, "Top of the ladder: reps still climb up to the top of the range");
    // A last rung with its own range: Nordic lowers are 3-6, not 6-12
    const curl = SP.PRESETS.find(p => p.id === "legcurl");
    const curlAt = (level, reps) => ({ activity: "strength", startTime: 1, endTime: 2, exercises: [{ id: "legcurl", level, sets: reps.map(r => ({ weight: 0, reps: r, target: reps[0] })) }] });
    t = SP.target(curl, [curlAt(2, [12, 12, 12])]);
    assert(t.action === "harder" && t.variation === "Nordic lower, feet under the bed" && t.reps === 3, "Moving up to Nordic lowers starts at 3 reps");
    t = SP.target(curl, [curlAt(3, [6, 6, 6])]);
    assert(t.action === "load" && t.reps === 6, "Nordic lowers top out at 6");
    t = SP.target(SP.PRESETS.find(p => p.id === "calftest"), []);
    assert(t.action === "test" && t.reps === 25 && t.sets === 2, "The calf test asks for as many as you can, one leg a set");

    t = SP.target(push, [on(1, 3, 8, [8, 7, 6])]);
    assert(t.action === "hold" && t.reps === 8 && t.level === 3, "Missed once: same again");
    t = SP.target(push, [on(1, 3, 9, [8, 7, 6]), on(2, 3, 9, [9, 7, 6])]);
    assert(t.action === "back" && t.reps === 7 && t.level === 3, "Missed twice: fewer reps first");
    t = SP.target(push, [on(1, 3, 6, [5, 4, 4]), on(2, 3, 6, [6, 5, 4])]);
    assert(t.action === "easier" && t.variation === "Knee push-up" && t.reps === 9, "Missed twice at the bottom of the range: the variation below, mid-range");
    t = SP.target(push, [on(1, 0, 6, [4, 4, 4]), on(2, 0, 6, [4, 4, 3])]);
    assert(t.level === 0 && t.reps === 6, "Bottom of the ladder: nowhere easier to go");
    t = SP.target(push, [on(1, 3, 6, [5, 5, 5]), on(2, 4, 6, [5, 5, 5])]);
    assert(t.action === "hold", "Misses on different variations don't add up");
    t = SP.target(push, [on(1, 3, 12, [12, 12, 12])], "tired");
    assert(t.action === "hold" && t.level === 3, "Tired today: stay on this variation");

    // Timed holds
    t = SP.target(plank, []);
    assert(t.unit === "s" && t.reps === 20 && t.variation === "Plank", "Holds start at the bottom of their range, in seconds");
    t = SP.target(plank, [on(1, 1, 20, [20, 20, 20], plank)]);
    assert(t.reps === 25 && /5 more seconds/.test(t.why), "Hold hit: 5 seconds more");
    t = SP.target(plank, [on(1, 1, 60, [60, 60, 60], plank)]);
    assert(t.variation === "Long-lever plank" && t.reps === 20, "A 60 s hold on every set: next variation");
    t = SP.target(plank, [on(1, 1, 40, [40, 30, 25], plank), on(2, 1, 40, [38, 30, 25], plank)]);
    assert(t.action === "back" && t.reps === 30, "Hold missed twice: 10 seconds less");

    // Choosing by hand
    let chosen = SP.change(push, SP.target(push, []), -1);
    assert(chosen.variation === "Knee push-up" && chosen.reps === 6 && chosen.why === "", "Easier: one rung down");
    assert(SP.change(push, { level: 5 }, 1) === null && SP.change(push, { level: 0 }, -1) === null, "No rung past either end");
    assert(SP.change(SP.custom("Bear crawl"), { level: 0 }, 1) === null, "No ladder, nothing to change");

    // Stopping early isn't failing
    const pushEx = SP.PRESETS.find(p => p.id === "push");
    const bw = (day, reps, target = 8) => ({ activity: "strength", startTime: day * 86400000, endTime: day * 86400000 + 1,
        exercises: [{ id: "push", level: 3, sets: reps.map(r => ({ weight: 0, reps: r, target })) }] });
    t = SP.target(pushEx, [bw(1, [8])]);
    assert(t.action === "hold" && t.reps === 8 && t.level === 3, "One set on target, then skipped: same again, no step up");
    t = SP.target(pushEx, [bw(1, [8]), bw(2, [8]), bw(3, [8, 8])]);
    assert(t.action === "hold" && t.reps === 8, "Skipping again and again never eases the plan");
    t = SP.target(pushEx, [bw(1, [5, 5, 5]), bw(2, [8]), bw(3, [5, 5, 5])]);
    assert(t.action === "back", "Real misses still count across a session you cut short");
    t = SP.target(Object.assign({}, pushEx, { sets: 4 }), [bw(1, [8, 8, 8])]);
    assert(t.action === "hold" && t.reps === 8, "Adding a set: the first go at it isn't held against you");
    const later = SP.target(push, [on(1, chosen.level, 6, [7, 7, 7])]);
    assert(later.variation === "Knee push-up" && later.reps === 8, "Your choice is remembered next time");

    // Voice
    assert(SP.spokenSet("Plank", 30, 0, "s") === "Plank. 30 seconds.", "Spoken hold");
    const h = SP.holdCues(30, "Plank");
    assert(h[0].text === "Plank. 30 seconds. Go." && h[1].inMs === 20000 && h[2].inMs === 30000 && h[2].text === "Stop.", "A hold is counted by voice");
    assert(SP.holdCues(15, "Plank").length === 2, "Short hold: no 10-second warning");
    assert(SP.after(h, 1000)[2].inMs === 31000, "Cues chain after a hold");
    assert(/Tap start/.test(SP.restCues(60, "Plank. 30 seconds.", { nextIsHold: true }).pop().text), "A hold after a rest waits for your tap");
    assert(SP.totalReps({ exercises: [{ sets: [{ reps: 10 }] }, { unit: "s", sets: [{ reps: 30 }] }] }) === 10, "Seconds don't count as reps");
    assert(SP.totalHeld({ exercises: [{ sets: [{ reps: 10 }] }, { unit: "s", sets: [{ reps: 30 }, { reps: 25 }] }] }) === 55, "Seconds held add up");
    const home = SP.DEFAULT_ROUTINES.flatMap(r => r.exercises.map(e => e.id));
    assert(home.includes("packrow") && !home.includes("pull") && !home.includes("row"), "Pulling with no bar: starter workouts use a backpack");
    assert(home.includes("beddip"), "Starter workouts have bed dips");

    // The full-body plan
    const kinds = ["push", "pull", "legs", "hinge", "core"];
    assert(SP.DEFAULT_ROUTINES.every(r => kinds.every(k => r.exercises.some(e => SP.patternOf(e.id) === k))),
        "Every starter workout trains pushing, pulling, legs, back of the hips and core");
    assert(SP.DEFAULT_ROUTINES.every(r => r.exercises.length >= 5 && r.exercises.length <= 7), "Starter workouts are 5 to 7 exercises");
    assert(SP.PRESETS.filter(p => p.group === "No equipment").every(p => SP.patternOf(p.id) !== "other" || ["burpee", "wallsit", "shortfoot", "toeyoga", "balance", "calftest"].includes(p.id)),
        "Home exercises count towards a movement in the weekly report");
    const newOnes = ["beddip", "pike", "towelrow", "stepup", "lunge", "legcurl", "deadbug", "copenhagen"];
    assert(newOnes.every(id => SP.PRESETS.find(p => p.id === id).ladder.every(v => SP.how(v))), "Every step of the new exercises says how to do it");

    // Saved workouts from before the plan
    const oldStarters = { progressId: "strength-routines", routines: [
        { id: "a", title: "Home A", exercises: ["push", "squat", "plank"].map(id => ({ id })) },
        { id: "b", title: "Home B", exercises: ["packrow", "back", "bridge", "sideplank"].map(id => ({ id })) },
    ] };
    const up1 = SP.upgradeRoutines(oldStarters);
    assert(up1 && up1.routines.map(r => r.id).join() === "fb-a,fb-b,fb-c" && up1.plan === SP.PLAN_VERSION, "Untouched old starters give way to the full-body plan");
    const edited = { routines: [{ id: "a", title: "Mine", exercises: ["push", "plank"].map(id => ({ id })) }, { id: "x", title: "Legs", exercises: [{ id: "squat" }] }] };
    const up2 = SP.upgradeRoutines(edited);
    assert(up2.routines.map(r => r.id).join() === "a,x,fb-a,fb-b,fb-c", "Workouts you changed or made stay, with the plan added after");
    assert(SP.upgradeRoutines(Object.assign({}, up2, { plan: SP.PLAN_VERSION })) === null, "Upgraded once only");
    assert(SP.upgradeRoutines({ routines: up2.routines }).routines.length === 5, "An older phone saving over it doesn't add the plan twice");

    // Up next: the one after the last you did
    const plan = SP.DEFAULT_ROUTINES;
    const did = (title, t) => ({ activity: "strength", title, startTime: t, endTime: t + 1 });
    assert(SP.upNext(plan, []) === 0, "Up next: A to begin with");
    assert(SP.upNext(plan, [did("Full body A", 1), did("Full body B", 2)]) === 2, "Up next: C after B");
    assert(SP.upNext(plan, [did("Full body C", 5), did("Full body A", 1)]) === 0, "Up next: back to A after C");
    assert(SP.upNext(plan, [did("Something else", 9)]) === 0, "Up next: A after a workout not in the list");

    // What Stats shows
    const p = SP.progress([Object.assign(on(1, 3, 6, [6, 6, 6]), {}), (() => { const s = on(2, 4, 6, [6, 6, 6]); Object.assign(s.exercises[0], { variation: "Diamond push-up", levels: 6 }); return s; })()]);
    assert(p[0].variation === "Diamond push-up" && p[0].level === 4 && p[0].levels === 6 && p[0].sessions === 2, "Progress shows your latest variation and step");
})();

(function testOtherActivitiesStayOutOfRunningNumbers() {
    const { calcWeeklyVolume, findBestEfforts } = require("./performance.js");
    const now = Date.UTC(2026, 9, 1, 12);
    const walk = Object.assign(sampleRun(900, now - 86400000), { activity: "walk" });
    const session = gym(now / 86400000 - 1, 60, 8, [8, 8, 8]);
    Object.assign(session, { distance: 0, time: 1800, pace: 0 });
    const others = [walk, session];
    assert(calcPaceTrend(others).length === 0, "Walks and gym sessions aren't in the pace trend");
    assert(findBestEfforts(others, [1])[1] === null, "...or your PBs");
    assert(calcWeeklyVolume(others, 2, now).every(w => w.km === 0), "...or weekly running volume");
    assert(RunAnalysis.fiveKPace(others, now) === null && RunAnalysis.vo2max(others, now) === null, "...or your 5K prediction and VO2max");
    assert(RunAnalysis.groupRoutes(others).length === 0, "...or your routes");
    const fast = Array.from({ length: 5 }, (_, i) => Object.assign(sampleRun(900, now - (i + 1) * 86400000), { activity: "walk" }));
    assert(TuneInPlanner.plan(fast, now).ready === false, "...or Tune-In's learning");
})();

// ─── Fun Run games (FunCoach; FunCoachTest.kt has the same cases) ───────────

(function testFunCoach() {
    const { FunCoach } = require("./coach.js");
    const game = (kind, seconds, chaser) => ({ type: "run", durationMs: seconds * 1000, game: kind, chaser });
    const easy = { type: "run", durationMs: 60000 };
    // One segment at a steady pace (s/km, null = standing still), ticking every 500 ms
    const leg = (c, index, t0, d0, ms, pace) => {
        const { ended, said: after } = c.startSegment(index, t0, d0);
        const said = ended.concat(after);
        for (let t = t0; t < t0 + ms; t += 500) said.push(...c.tick(t, d0 + (pace == null ? 0 : (t - t0) / pace)));
        return { said, t: t0 + ms, d: d0 + (pace == null ? 0 : ms / pace) };
    };

    let c = new FunCoach([game("burst", 20), easy, game("burst", 20), easy, game("burst", 20), easy], { bestBurst: 240 });
    let r = leg(c, 0, 0, 0, 20000, 250);
    r = leg(c, 1, r.t, r.d, 60000, 400);
    assert(r.said[0] === "4 10 per kilometre. Nice.", "Burst: its pace, said straight after");
    r = leg(c, 2, r.t, r.d, 20000, 245);
    r = leg(c, 3, r.t, r.d, 60000, 400);
    assert(r.said[0] === "4 oh 5 per kilometre. 5 seconds quicker than the last one!", "Burst: against the last one");
    r = leg(c, 4, r.t, r.d, 20000, 235);
    assert(c.finish(r.t, r.d)[0] === "3 55 per kilometre. Your quickest burst this month!" && c.results.bursts.length === 3, "Burst: against your best this month");

    c = new FunCoach([game("chase", 60, "zombie"), easy], { easyPace: 360 });
    r = leg(c, 0, 0, 0, 60000, 360);
    assert(r.said.includes("The zombie is right behind you! Go, go!") && r.said.includes("45 metres."), "Chase: the gap is called out as it closes");
    assert(c.buzz.splice(0).join() === "start,close", "Chase: buzzes at the start and when it's close");
    assert(c.finish(r.t, r.d)[0] === "You got away! Back to easy." && c.results.escaped === 1 && c.buzz.splice(0).join() === "end", "Chase: escaped");

    c = new FunCoach([game("chase", 60, "dog"), easy], { easyPace: 360 });
    r = leg(c, 0, 0, 0, 60000, null);
    assert(r.said.includes("The dog caught you! Shake it off. You'll get away next time."), "Chase: caught, cheerfully");
    assert(c.finish(r.t, r.d).length === 0 && c.results.caught === 1 && c.buzz.splice(0).join() === "start,close,end", "Chase: caught counts once, one end buzz");

    c = new FunCoach([game("steps", 10), easy], { bestSteps: 25 });
    c.startSegment(0, 0, 0, 100);
    assert(c.finish(10000, 30, 130)[0] === "30 steps. That's 180 a minute! Your most yet!" && c.buzz.length === 0, "Steps: counted from the step counter");

    c = new FunCoach([game("finish", 20)]);
    c.startSegment(0, 0, 0);
    assert(c.finish(20000, 83.333333)[0] === "Photo finish: 4 minutes per kilometre.", "Photo finish: the first one");
    c = new FunCoach([game("finish", 20)], { bestFinish: 250 });
    c.startSegment(0, 0, 0);
    assert(c.finish(20000, 83.333333)[0] === "Photo finish: 4 minutes per kilometre. Your best finish yet!", "Photo finish: a new best");

    c = new FunCoach([game("burst", 20)]);
    c.startSegment(0, 0, 0);
    assert(c.finish(20000, 10).length === 0, "A burst too short for GPS says nothing");
})();

// ─── Weekly report: what to work on, and fitness age ────────────────────────

(function testBalancedReport() {
    const WR = require("./weekly-report.js");
    const DAY = 86400000;
    const mon = new Date(2026, 10, 2, 0).getTime();
    const at = (d, h = 7) => mon + d * DAY + h * 3600000;
    const run = (d, extra = {}) => Object.assign({ runId: at(d), startTime: at(d), endTime: at(d) + 1800000, distance: 5000, time: 1800, pace: 360,
        timeSeries: [{ distance: 2500, time: 900000 }, { distance: 5000, time: 1800000 }] }, extra);
    const gym = (d) => ({ runId: at(d, 18), activity: "strength", title: "Full body A", startTime: at(d, 18), endTime: at(d, 18) + 1800000, distance: 0, time: 1800, pace: 0, exercises: [] });
    const work = (sessions, planned) => WR.build({ sessions, start: mon, planned }).toWorkOn.map(x => x.rule);

    // A good week: nothing to say, and it says so
    const good = [run(1, { rpe: 3 }), gym(0), run(3, { rpe: 4 }), gym(4), run(6, { rpe: 3 })];
    assert(work(good, { sessions: 5 }).length === 0, "A week that went to plan: nothing to work on");
    // Two of five planned
    assert(work([run(1, { rpe: 3 }), gym(3)], { sessions: 5 })[0] === "plan", "Missed most of the plan: said first");
    assert(!work([run(1, { rpe: 3 }), gym(0), run(3, { rpe: 3 }), gym(4)], { sessions: 5 }).includes("plan"), "One short of the plan is fine");
    // Easy runs that weren't
    const hardEasy = work([run(1, { rpe: 7 }), gym(0), run(3, { rpe: 6 }), gym(4), run(6, { rpe: 3 })], { sessions: 5 });
    assert(hardEasy.includes("easy-hard"), "Easy runs rated 6+ get called out");
    const intervals = { guided: { plan: { role: "quality" }, segments: [] } };
    assert(!work([run(1, Object.assign({ rpe: 8 }, intervals)), gym(0), run(3, { rpe: 3 }), gym(4), run(6, { rpe: 4 })], { sessions: 5 }).includes("easy-hard"), "A hard session is meant to be hard");
    // Unrated runs, and a long gap
    assert(work([run(0), run(1), gym(2), gym(3)], null).includes("ratings"), "Unrated runs: asks for ratings");
    const gap = work([run(0, { rpe: 3 }), gym(0), run(1, { rpe: 3 }), gym(1)], null);
    assert(gap.includes("gap"), "Five days with nothing at the end of the week: called out");
    assert(work([run(1, { rpe: 3 }), run(3, { rpe: 3 }), run(6, { rpe: 3 })], null)[0] === "strength", "No strength days: called out");
    assert(work([run(1, { rpe: 3 }), run(3, { rpe: 3 }), run(6, { rpe: 3 }), gym(2), gym(4)], null).length <= 2, "Two things at most");
    const light = WR.build({ sessions: [run(2)], start: mon, planned: { sessions: 5 } });
    assert(light.light && light.toWorkOn.length === 1 && /Ill or away/.test(light.toWorkOn[0].next), "A light week against a plan: said kindly, with a way out");

    // Fitness age (FRIEND 2022 treadmill medians)
    const RA = require("./analysis.js");
    const m = RA.fitnessAge(38.6, 50, "male");
    assert(m.age === 35 && Math.abs(m.norm - 32.1) < 0.1, `Fitness age: a man of 50 at the median for 35 (38.6) is 35 (${m.age}, norm at 50 ${m.norm})`);
    assert(RA.fitnessAge(32.1, 50, "male").age === 50, "...and at his own age's median, his own age");
    assert(RA.fitnessAge(25.9, 30, "female").age === 45, "Women have their own medians");
    assert(RA.fitnessAge(60, 35, "male").below20 && RA.fitnessAge(60, 35, "male").age === 20, "Fitter than the youngest median: under 20");
    assert(RA.fitnessAge(12, 35, "male").above90, "Below the oldest median: over 89");
    assert(RA.fitnessAge(45, 35, null) === null && RA.fitnessAge(null, 35, "male") === null, "No age or sex, no fitness age");
})();

// ─── Stats (stats.js) ────────────────────────────────────────────────────────

(function testStats() {
    const S = require("./stats.js");
    const DAY = 86400000;
    const now = new Date(2026, 10, 9, 20).getTime();
    const run = (daysAgo, km, min, extra = {}, hour = 7) => {
        const d = new Date(now - daysAgo * DAY); d.setHours(hour, 0, 0, 0);
        const t = d.getTime();
        return Object.assign({ runId: t, startTime: t, endTime: t + min * 60000, distance: km * 1000, time: min * 60, pace: min * 60 / km,
            timeSeries: Array.from({ length: Math.floor(km) }, (_, i) => ({ distance: (i + 1) * 1000, time: (i + 1) * min * 60000 / km })) }, extra);
    };
    const gym = (daysAgo, extra = {}) => { const t = now - daysAgo * DAY - 3600000; return Object.assign({ runId: t, activity: "strength", title: "Full body A", startTime: t, endTime: t + 1800000, distance: 0, time: 1800, pace: 0, exercises: [] }, extra); };

    // Headline: this 4 weeks against the 4 before
    const s1 = [run(3, 5, 30), run(10, 5, 30), run(20, 10, 60), gym(4), run(40, 5, 30)];
    const h = S.headline(s1, "4w", now);
    assert(h.cur.km === 20 && h.cur.runs === 3 && h.cur.workouts === 1 && h.prev.km === 5 && h.km === 300, "Headline: km, runs and workouts against the period before");

    // Calendar and streaks
    const cal = S.calendar(s1, now);
    const days = cal.flat();
    assert(cal.length === 53 && cal.every(w => w.length === 7), "Calendar: a year of weeks, Monday first");
    assert(days.filter(d => d.runs).length === 4 && days.filter(d => d.gyms).length === 1 && days.some(d => d.future) === (new Date(now).getDay() !== 0), "Calendar: each day says what was done");
    const st = S.dayStreaks([run(0, 3, 20), run(1, 3, 20), run(2, 3, 20), run(9, 3, 20), run(10, 3, 20)], now);
    assert(st.longest === 3 && st.current === 3, "Streak: days in a row, and the current one");
    assert(S.dayStreaks([run(5, 3, 20)], now).current === 0, "A streak that ended isn't current");

    // Records
    const hot = run(15, 6, 40, { weather: { feelsC: 41 }, elevation: { gain: 120, points: [] } }, 5);
    const recs = S.records(s1.concat([hot, Object.assign(run(25, 4, 22), { funResults: { bursts: [[3, 230], [5, 90]] } })]), now);
    const rec = (k) => recs.find(r => r.key === k);
    assert(rec("longest").value === "10.0 km" && rec("week").value === "16.0 km", "Records: longest run and biggest week");
    assert(rec("km").value === "5:30 /km", `Records: fastest whole km (${rec("km").value})`);
    assert(rec("hot").value === "41°C feels-like" && rec("climb").value === "120 m" && rec("early").value === "5:00", "Records: hottest, most climbing, earliest");
    assert(rec("burst").value === "3:50 /km", "Records: quickest Fun Run burst, ignoring car speeds");
    assert(recs.every(r => r.key === "streak" || r.runId), "Every record links to its run");

    // Flat and cool, effort split
    const fc = S.flatCoolPace([run(2, 5, 30, { weather: { feelsC: 38 } })], now - 7 * DAY, now)[0];
    assert(fc.flat < fc.pace && Math.abs(fc.flat - 360 / 1.08) < 0.5, "Flat and cool: a 38°C run counts as quicker");
    const it = S.intensity([run(1, 5, 30, { rpe: 3 }), run(2, 5, 30, { rpe: 7 }), run(3, 5, 30, { rpe: 5 }), run(4, 5, 30), run(5, 5, 30, { guided: { plan: { role: "long" } } })], now - 7 * DAY, now);
    assert(it.easy === 60 && it.hard === 30 && it.moderate === 30 && it.unrated === 30 && Math.abs(it.easyShare - 0.5) < 1e-9, "Effort split: by rating, then by plan role");

    // Predictions
    const pr = S.predictions([run(5, 5, 25)], "4w", now);
    assert(pr[0].label === "5K" && Math.round(pr[0].sec) === 1500 && pr[1].sec > 2 * pr[0].sec && pr[0].was === null, "Race predictions from your 5K, Riegel for longer");

    // Strength
    const lad = (d, level) => gym(d, { exercises: [{ id: "push", name: "Push-ups", variation: "x", level, levels: 6, sets: [{ reps: 8, target: 8 }] }] });
    const ls = S.ladders([lad(40, 2), lad(20, 3), lad(5, 4)], now - 28 * DAY, now);
    assert(ls.length === 1 && ls[0].from === 2 && ls[0].to === 4, "Ladders: where you started the period and where you are");
    const ct = S.calfTests([gym(3, { title: "Calf test", light: true, exercises: [{ id: "calftest", sets: [{ reps: 22 }, { reps: 19 }] }] })]);
    assert(ct.length === 1 && ct[0].left === 22 && ct[0].right === 19, "Calf tests: each leg");
    const bal = S.balance([gym(3, { exercises: [{ id: "push", sets: [1, 2, 3] }, { id: "towelrow", sets: [1, 2] }, { id: "squat", sets: [1] }] })], now - 7 * DAY, now);
    assert(bal.push === 3 && bal.pull === 2 && bal.legs === 1, "Balance: sets by movement");

    // Patterns: only with enough runs, and they say how many
    const pat = [];
    for (let i = 0; i < 6; i++) pat.push(run(2 + i, 5, 28, {}, 6), run(30 + i, 5, 31, {}, 18));
    const ps = S.patterns(pat);
    assert(ps.length === 1 && ps[0].key === "time" && /Mornings: you run 10% quicker/.test(ps[0].text) && /6 morning and 6 evening/.test(ps[0].n), "Patterns: mornings vs evenings, with the counts");
    assert(S.patterns(pat.slice(0, 6)).length === 0, "Patterns: too few runs, nothing said");

    // Lifetime and the month
    const life = S.lifetime([run(1, 100, 600), run(2, 50, 300, { elevation: { gain: 900 } })]);
    assert(life.km === 150 && life.like.some(x => /Abu Dhabi 1.1 times/.test(x)) && life.like.some(x => /Burj Khalifa 1.1/.test(x)), "Lifetime totals, with something to picture");
    const recap = S.monthRecap([run(15, 5, 30), run(20, 8, 50), run(45, 5, 30)], new Date(2026, 10, 3, 9).getTime());
    assert(recap && recap.month && recap.cur.runs >= 1, "Month recap: last month in a few lines");
})();

// ─── The training plan (training-plan.js) ────────────────────────────────────

(function testTrainingPlan() {
    const TP = require("./training-plan.js");
    const SP = require("./strength-plan.js");
    const WR = require("./weekly-report.js");
    const DAY = 86400000;
    const at = (y, m, d, h = 9) => new Date(y, m, d, h).getTime();
    const mon = at(2026, 10, 9, 0); // a Monday
    const run = (t, km, min, extra = {}) => Object.assign({ runId: t, startTime: t, endTime: t + min * 60000, distance: km * 1000, time: min * 60, pace: min * 60 / km }, extra);
    // Three weeks of 5-8 km runs, the longest 8 km
    const runs = [];
    for (let i = 1; i <= 9; i++) runs.push(run(mon - i * 2.5 * DAY, i % 3 === 0 ? 8 : 5, i % 3 === 0 ? 48 : 30));
    const plan = TP.defaults(mon);
    // Planned from Monday morning; `day` is only a label here
    const ctx = (day, extra = {}) => Object.assign({ runs, now: mon + 9 * 3600000, p5: RunAnalysis.fiveKPace(runs, mon), feel: "normal", today: true }, extra);

    // The week's shape
    assert(plan.runDays.join() === "1,3,6" && plan.gymDays.join() === "0,4", "Suggested week: runs Tue/Thu/Sun, strength Mon/Fri");
    const roles = TP.roles(plan.runDays, "fitter");
    assert(roles[6] === "long" && Object.values(roles).filter(r => r === "quality").length === 1, "One long run and one harder session at three runs a week");
    assert(Object.values(TP.roles([0, 1, 3, 5, 6], "fitter")).filter(r => r.startsWith("quality")).length === 2, "Two harder sessions at five runs a week");
    assert(Object.values(TP.roles([1, 3, 6], "start")).every(r => r !== "quality"), "Starting out: no hard sessions at all");
    [2, 3, 4, 5].forEach(n => {
        const d = TP.defaults(mon, { runs: n, gym: 2 });
        const long = Math.max(...d.runDays);
        assert(!d.gymDays.includes((long + 6) % 7), `Strength is never the day before the long run (${n} runs a week)`);
    });

    // The long run: at most 10% past the longest in 30 days
    const sunday = mon + 6 * DAY + 9 * 3600000;
    const long = TP.dayPlan(plan, sunday, ctx(sunday));
    const km = Number(/about ([\d.]+) km/.exec(long.title)[1]);
    assert(long.role === "long" && km > 8 && km <= 8 * 1.1, `Long run grows, but no more than 10% past your longest in 30 days (${km} km after 8 km)`);
    assert(/5,200 runners/.test(long.why), "...and says why");
    const easier = TP.dayPlan(Object.assign({}, plan, { startedAt: mon - 3 * 7 * DAY }), sunday, ctx(sunday));
    assert(/easier week/.test(easier.blockText) && Number(/about ([\d.]+) km/.exec(easier.title)[1]) < 8, "Every fourth week is easier, the long run shorter");

    // Paces from the 5K, and only easy runs by feel
    const thu = mon + 3 * DAY + 9 * 3600000;
    const q = TP.dayPlan(Object.assign({}, plan, { startedAt: mon - 7 * DAY }), thu, ctx(thu));
    assert(q.role === "quality" && q.session.segments.some(s => s.pace > 0), "The harder session has paces");
    assert(q.session.segments.every(s => s.say), "Every part of a plan run says what to do");
    const tue = mon + DAY + 9 * 3600000;
    const easy = TP.dayPlan(plan, tue, ctx(tue));
    assert(easy.role === "easy" && easy.session.segments.every(s => s.pace == null), "Easy runs have no pace target");
    assert(RunAnalysis.guidedReport(run(tue, 5, 30, { timeSeries: [{ distance: 2500, time: 900000 }, { distance: 5000, time: 1800000 }] }), { segments: easy.session.segments }, 300).judged === 0, "...so they're never judged fast or slow");
    const hot = TP.dayPlan(Object.assign({}, plan, { startedAt: mon - 7 * DAY }), thu, ctx(thu, { weather: { feelsC: 33 } }));
    const p = (x) => x.session.segments.find(s => s.pace).pace;
    assert(p(hot) > p(q) && hot.notes.some(n => /heat/.test(n)), "Heat slows the paces, and it says so");

    // Adapting
    const tired = TP.dayPlan(Object.assign({}, plan, { startedAt: mon - 7 * DAY }), thu, ctx(thu, { feel: "tired" }));
    assert(tired.role === "easy" && /tired/.test(tired.why), "Tired: the hard session becomes an easy run");
    const drift = TP.dayPlan(Object.assign({}, plan, { startedAt: mon - 7 * DAY }), thu, ctx(thu, { signals: { drift: true } }));
    assert(drift.role === "easy", "Fatigue in the weekly report: the hard session becomes an easy run");
    const sick = TP.dayPlan(Object.assign({}, plan, { sickUntil: thu + DAY }), thu, ctx(thu));
    assert(sick.role === "easy" && sick.minutes <= 20 && /above the neck/.test(sick.about), "Unwell: short and easy, and only above the neck");
    assert(TP.dayPlan(Object.assign({}, plan, { sickUntil: mon + 5 * DAY }), mon + 4 * DAY, ctx(mon + 4 * DAY)).kind === "rest", "Unwell: strength waits");
    const later = mon + 28 * DAY + 3 * DAY + 9 * 3600000; // a Thursday, three weeks after the last run
    const back = TP.dayPlan(Object.assign({}, plan, { startedAt: mon - 7 * DAY }), later, ctx(later, { now: later }));
    assert(back.role === "easy" && back.minutes <= 25 && /first run in/.test(back.why), "Back after a break: an easy one first");
    const backLong = TP.dayPlan(plan, later + 3 * DAY, ctx(later + 3 * DAY, { now: later, today: false }));
    assert(!/km/.test(backLong.title), "...and no old long run to build on means a long run by time");
    assert(TP.comeback(runs, mon + 20 * DAY) && !TP.comeback(runs, mon + DAY), "A session after six days or more is a comeback");

    // A missed session isn't owed: Thursday's plan doesn't change because Tuesday was skipped
    const thuWithout = TP.dayPlan(plan, thu, ctx(thu, { runs: runs.filter(r => r.startTime < mon) }));
    assert(thuWithout.title === TP.dayPlan(plan, thu, ctx(thu)).title, "A missed run is dropped, not added to the next one");

    // A race date: a taper, then the race
    const race = Object.assign({}, plan, { goal: "10k", raceDate: mon + 19 * DAY + 9 * 3600000 }); // a Saturday
    assert(/easing off/.test(TP.dayPlan(race, sunday, ctx(sunday)).blockText), "Two weeks out: the taper starts");
    assert(TP.dayPlan(race, race.raceDate, ctx(race.raceDate)).role === "race", "Race day is race day");
    assert(TP.dayPlan(race, mon + 20 * DAY + 9 * 3600000, ctx(mon + 20 * DAY, { today: false })).kind === "rest", "Race week: the race is the long run");

    // This week only
    const moved = Object.assign({}, plan, { weeks: { [WR.dayKey(mon)]: { runDays: [2, 4, 5], gymDays: [0] } } });
    assert(TP.weekDays(moved, mon).runDays.join() === "2,4,5" && TP.weekDays(moved, mon + 7 * DAY).runDays.join() === "1,3,6", "Moving days changes one week only");

    // Weekly target and streak: one skip allowed, freezes earned
    const sess = (t) => run(t, 5, 30);
    const weekOf = (m, n) => Array.from({ length: n }, (_, i) => sess(m + i * DAY + 9 * 3600000));
    const p0 = Object.assign({}, plan, { startedAt: mon - 8 * 7 * DAY });
    let hist = [];
    for (let w = 8; w >= 1; w--) hist = hist.concat(weekOf(mon - w * 7 * DAY, 4)); // 4 of 5 each week
    let st = TP.streak(p0, hist, mon + DAY);
    assert(st.streak === 8 && st.freezes === 2, `One short of the target still keeps the week; a freeze every four weeks (${st.streak}, ${st.freezes})`);
    hist = hist.filter(r => r.startTime < mon - 3 * 7 * DAY || r.startTime >= mon - 2 * 7 * DAY); // a blank week
    st = TP.streak(p0, hist, mon + DAY);
    assert(st.streak === 7 && st.freezes === 0, "A missed week uses a freeze instead of breaking the streak");
    st = TP.streak(p0, hist.filter(r => r.startTime < mon - 6 * 7 * DAY), mon + DAY);
    assert(st.streak === 0, "Weeks missed with no freezes left: back to zero");
    const paused = new Set([mon - 7 * DAY]);
    st = TP.streak(p0, hist.filter(r => r.startTime < mon - 7 * DAY), mon + DAY, paused);
    assert(st.streak > 0, "A week marked ill or away doesn't break it");
    const light = Object.assign(sess(mon + 9 * 3600000), { activity: "strength", light: true, distance: 0 });
    assert(TP.streak(p0, [light], mon + DAY).done === 0, "Foot core doesn't count as a session");

    // Paces move only when you say so
    const anchored = Object.assign({}, plan, { p5: 400, p5At: mon - 30 * DAY });
    const quick = runs.concat([run(mon - DAY, 5, 25, { guided: { plan: { role: "quality" } } }), run(mon - 2 * DAY, 5, 25, { guided: { plan: { role: "quality" } } })]);
    const sug = TP.paceSuggestion(anchored, quick, mon);
    assert(sug && sug.faster && sug.p5 < 400, "Quicker runs: it offers quicker paces");
    assert(TP.dayPlan(Object.assign({}, anchored, { startedAt: mon - 7 * DAY }), thu, Object.assign(ctx(thu), { runs: quick, p5: anchored.p5 })).session.segments.some(s => s.pace >= 400), "...but uses the old ones until you agree");
    assert(TP.paceSuggestion(Object.assign({}, anchored, { p5SnoozeUntil: mon + DAY }), quick, mon) === null, "\"Not now\" waits");
    assert(TP.paceSuggestion(Object.assign({}, anchored, { p5At: mon }), quick, mon + DAY) === null, "Needs two harder sessions since the last change");

    // Reminders: the next planned session not yet done
    const r1 = TP.nextReminder(plan, { runs, now: mon + 8 * 3600000 });
    assert(r1 && new Date(r1.at).getDay() === 1, "Reminder: Monday's strength, if nothing's logged");
    const doneMon = runs.concat([Object.assign(sess(mon + 7 * 3600000), { activity: "strength" })]);
    const r2 = TP.nextReminder(plan, { runs: doneMon, now: mon + 8 * 3600000 });
    assert(r2 && new Date(r2.at).getDay() === 2, "Done already: the reminder moves on to Tuesday");

    // The gym plan, version 3
    const v2 = { routines: [
        { id: "fb-a", title: "Full body A", exercises: "push,squat,packrow,bridge,beddip,plank".split(",").map(id => ({ id })) },
        { id: "mine", title: "Mine", exercises: [{ id: "push" }] },
    ], plan: 2 };
    const up = SP.upgradeRoutines(v2);
    assert(up.routines.map(r => r.id).join() === "mine,fb-a,fb-b,fb-c" && up.routines[1].exercises[0].id === "hops", "Last version's untouched starters are replaced; yours stay");
    assert(SP.freshen({ id: "calf", sets: 4, restSec: 30 }).ladder.length === 3 && SP.freshen({ id: "calf", sets: 4, restSec: 30 }).sets === 4, "Saved exercises get the new ladder steps, keeping your sets");
    assert(SP.upNext(SP.DEFAULT_ROUTINES, [{ activity: "strength", title: "Full body A", startTime: 1, endTime: 2 }, { activity: "strength", title: "Foot core", light: true, startTime: 3, endTime: 4 }]) === 1, "Foot core doesn't move the A, B, C turn");
    const weekTally = WR.tally([Object.assign(sess(mon + 9 * 3600000), { activity: "strength", light: true, exercises: [] })], mon);
    assert(weekTally.strengthDays === 0, "The weekly report doesn't count foot core as a strength day");

    // The pace coach speaks a plan's own words
    const coach = new PaceCoach([{ role: "cruise", pace: 300, durationMs: 300000, say: "Rep 1 of 3. 5 minutes at 5 minutes per kilometre." }]);
    assert(coach.startSegment(0, 0, 0)[0] === "Rep 1 of 3. 5 minutes at 5 minutes per kilometre.", "The coach reads a plan run's own cue");
})();

// ─── Storage and sync: real IndexedDB (in memory), a fake Supabase ───────────

require("fake-indexeddb/auto");
const { IDBFactory } = require("fake-indexeddb");
const Store = require("./run-store.js");

function fakeLocalStorage() {
    const m = new Map();
    return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) };
}

// What sync.js expects around it. Each phone is its own database and settings.
Object.assign(global, Store, {
    isRunLive: () => false, currentRunId: null, renderHomeRecent() {}, renderHistory() {}, showToast() {}, escapeHtml: s => s,
    Enrich: { healthState: () => ({}), init() {} },
    NativeTracker: { available: false },
    document: { getElementById: id => id === "tab-history" ? { classList: { contains: () => false } } : null, addEventListener() {}, createElement: () => ({ click() {} }) },
});
Object.defineProperty(global, "db", { get: Store.database });
const CloudSync = require("./sync.js");

function fakeServer({ refuseOlder = false } = {}) {
    const srv = { runs: new Map(), course_progress: new Map(), clock: 0, posts: [], failAfterPosts: null };
    const cols = { runs: "run_id", course_progress: "progress_id" };
    const reply = (status, body) => ({ ok: status < 400, status, text: async () => body == null ? "" : JSON.stringify(body) });
    srv.fetch = async (url, options = {}) => {
        const u = new URL(url), [, , , table] = u.pathname.split("/");
        if (u.pathname.endsWith("rpc/heartbeat")) return reply(200, "x");
        const col = cols[table], rows = srv[table];
        if (options.method === "POST") {
            if (srv.failAfterPosts != null && srv.posts.length >= srv.failAfterPosts) return reply(500, { message: "down" });
            const body = JSON.parse(options.body);
            srv.posts.push(body.map(r => r[col]));
            // One statement, one now(): rows written together share updated_at
            const at = new Date(++srv.clock * 1000).toISOString();
            body.forEach(r => {
                const had = rows.get(String(r[col]));
                if (refuseOlder && had && r.client_updated_at < had.client_updated_at) return;
                rows.set(String(r[col]), Object.assign({}, r, { updated_at: at }));
            });
            return reply(201, null);
        }
        // Ids compare as numbers for runs (bigint) and as text for course progress
        const idCmp = (a, b) => table === "runs" ? Number(a) - Number(b) : String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
        const all = [...rows.values()].sort((a, b) => a.updated_at < b.updated_at ? -1 : a.updated_at > b.updated_at ? 1 : idCmp(a[col], b[col]));
        const inList = u.searchParams.get(col);
        if (inList) {
            const ids = inList.slice(4, -1).split(",").map(x => x.replace(/"/g, ""));
            return reply(200, all.filter(r => ids.includes(String(r[col]))).map(r => ({ data: r.data })));
        }
        // or=(updated_at.gt."T",and(updated_at.eq."T",<col>.gt."ID")): after a page ending at (T, ID)
        const cursor = /^\(updated_at\.gt\."([^"]*)",and\(updated_at\.eq\."[^"]*",\w+\.gt\."([^"]*)"\)\)$/.exec(u.searchParams.get("or") || "");
        const [, op, since] = /^(gte?)\.(.*)$/.exec(u.searchParams.get("updated_at") || "") || [];
        return reply(200, all.filter(r => cursor ? r.updated_at > cursor[1] || (r.updated_at === cursor[1] && idCmp(r[col], cursor[2]) > 0)
            : !since || (op === "gte" ? r.updated_at >= since : r.updated_at > since))
            .slice(0, Number(u.searchParams.get("limit")) || undefined)
            .map(r => ({ [col]: r[col], client_updated_at: r.client_updated_at, updated_at: r.updated_at })));
    };
    return srv;
}

async function phone(srv) {
    const p = { idb: new IDBFactory(), storage: fakeLocalStorage() };
    p.use = async () => {
        global.indexedDB = p.idb;
        global.localStorage = p.storage;
        global.fetch = srv.fetch;
        await Store.initDB();
    };
    await p.use();
    p.storage.setItem("cloudSync", JSON.stringify({ url: "https://x.test", key: "k", session: { access: "a", refresh: "r", expiresAt: 9999999999, userId: "u" } }));
    return p;
}

const syncedRun = (id, updatedAt, extra = {}) => Object.assign(sampleRun(50, id), { updatedAt }, extra);
const summaryOf = (runs, id) => runs.find(r => r.runId === id);

async function testStorage() {
    console.log("\n=== Run Storage Tests ===\n");

    // Upgrading the database a phone already has
    global.indexedDB = new IDBFactory();
    const old = sampleRun();
    old.updatedAt = 12345;
    const unfinished = Object.assign(sampleRun(30, old.runId + 1), { endTime: null, updatedAt: 5 });
    const bare = { runId: old.runId + 2, startTime: old.startTime + 2, endTime: old.endTime, distance: 2000, time: 600, pace: 300, timeSeries: [], updatedAt: 7 };
    await new Promise((resolve, reject) => {
        const req = indexedDB.open("RunDB", 2);
        req.onupgradeneeded = e => {
            const d = e.target.result;
            d.createObjectStore("runs", { keyPath: "runId" }).createIndex("startTime", "startTime", { unique: false });
            const cp = d.createObjectStore("courseProgress", { keyPath: "progressId" });
            cp.createIndex("courseId", "courseId", { unique: false });
            cp.createIndex("status", "status", { unique: false });
        };
        req.onsuccess = e => {
            const tx = e.target.result.transaction(["runs", "courseProgress"], "readwrite");
            [old, unfinished, bare].forEach(r => tx.objectStore("runs").put(r));
            tx.objectStore("courseProgress").put({ progressId: "p", courseId: "c", status: "active" });
            tx.oncomplete = () => { e.target.result.close(); resolve(); };
            tx.onerror = reject;
        };
    });
    await Store.initDB();
    const list = await Store.getAllRuns();
    assert(list.length === 3, "Upgrade: every run survives");
    assert(list.every(r => r.track === undefined && r.raw === undefined && r.pathSegments === undefined), "Upgrade: lists no longer carry the GPS data");
    const back = await Store.getRunById(old.runId);
    assert(back.track.length === 600 && back.raw.length === 600 && back.pathSegments.length === 2, "Upgrade: the whole run still comes back by id");
    assert(back.updatedAt === 12345, "Upgrade: not counted as a change, so nothing re-uploads");
    assert(back.timeSeries.length === old.timeSeries.length && back.hr.max === 190, "Upgrade: the rest of the run is untouched");
    const s = summaryOf(list, old.runId);
    const direct = RunAnalysis.runBestEffort(old, 1000);
    assert(s.derived.dense && s.derived.efforts[1000].timeMs === direct.timeMs, "Upgrade: best efforts kept, from the full track");
    assert(RunAnalysis.runBestEffort(s, 1000).startM === direct.startM, "A summary answers best efforts as the full run would");
    assert(s.derived.routeSig.pts.length === RunAnalysis.routeSignature(old).pts.length, "Upgrade: route signature kept");
    assert(RunAnalysis.groupRoutes([s, Object.assign({}, s, { runId: 9, startTime: s.startTime + 1 })])[0].runs.length === 2, "Summaries group into routes");
    assert(!summaryOf(list, unfinished.runId).derived, "Unfinished runs get no summary until they're finished");
    assert((await Store.getRunById(unfinished.runId)).track.length === 30, "Upgrade: an unfinished run keeps its track for recovery");
    assert((await Store.getRunById(bare.runId)).distance === 2000, "Upgrade: a run with no GPS data is fine");

    // Writes
    await Store.patchRun(old.runId, { rpe: 7, note: "tired" });
    let r = await Store.getRunById(old.runId);
    assert(r.rpe === 7 && r.track.length === 600 && r.updatedAt > 12345, "patchRun: changes the field, keeps the GPS data, counts as a change");
    await Store.patchRun(old.runId, { note: undefined });
    assert(!("note" in await Store.getRunById(old.runId)), "patchRun: undefined removes a field");
    assert(await Store.patchRun(424242, { rpe: 1 }) === null, "patchRun: a run that's gone stays gone");
    await Store.updateRun(summaryOf(await Store.getAllRuns(), old.runId));
    assert((await Store.getRunById(old.runId)).track.length === 600, "updateRun with a summary leaves the GPS data alone");

    await Store.saveLiveRun(unfinished.runId, { distance: 999, track: [[0, 0, 1, 2]], raw: [], pathSegments: [[[1, 2]]] });
    r = await Store.getRunById(unfinished.runId);
    assert(r.distance === 999 && r.track.length === 1 && r.updatedAt === 5, "Autosave: updates the live run without marking it changed");

    const trimmed = RunAnalysis.trimRun(await Store.getRunById(old.runId), 300000);
    await Store.updateRun(trimmed);
    r = await Store.getRunById(old.runId);
    assert(r.track.length === 301 && r.raw.length === 301, "Trimmed run saved");
    const after = summaryOf(await Store.getAllRuns(), old.runId);
    assert(after.distance === 900 && !after.derived.efforts[1000], "A trimmed run's summary drops the efforts it's too short for");

    await Store.deleteRun(old.runId, 777);
    assert(await Store.getRunById(old.runId) === null, "Delete: the run is gone");
    assert(!summaryOf(await Store.getAllRuns(), old.runId), "Delete: gone from lists");
    assert((await Store.getDeletedRuns())[0].updatedAt === 777, "Delete: leaves a record for sync");
    await Store.storeRemoteRun(Object.assign(sampleRun(10, old.runId), { updatedAt: 888 }));
    assert((await Store.getDeletedRuns()).length === 0, "A newer copy from another phone brings a deleted run back");
    await Store.forgetRun(unfinished.runId);
    assert(await Store.getRunById(unfinished.runId) === null && (await Store.getDeletedRuns()).length === 0, "Forgetting a run that never synced leaves no delete record");
}

async function testSync() {
    console.log("\n=== Cloud Sync Tests ===\n");
    const T = Date.UTC(2026, 0, 1);

    // A new phone gets everything back
    let srv = fakeServer();
    const a = await phone(srv);
    await Store.storeRemoteRun(syncedRun(T, 1000));
    await Store.storeRemoteRun(syncedRun(T + 1, 1001, { routeName: "River loop" }));
    let res = await CloudSync.sync();
    assert(res && res.pushed === 2, "First sync sends both runs");
    assert(srv.runs.get(String(T)).data.track.length === 50, "The cloud gets the whole run, GPS data included");
    assert(!("derived" in srv.runs.get(String(T)).data), "The phone's own summary stays on the phone");
    res = await CloudSync.sync();
    assert(res.pushed === 0 && res.pulled === 0, "Nothing changed: nothing sent or fetched");

    const b = await phone(srv);
    res = await CloudSync.sync();
    assert(res.pulled === 2 && res.pushed === 0, "New phone: downloads the runs and doesn't send them back");
    const restored = await Store.getRunById(T);
    assert(restored.track.length === 50 && restored.updatedAt === 1000, "New phone: whole run, with its own stamp");
    assert((await Store.getAllRuns()).every(r => r.derived && r.track === undefined), "New phone: runs are split and summarised");
    assert((await Store.getRunById(T + 1)).routeName === "River loop", "A route's name comes back with its run");

    // Deletes reach the other phone
    await a.use();
    await Store.deleteRun(T, Date.now());
    res = await CloudSync.sync();
    const row = srv.runs.get(String(T));
    assert(row.data.deleted === true && !row.data.track, "Delete: the cloud row loses its GPS data");
    await b.use();
    res = await CloudSync.sync();
    assert(await Store.getRunById(T) === null, "Delete: the other phone drops the run");
    assert(res.pushed === 0, "Delete: the other phone doesn't send it back");
    const c = await phone(srv);
    await CloudSync.sync();
    assert((await Store.getAllRuns()).length === 1, "Delete: a phone signing in later never sees the run");

    // A run deleted here and edited elsewhere: the later change wins
    await a.use();
    await Store.storeRemoteRun(syncedRun(T + 2, Date.now() + 1));
    await new Promise(r => setTimeout(r, 5));
    await CloudSync.sync();
    await b.use();
    await CloudSync.sync();
    await Store.deleteRun(T + 2, Date.now() + 2);
    await new Promise(r => setTimeout(r, 5));
    await a.use();
    await Store.updateRun(Object.assign(await Store.getRunById(T + 2), { note: "keep me" }));
    await new Promise(r => setTimeout(r, 5));
    await CloudSync.sync();
    await b.use();
    await CloudSync.sync();
    assert((await Store.getRunById(T + 2)).note === "keep me", "Deleted on one phone, edited later on another: the edit wins");
    assert((await Store.getDeletedRuns()).every(d => d.runId !== T + 2), "...and the delete record goes");

    // A phone that's behind
    srv = fakeServer();
    const p1 = await phone(srv);
    await Store.storeRemoteRun(syncedRun(T, 1000));
    await CloudSync.sync();
    const p2 = await phone(srv);
    await CloudSync.sync();
    await p1.use();
    await Store.storeRemoteRun(Object.assign(await Store.getRunById(T), { updatedAt: 2000, note: "newer" }));
    await CloudSync.sync();
    await p2.use();
    await Store.storeRemoteRun(Object.assign(await Store.getRunById(T), { updatedAt: 1500, note: "older" }));
    await CloudSync.sync();
    assert(srv.runs.get(String(T)).data.note === "newer", "A phone that's behind doesn't overwrite the newer copy");
    assert((await Store.getRunById(T)).note === "newer", "...and it takes the newer copy");

    // Unsent work survives a pull of something newer
    await p2.use();
    await Store.storeRemoteRun(syncedRun(T + 5, 2500, { note: "unsent" }));
    await p1.use();
    await Store.storeRemoteRun(syncedRun(T + 6, 2600));
    await CloudSync.sync();
    await p2.use();
    res = await CloudSync.sync();
    assert(res.pulled === 1 && srv.runs.get(String(T + 5)).data.note === "unsent", "Unsent changes still go up after pulling something newer");

    // Cut off halfway
    srv = fakeServer();
    const p3 = await phone(srv);
    for (let i = 0; i < 12; i++) await Store.storeRemoteRun(syncedRun(T + i, 1000 + i));
    srv.failAfterPosts = 1;
    res = await CloudSync.sync();
    assert(res === null && srv.runs.size === 5, "Sync cut off: reports failure with the first chunk up");
    assert(/down/.test(JSON.parse(localStorage.getItem("cloudSync")).lastError), "Sync cut off: remembers why");
    srv.failAfterPosts = null;
    srv.posts.length = 0;
    res = await CloudSync.sync();
    assert(res.pushed === 7 && !srv.posts.flat().includes(T) && srv.runs.size === 12, "Next sync carries on from there");

    // A big account: a page of the list can end between rows written together
    const bigSrv = fakeServer();
    for (let i = 0; i < 101; i++) {
        const at = new Date(++bigSrv.clock * 1000).toISOString();
        for (let j = 0; j < 5; j++) {
            const id = `p${i}-${j}`;
            bigSrv.course_progress.set(id, { progress_id: id, data: { progressId: id, updatedAt: 1000 }, client_updated_at: 1000, updated_at: at });
        }
    }
    // Shifted by three, so the page of 500 doesn't end on a chunk's edge
    ["a", "b", "c"].forEach(id => bigSrv.course_progress.set(id, { progress_id: id, data: { progressId: id, updatedAt: 1000 }, client_updated_at: 1000, updated_at: new Date(0).toISOString() }));
    const big = await phone(bigSrv);
    await CloudSync.sync();
    const bigGot = await new Promise(r => { Store.database().transaction(["courseProgress"]).objectStore("courseProgress").count().onsuccess = e => r(e.target.result); });
    assert(bigGot === 508, `Sync: a page ending between rows written together loses none of them (${bigGot} of 508)`);

    // One SQL update in the cloud (docs/SUPABASE_STORAGE.md) gives every row the same updated_at.
    // The limit only has to catch an endless loop; shared CI machines are slow, so it is generous
    const bulkSrv = fakeServer();
    const bulkAt = new Date(5000).toISOString();
    for (let i = 0; i < 600; i++) {
        const id = `q${String(i).padStart(3, "0")}`;
        bulkSrv.course_progress.set(id, { progress_id: id, data: { progressId: id, updatedAt: 1000 }, client_updated_at: 1000, updated_at: bulkAt });
    }
    await phone(bulkSrv);
    const bulkResult = await Promise.race([CloudSync.sync(), new Promise(r => setTimeout(() => r("hung"), 30000))]);
    const bulkGot = await new Promise(r => { Store.database().transaction(["courseProgress"]).objectStore("courseProgress").count().onsuccess = e => r(e.target.result); });
    assert(bulkResult !== "hung" && bulkGot === 600, `Sync: 600 rows sharing one updated_at don't loop forever (${bulkGot} of 600)`);

    // A download that stalls halfway must not hang this sync and every one after it
    const stalled = fakeServer();
    await phone(stalled);
    const realTimeout = global.setTimeout;
    global.setTimeout = (fn, ms, ...rest) => realTimeout(fn, ms >= 60000 ? 5 : ms, ...rest);
    global.fetch = async (url, options) => ({
        ok: true, status: 200,
        text: () => new Promise((_, reject) => options.signal.addEventListener("abort", () => reject(Object.assign(new Error("gone"), { name: "AbortError" })))),
    });
    const stalledResult = await Promise.race([CloudSync.sync(), new Promise(r => realTimeout(() => r("hung"), 1000))]);
    global.setTimeout = realTimeout;
    assert(stalledResult === null && JSON.parse(localStorage.getItem("cloudSync")).lastError === "Timed out", "Sync: a stalled download times out and is reported");

    // Gym sessions and walks travel like runs
    srv = fakeServer();
    await phone(srv);
    await Store.saveRun(Object.assign({ runId: T, startTime: T, endTime: T + 1000, distance: 0, time: 1, pace: 0, timeSeries: [] }, gym(1, 60, 8, [8, 8, 8]), { startTime: T, endTime: T + 1000 }));
    await Store.storeRemoteRun(syncedRun(T + 1, Date.now(), { activity: "walk" }));
    await new Promise(r => setTimeout(r, 5));
    await CloudSync.sync();
    await phone(srv);
    await CloudSync.sync();
    const session = await Store.getRunById(T);
    assert(session.activity === "strength" && session.exercises[0].sets.length === 3, "A gym session reaches the other phone whole");
    assert((await Store.getRunById(T + 1)).activity === "walk", "A walk stays a walk");
    assert((await Store.getLatestRun()) === null, "Neither counts as your last run");

    // Equal stamps either side of a chunk
    srv = fakeServer();
    await phone(srv);
    for (let i = 0; i < 7; i++) await Store.storeRemoteRun(syncedRun(T + i, 5000));
    srv.failAfterPosts = 1;
    await CloudSync.sync();
    srv.failAfterPosts = null;
    await CloudSync.sync();
    assert(srv.runs.size === 7, "Runs with the same stamp aren't skipped when a sync is cut off between them");

    // Watermark from before this version
    srv = fakeServer();
    await phone(srv);
    localStorage.setItem("cloudSync", JSON.stringify(Object.assign(JSON.parse(localStorage.getItem("cloudSync")), { lastPush: 5000 })));
    await Store.storeRemoteRun(syncedRun(T, 4000));
    await Store.storeRemoteRun(syncedRun(T + 1, 6000));
    res = await CloudSync.sync();
    assert(res.pushed === 1 && srv.runs.has(String(T + 1)), "Upgrading: picks up from the old watermark, no full re-upload");

    // Course records still sync
    srv = fakeServer();
    await phone(srv);
    await new Promise(r => { const t = db.transaction(["courseProgress"], "readwrite"); t.objectStore("courseProgress").put({ progressId: "c-beginner-1", courseId: "c", status: "active", updatedAt: 10 }); t.oncomplete = r; });
    await CloudSync.sync();
    await phone(srv);
    await CloudSync.sync();
    const cps = await new Promise(r => { const q = db.transaction(["courseProgress"]).objectStore("courseProgress").getAll(); q.onsuccess = () => r(q.result); });
    assert(cps.length === 1 && cps[0].progressId === "c-beginner-1", "Course progress reaches the new phone");

    // Backup file, written in pieces on Android
    srv = fakeServer();
    await phone(srv);
    await Store.storeRemoteRun(syncedRun(T, 100));
    await Store.storeRemoteRun(syncedRun(T + 1, 101, { note: 'quotes " and \\ survive' }));
    await Store.deleteRun(T + 2, 500);
    const pieces = [];
    let cancelled = 0;
    global.NativeTracker = {
        available: true,
        fileStart: async () => {}, fileAppend: async t => { pieces.push(t); },
        fileFinish: async () => "Downloads/x.json", fileCancel: async () => { cancelled++; },
    };
    const msg = await CloudSync.exportJson();
    const file = JSON.parse(pieces.join(""));
    assert(msg === "Saved 2 runs to Downloads/x.json", "Export: reports where it went");
    assert(file.app === "run-tracker" && file.runs.length === 2 && file.runs[0].track.length === 50, "Export: valid JSON with whole runs");
    assert(file.runs.every(r => !("derived" in r)), "Export: the phone's own summary stays out");
    await phone(srv);
    assert(/Imported 2 runs/.test(await CloudSync.importJson(pieces.join(""))), "Import: reads the file back");
    assert((await Store.getRunById(T + 1)).note === 'quotes " and \\ survive' && (await Store.getRunById(T)).track.length === 50, "Import: runs come back whole");
    await Store.deleteRun(T, Date.now());
    assert(/Imported 0 runs/.test(await CloudSync.importJson(pieces.join(""))), "Import: an old backup doesn't bring back a run you deleted");

    pieces.length = 0;
    global.NativeTracker.fileAppend = async () => { throw new Error("disk full"); };
    let failedMsg = "";
    await CloudSync.exportJson().catch(e => { failedMsg = e.message; });
    assert(failedMsg === "disk full" && cancelled === 1, "Export: a failed write is cancelled and reported");
    global.NativeTracker = { available: false };
}

const storeTests = weatherTest.then(testStorage).then(testSync);

// ─── Summary ─────────────────────────────────────────────────────────────────

storeTests.catch(err => assert(false, `Async tests threw: ${err && err.stack || err}`)).then(() => {
    console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
    process.exit(failed > 0 ? 1 : 0);
});
