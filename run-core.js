// run-core.js — Small pure helpers for the live run: distance between fixes,
// which fixes to count, and time formatting. No DOM, so tests.js loads the real
// thing. RunEngine.kt has the same rules for the Android service.

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

function findPreviousTime(timeSeries, currentDistance) {
    if (!timeSeries || timeSeries.length === 0) return null;
    for (let i = 0; i < timeSeries.length; i++) {
        if (timeSeries[i].distance >= currentDistance) return timeSeries[i].time;
    }
    return null;
}

function formatTime(seconds) {
    let mins = Math.floor(seconds / 60);
    let secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// 1:05:09 for an hour or more, otherwise 54:27
function formatDuration(seconds) {
    const s = Math.floor(seconds);
    if (s < 3600) return formatTime(s);
    return `${Math.floor(s / 3600)}:${formatTime(s % 3600).padStart(5, "0")}`;
}

if (typeof module !== "undefined") {
    module.exports = { getDistance, classifyFix, findPreviousTime, formatTime, formatDuration, GAP_THRESHOLD_MS, MAX_SPEED_MPS, MAX_ACCURACY_M };
}
