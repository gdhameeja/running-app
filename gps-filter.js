// gps-filter.js — Smooths raw GPS fixes before they are turned into distance.
//
// A constant-velocity Kalman filter in local metres (east/north), one
// independent [position, velocity] filter per axis. Each fix updates it with
//   - the position, weighted by the accuracy the receiver reports, and
//   - the receiver's Doppler speed and bearing, when it reports them. Doppler
//     velocity is far less noisy than the speed implied by successive
//     positions, so it is what lets the filter tell running from jitter.
// Summing distances between raw fixes overstates distance, because every
// metre of jitter adds length (Ranacher et al. 2016, "Why GPS makes
// distances bigger than they are"); on synthetic runs this filter cuts that
// error from ~2-8% to ~1%. RunEngine.kt has the same filter (GpsFilter).

class GpsFilter {
    // How hard a runner can change velocity (m/s²): enough for corners and
    // interval starts, small enough to treat sideways jitter as noise.
    static ACCEL_SIGMA = 1.0;
    // Doppler velocity noise per axis (m/s).
    static VELOCITY_SIGMA = 0.5;
    // Below this, the receiver's bearing means nothing but the speed still
    // says "standing still".
    static STILL_MPS = 0.5;
    // Fixes this far outside the prediction (squared Mahalanobis distance;
    // 2 degrees of freedom, p < 0.001) are ignored as glitches...
    static GATE = 16;
    // ...unless this many come in a row, which means the filter is the one
    // that's wrong.
    static MAX_REJECTS = 3;

    constructor() {
        this.origin = null;
    }

    // Returns { lat, lng, speed } (speed in m/s), or null if the fix was
    // rejected as a glitch. `timeMs` is wall-clock time of the fix.
    update(lat, lng, accuracy, timeMs, speed = null, bearing = null) {
        const DEG = Math.PI / 180, M_PER_DEG = 6371000 * DEG;
        if (!this.origin) return this.reset(lat, lng, accuracy, timeMs, speed, bearing);

        const o = this.origin;
        const z = [(lng - o.lng) * M_PER_DEG * o.cosLat, (lat - o.lat) * M_PER_DEG];
        const vz = GpsFilter.velocity(speed, bearing);
        const dt = Math.max(0, (timeMs - this.time) / 1000);
        const q = GpsFilter.ACCEL_SIGMA ** 2;
        const rp = accuracy * accuracy;
        const rv = GpsFilter.VELOCITY_SIGMA ** 2;

        // Predict: x += v·dt, plus white-acceleration process noise
        const x = this.x.map(([p, v]) => [p + v * dt, v]);
        const P = this.P.map(([a, b, c, d]) => [
            a + dt * (b + c) + dt * dt * d + q * dt ** 3 / 3,
            b + dt * d + q * dt * dt / 2,
            c + dt * d + q * dt * dt / 2,
            d + q * dt,
        ]);

        let nis = 0;
        for (let i = 0; i < 2; i++) nis += (z[i] - x[i][0]) ** 2 / (P[i][0] + rp);
        if (nis > GpsFilter.GATE && ++this.rejects < GpsFilter.MAX_REJECTS) return null;
        if (nis > GpsFilter.GATE) return this.reset(lat, lng, accuracy, timeMs, speed, bearing);
        this.rejects = 0;

        for (let i = 0; i < 2; i++) {
            // Position measurement
            let [a, b, c, d] = P[i];
            let s = a + rp, k0 = a / s, k1 = c / s, y = z[i] - x[i][0];
            x[i] = [x[i][0] + k0 * y, x[i][1] + k1 * y];
            P[i] = [(1 - k0) * a, (1 - k0) * b, c - k1 * a, d - k1 * b];
            // Velocity measurement
            if (vz) {
                [a, b, c, d] = P[i];
                s = d + rv; k0 = b / s; k1 = d / s; y = vz[i] - x[i][1];
                x[i] = [x[i][0] + k0 * y, x[i][1] + k1 * y];
                P[i] = [a - k0 * c, b - k0 * d, (1 - k1) * c, (1 - k1) * d];
            }
        }
        this.x = x;
        this.P = P;
        this.time = timeMs;
        return this.estimate();
    }

    // Starts over at this fix (first fix, after a pause or a GPS gap).
    reset(lat, lng, accuracy, timeMs, speed = null, bearing = null) {
        this.origin = { lat, lng, cosLat: Math.cos(lat * Math.PI / 180) };
        const v = GpsFilter.velocity(speed, bearing) || [0, 0];
        const pv = accuracy * accuracy;
        // Unknown velocity starts with a wide (5 m/s) uncertainty
        const vv = speed == null ? 25 : GpsFilter.VELOCITY_SIGMA ** 2;
        this.x = [[0, v[0]], [0, v[1]]];
        this.P = [[pv, 0, 0, vv], [pv, 0, 0, vv]];
        this.time = timeMs;
        this.rejects = 0;
        return this.estimate();
    }

    estimate() {
        const M_PER_DEG = 6371000 * Math.PI / 180, o = this.origin;
        return {
            lat: o.lat + this.x[1][0] / M_PER_DEG,
            lng: o.lng + this.x[0][0] / (M_PER_DEG * o.cosLat),
            speed: Math.hypot(this.x[0][1], this.x[1][1]),
        };
    }

    // Doppler speed/bearing as [east, north] m/s, or null if unusable.
    static velocity(speed, bearing) {
        if (speed == null || !Number.isFinite(speed)) return null;
        if (bearing == null || !Number.isFinite(bearing)) return speed < GpsFilter.STILL_MPS ? [0, 0] : null;
        const b = bearing * Math.PI / 180;
        return [speed * Math.sin(b), speed * Math.cos(b)];
    }
}

if (typeof module !== "undefined") module.exports = GpsFilter;
