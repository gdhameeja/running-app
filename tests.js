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

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
