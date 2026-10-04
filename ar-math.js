// ar-math.js — Geometry for the AR ghost view (ar-ghost.js). No DOM, so tests.js
// can load it in Node.
//
// Frames:
//   world  — local east/north/up in metres (x = east, y = north, z = up)
//   device — x = right edge, y = top edge, z = out of the screen. The rear
//            camera looks along -z.
// Orientation is a unit quaternion [x, y, z, w] rotating device vectors into
// the world frame (Android's rotation vector, or W3C alpha/beta/gamma).

const ArMath = (() => {
    const DEG = Math.PI / 180;
    const EARTH_R = 6371000;
    // Long-side field of view of a typical phone main camera, used when the
    // real optics are unknown (browser). ~26 mm equivalent on a 4:3 sensor.
    const DEFAULT_LONG_FOV_DEG = 66;

    // ─── Positions ───────────────────────────────────────────────────────────

    // East/north offset in metres of b from a ([lat, lng] pairs). Equirectangular,
    // well under 0.1% error over the few hundred metres the AR view deals with.
    function enu(a, b) {
        return [
            (b[1] - a[1]) * DEG * EARTH_R * Math.cos(a[0] * DEG),
            (b[0] - a[0]) * DEG * EARTH_R,
        ];
    }

    function lastTrailPoint(segments) {
        for (let s = segments.length - 1; s >= 0; s--) {
            if (segments[s].length) return segments[s][segments[s].length - 1];
        }
        return null;
    }

    // The point `back` metres behind the end of the trail, walking along it
    // (segments in order, joined by straight lines across gaps). Clamps to the
    // start of the trail. Null for an empty trail.
    function trailPointBack(segments, back) {
        let next = null;
        let remaining = Math.max(0, back);
        for (let s = segments.length - 1; s >= 0; s--) {
            const seg = segments[s];
            for (let i = seg.length - 1; i >= 0; i--) {
                const p = seg[i];
                if (next) {
                    const v = enu(next, p);
                    const d = Math.hypot(v[0], v[1]);
                    if (d > 0 && d >= remaining) {
                        const t = remaining / d;
                        return [next[0] + (p[0] - next[0]) * t, next[1] + (p[1] - next[1]) * t];
                    }
                    remaining -= d;
                }
                next = p;
            }
        }
        return next;
    }

    // Direction of travel (radians clockwise from north) over the last `span`
    // metres of the trail, or null until the runner has moved far enough.
    function trailHeading(segments, span = 15, minSpan = 8) {
        const last = lastTrailPoint(segments);
        const from = trailPointBack(segments, span);
        if (!last || !from) return null;
        const v = enu(from, last);
        if (Math.hypot(v[0], v[1]) < minSpan) return null;
        return Math.atan2(v[0], v[1]);
    }

    // Where the ghost's recorded run was at `distance` metres, interpolated
    // between time-series points that carry coordinates. Null when the ghost
    // has no coordinates (simulated ghosts) or the distance is off its route.
    function ghostRoutePointAt(timeSeries, distance) {
        if (!timeSeries) return null;
        let prev = null;
        for (const p of timeSeries) {
            if (p.lat == null || p.lng == null) continue;
            if (p.distance >= distance) {
                if (!prev) return p.distance - distance < 30 ? [p.lat, p.lng] : null;
                const span = p.distance - prev.distance;
                const t = span > 0 ? (distance - prev.distance) / span : 0;
                return [prev.lat + (p.lat - prev.lat) * t, prev.lng + (p.lng - prev.lng) * t];
            }
            prev = p;
        }
        return null;
    }

    // ─── Orientation ─────────────────────────────────────────────────────────

    function quatMul(a, b) {
        return [
            a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
            a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
            a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
            a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
        ];
    }

    // W3C DeviceOrientationEvent angles (degrees, intrinsic Z-X'-Y'') to a quaternion.
    function quatFromEuler(alpha, beta, gamma) {
        const a = alpha * DEG / 2, b = beta * DEG / 2, g = gamma * DEG / 2;
        const qz = [0, 0, Math.sin(a), Math.cos(a)];
        const qx = [Math.sin(b), 0, 0, Math.cos(b)];
        const qy = [0, Math.sin(g), 0, Math.cos(g)];
        return quatMul(quatMul(qz, qx), qy);
    }

    // Normalised lerp from a towards b by t (0..1), taking the short way round.
    function quatNlerp(a, b, t) {
        const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
        const s = dot < 0 ? -1 : 1;
        const q = [0, 1, 2, 3].map(i => a[i] + (s * b[i] - a[i]) * t);
        const n = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
        return q.map(v => v / n);
    }

    // Rotation matrix (rows) for quaternion q; same layout as Android's
    // SensorManager.getRotationMatrixFromVector.
    function quatToMatrix(q) {
        const [x, y, z, w] = q;
        return [
            [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
            [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
            [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
        ];
    }

    // Compass heading (radians clockwise from north, in the sensor's world
    // frame) of where the rear camera points. When the phone is held near flat
    // the camera points at the ground, so use the direction of the phone's top
    // edge instead, like a map compass.
    function cameraHeading(R) {
        const fe = -R[0][2], fn = -R[1][2];
        if (Math.hypot(fe, fn) > 0.35) return Math.atan2(fe, fn);
        return Math.atan2(R[0][1], R[1][1]);
    }

    // ─── Projection ──────────────────────────────────────────────────────────

    // Projects world vector v (metres from the camera, in the sensor's world
    // frame) onto the screen. `screenAngle` is screen.orientation.angle in
    // degrees, `focal` the focal length in CSS pixels, W/H the view size.
    // Returns screen x/y (valid only when depth > 0) and the vector in screen
    // axes (sx right, sy up, depth forward) for off-screen arrows.
    function project(R, v, screenAngle, focal, W, H) {
        const dx = R[0][0] * v[0] + R[1][0] * v[1] + R[2][0] * v[2];
        const dy = R[0][1] * v[0] + R[1][1] * v[1] + R[2][1] * v[2];
        const dz = R[0][2] * v[0] + R[1][2] * v[1] + R[2][2] * v[2];
        const t = screenAngle * DEG;
        const c = Math.cos(t), s = Math.sin(t);
        const sx = c * dx - s * dy;
        const sy = s * dx + c * dy;
        const depth = -dz;
        const k = depth > 1e-6 ? focal / depth : 0;
        return { x: W / 2 + sx * k, y: H / 2 - sy * k, sx, sy, depth };
    }

    // Rotates a true-north world vector into the sensor's world frame, given
    // the sensor's heading error (`offset` radians: magnetic declination plus
    // any manual alignment; true heading = sensor heading + offset).
    function trueToSensor(v, offset) {
        const c = Math.cos(offset), s = Math.sin(offset);
        return [c * v[0] - s * v[1], s * v[0] + c * v[1], v[2]];
    }

    // ─── Camera optics ───────────────────────────────────────────────────────

    // Focal length in video pixels. `cam` = { focalMm, sensorW, sensorH } (active
    // sensor area in mm) when the native app knows the optics. The stream is the
    // largest crop of the sensor with the stream's aspect ratio, scaled to the
    // stream size.
    function streamFocalPx(videoW, videoH, cam) {
        const L = Math.max(videoW, videoH), S = Math.min(videoW, videoH);
        if (cam && cam.focalMm > 0 && cam.sensorW > 0 && cam.sensorH > 0) {
            const sL = Math.max(cam.sensorW, cam.sensorH), sS = Math.min(cam.sensorW, cam.sensorH);
            return cam.focalMm * Math.max(L / sL, S / sS);
        }
        return (L / 2) / Math.tan(DEFAULT_LONG_FOV_DEG * DEG / 2);
    }

    // Focal length in CSS pixels once the video fills a W x H box (object-fit: cover).
    function displayFocal(streamFocal, videoW, videoH, W, H) {
        return streamFocal * Math.max(W / videoW, H / videoH);
    }

    function fovDeg(focal, size) {
        return 2 * Math.atan(size / 2 / focal) / DEG;
    }

    // Where a ray from screen point (cx, cy) in direction (dx right, dy down)
    // leaves the box { left, top, right, bottom }; (cx, cy) must be inside it.
    function edgePoint(dx, dy, cx, cy, box) {
        const kx = dx > 0 ? (box.right - cx) / dx : dx < 0 ? (box.left - cx) / dx : Infinity;
        const ky = dy > 0 ? (box.bottom - cy) / dy : dy < 0 ? (box.top - cy) / dy : Infinity;
        const k = Math.min(kx, ky);
        return { x: cx + dx * k, y: cy + dy * k };
    }

    function wrapAngle(a) {
        while (a > Math.PI) a -= 2 * Math.PI;
        while (a < -Math.PI) a += 2 * Math.PI;
        return a;
    }

    return {
        DEG, enu, lastTrailPoint, trailPointBack, trailHeading, ghostRoutePointAt,
        quatMul, quatFromEuler, quatNlerp, quatToMatrix, cameraHeading,
        project, trueToSensor, streamFocalPx, displayFocal, fovDeg, edgePoint, wrapAngle,
    };
})();

if (typeof module !== "undefined") module.exports = ArMath;
