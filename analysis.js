// analysis.js — Pure run analysis shared by the ghost race, run detail page and
// guided-run report. No DOM or IndexedDB, so tests.js loads it in Node.
//
// A "series" is a list of { time, distance, lat?, lng? } sorted by time, where
// time is moving time in ms since the start. Runs recorded since the per-fix
// track was added give a dense series (one point per GPS fix); older runs only
// have the 100 m `timeSeries`.

const RunAnalysis = (() => {
    const DEG = Math.PI / 180;
    const EARTH_R = 6371000;

    // ─── Series ──────────────────────────────────────────────────────────────

    // Fixes are only recorded once you've moved ~3 m, so a stop is a long wait
    // between two fixes. Without help, interpolation would have the ghost creep
    // through it; instead it stands at the stop and moves on in the last second.
    function seriesFromTrack(track) {
        if (!track || track.length < 2) return null;
        const out = [];
        for (let i = 0; i < track.length; i++) {
            const p = track[i];
            if (i > 0) {
                const q = track[i - 1];
                if (p[0] - q[0] > 3000 && p[1] - q[1] < 20) {
                    out.push({ time: p[0] - 1000, distance: q[1], lat: q[2], lng: q[3] });
                }
            }
            out.push({ time: p[0], distance: p[1], lat: p[2], lng: p[3] });
        }
        return out;
    }

    // The best series a run has, or null if it has no timing data at all.
    function seriesForRun(run) {
        if (!run) return null;
        const dense = seriesFromTrack(run.track);
        if (dense) return dense;
        return run.timeSeries && run.timeSeries.length ? run.timeSeries : null;
    }

    // A ghost that runs `targetM` metres in `timeMs` at a perfectly even pace.
    function evenPaceSeries(targetM, timeMs) {
        const out = [];
        for (let d = 0; d < targetM; d += 100) out.push({ distance: d, time: timeMs * d / targetM });
        out.push({ distance: targetM, time: timeMs });
        return out;
    }

    // First index whose `key` is >= value (binary search), or ts.length.
    function lowerBound(ts, key, value) {
        let lo = 0, hi = ts.length;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (ts[mid][key] < value) lo = mid + 1; else hi = mid;
        }
        return lo;
    }

    // Same semantics as getGhostDistanceAtTime in performance.js.
    function distanceAtTime(ts, t) {
        if (!ts || ts.length === 0) return 0;
        const i = lowerBound(ts, "time", t);
        if (i >= ts.length) return ts[ts.length - 1].distance;
        if (i === 0) return ts[0].distance > 0 && ts[0].time > 0 ? Math.max(0, t / ts[0].time) * ts[0].distance : 0;
        const a = ts[i - 1], b = ts[i];
        return a.distance + (t - a.time) / (b.time - a.time) * (b.distance - a.distance);
    }

    // Same semantics as getGhostTimeAtDistance in performance.js.
    function timeAtDistance(ts, d) {
        if (!ts || ts.length === 0) return null;
        const i = lowerBound(ts, "distance", d);
        if (i >= ts.length) return null;
        if (i === 0) return ts[0].distance > 0 ? d / ts[0].distance * ts[0].time : ts[0].time;
        const a = ts[i - 1], b = ts[i];
        return a.time + (d - a.distance) / (b.distance - a.distance) * (b.time - a.time);
    }

    // Position at a distance along a series that has coordinates.
    function pointAtDistance(ts, d) {
        if (!ts || ts.length === 0) return null;
        let i = lowerBound(ts, "distance", d);
        if (i >= ts.length) i = ts.length - 1;
        let j = ts[i].distance > d ? i - 1 : i;
        while (j >= 0 && ts[j].lat == null) j--;
        let k = i;
        while (k < ts.length && ts[k].lat == null) k++;
        if (j < 0 && k >= ts.length) return null;
        if (j < 0) return [ts[k].lat, ts[k].lng];
        if (k >= ts.length || ts[k].distance === ts[j].distance) return [ts[j].lat, ts[j].lng];
        const f = Math.min(Math.max((d - ts[j].distance) / (ts[k].distance - ts[j].distance), 0), 1);
        return [ts[j].lat + (ts[k].lat - ts[j].lat) * f, ts[j].lng + (ts[k].lng - ts[j].lng) * f];
    }

    // Light copy of a dense series: a point every `step` metres, with coordinates.
    function sparseSeries(ts, step = 100) {
        if (!ts || ts.length === 0) return [];
        const end = ts[ts.length - 1].distance;
        const out = [];
        for (let d = step; d < end; d += step) {
            const p = pointAtDistance(ts, d);
            const pt = { distance: d, time: Math.round(timeAtDistance(ts, d)) };
            if (p) { pt.lat = p[0]; pt.lng = p[1]; }
            out.push(pt);
        }
        const last = ts[ts.length - 1];
        out.push({ distance: last.distance, time: last.time, lat: last.lat, lng: last.lng });
        return out;
    }

    // ─── Splits, stops and pace colouring ────────────────────────────────────

    // Time for each full kilometre, plus the final partial one.
    function kmSplits(ts, totalDistance, totalTimeMs) {
        if (!ts || totalDistance < 100) return [];
        const out = [];
        let prevT = 0;
        const fullKm = Math.floor(totalDistance / 1000);
        for (let k = 1; k <= fullKm; k++) {
            const t = timeAtDistance(ts, k * 1000);
            if (t == null) break;
            out.push({ km: k, distance: 1000, timeMs: t - prevT, paceSec: (t - prevT) / 1000 });
            prevT = t;
        }
        const rest = totalDistance - out.length * 1000;
        if (rest >= 50 && totalTimeMs > prevT) {
            out.push({ km: out.length + rest / 1000, distance: rest, timeMs: totalTimeMs - prevT,
                paceSec: (totalTimeMs - prevT) / 1000 / (rest / 1000), partial: true });
        }
        return out;
    }

    // Times you stood still. The trackers only record a fix once you've moved
    // ~3 m, so a stop shows up as a long wait between fixes with little distance.
    // A long wait with a lot of distance is a GPS gap (screen off) instead.
    function findStops(track, minMs = 10000, maxMoveM = 20) {
        const stops = [];
        if (!track) return stops;
        for (let i = 1; i < track.length; i++) {
            const dt = track[i][0] - track[i - 1][0];
            const dd = track[i][1] - track[i - 1][1];
            if (dt >= minMs && dd < maxMoveM) {
                stops.push({ timeMs: track[i - 1][0], distance: track[i - 1][1], durationMs: dt,
                    lat: track[i - 1][2], lng: track[i - 1][3] });
            }
        }
        return stops;
    }

    // The track as short pieces with a pace each, smoothed over a few fixes.
    // Pieces across a stop or GPS gap get pace null and a `kind`.
    function paceSegments(track, half = 3) {
        const out = [];
        if (!track || track.length < 2) return out;
        for (let i = 1; i < track.length; i++) {
            const a = track[i - 1], b = track[i];
            const from = [a[2], a[3]], to = [b[2], b[3]];
            const dt = b[0] - a[0], dd = b[1] - a[1];
            if (dt > 10000) { out.push({ from, to, paceSec: null, kind: dd < 20 ? "stop" : "gap" }); continue; }
            // Smooth over neighbouring fixes, but not across a stop or gap
            let lo = i - 1, hi = i;
            while (lo > 0 && i - 1 - lo < half && track[lo][0] - track[lo - 1][0] <= 10000) lo--;
            while (hi < track.length - 1 && hi - i < half && track[hi + 1][0] - track[hi][0] <= 10000) hi++;
            const sdt = (track[hi][0] - track[lo][0]) / 1000, sdd = track[hi][1] - track[lo][1];
            out.push({ from, to, paceSec: sdd > 1 ? sdt / (sdd / 1000) : null, kind: "run" });
        }
        return out;
    }

    function quantile(sorted, q) {
        if (!sorted.length) return null;
        const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
        return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
    }

    // ─── Routes ──────────────────────────────────────────────────────────────

    function enu(a, b) {
        return [(b[1] - a[1]) * DEG * EARTH_R * Math.cos(a[0] * DEG), (b[0] - a[0]) * DEG * EARTH_R];
    }

    function metres(a, b) {
        const v = enu(a, b);
        return Math.hypot(v[0], v[1]);
    }

    // Distance from p to segment a-b, in metres.
    function toSegment(p, a, b) {
        const ab = enu(a, b), ap = enu(a, p);
        const len2 = ab[0] * ab[0] + ab[1] * ab[1];
        const t = len2 > 0 ? Math.min(Math.max((ap[0] * ab[0] + ap[1] * ab[1]) / len2, 0), 1) : 0;
        return Math.hypot(ap[0] - ab[0] * t, ap[1] - ab[1] * t);
    }

    function geometryOf(run) {
        if (run.track && run.track.length > 1) return run.track.map(p => [p[2], p[3]]);
        if (run.pathSegments && run.pathSegments.length) {
            const pts = [].concat(...run.pathSegments).filter(p => p && p.length === 2);
            if (pts.length > 1) return pts;
        }
        const ts = (run.timeSeries || []).filter(p => p.lat != null);
        return ts.length > 1 ? ts.map(p => [p.lat, p.lng]) : null;
    }

    const SIG_STEP_M = 50;

    // The route resampled every 50 m, for comparing runs.
    function routeSignature(run) {
        const g = geometryOf(run);
        if (!g) return null;
        const pts = [g[0]];
        let carried = 0;
        for (let i = 1; i < g.length; i++) {
            const seg = metres(g[i - 1], g[i]);
            let along = SIG_STEP_M - carried;
            while (along <= seg) {
                const f = along / seg;
                pts.push([g[i - 1][0] + (g[i][0] - g[i - 1][0]) * f, g[i - 1][1] + (g[i][1] - g[i - 1][1]) * f]);
                along += SIG_STEP_M;
            }
            carried = seg - (along - SIG_STEP_M);
        }
        const last = g[g.length - 1];
        if (metres(pts[pts.length - 1], last) > 5) pts.push(last);
        const length = (pts.length - 1) * SIG_STEP_M;
        if (length < 400) return null;
        return { pts, length, start: g[0], end: last, loop: metres(g[0], last) < 150 };
    }

    // Share of a's samples lying within `tol` m of b's route, near the same
    // fraction of the way along (so direction and order matter).
    function coverage(a, b, tol = 40) {
        const na = a.pts.length, nb = b.pts.length;
        const w = Math.max(10, Math.round(nb * 0.2));
        let hits = 0;
        for (let i = 0; i < na; i++) {
            const je = Math.round(i * (nb - 1) / Math.max(1, na - 1));
            let best = Infinity;
            for (let j = Math.max(0, je - w); j < Math.min(nb - 1, je + w); j++) {
                best = Math.min(best, toSegment(a.pts[i], b.pts[j], b.pts[j + 1]));
                if (best <= tol) break;
            }
            if (best <= tol) hits++;
        }
        return hits / na;
    }

    function sameRoute(a, b) {
        if (!a || !b) return false;
        if (Math.abs(a.length - b.length) / Math.max(a.length, b.length) > 0.12) return false;
        if (metres(a.start, b.start) > 150 || metres(a.end, b.end) > 150) return false;
        return coverage(a, b) >= 0.85 && coverage(b, a) >= 0.85;
    }

    // Groups finished runs by route (oldest run first in each group). Pass a Map
    // to reuse signatures between calls.
    function groupRoutes(runs, cache) {
        const groups = [];
        const sorted = runs.filter(r => r.endTime && r.distance >= 500).sort((a, b) => a.startTime - b.startTime);
        for (const run of sorted) {
            let sig = cache && cache.get(run.runId);
            if (sig === undefined) {
                sig = routeSignature(run);
                if (cache) cache.set(run.runId, sig);
            }
            if (!sig) continue;
            const g = groups.find(gr => sameRoute(gr.sig, sig));
            if (g) g.runs.push(run); else groups.push({ id: run.runId, sig, runs: [run] });
        }
        return groups;
    }

    // Ranks a route's runs by time over the shortest of them, so GPS
    // differences in total distance don't decide it.
    function rankRoute(group) {
        const distance = Math.floor(Math.min(...group.runs.map(r => r.distance)) / 10) * 10;
        const entries = group.runs.map(run => {
            const t = timeAtDistance(seriesForRun(run), distance);
            return { run, timeMs: t != null ? t : run.time * 1000 * distance / run.distance };
        }).sort((a, b) => a.timeMs - b.timeMs);
        return { distance, entries };
    }

    // ─── Spoken ghost updates ────────────────────────────────────────────────

    const CUE_EVERY_M = 250;
    const CUE_MIN_INTERVAL_MS = 30000;
    const LEAD_HYSTERESIS_M = 5;

    function spokenMetres(m) {
        m = Math.abs(m);
        if (m >= 1000) {
            const km = Math.round(m / 100) / 10;
            return `${km} kilometre${km === 1 ? "" : "s"}`;
        }
        const r = m < 100 ? Math.round(m / 5) * 5 : Math.round(m / 10) * 10;
        return `${Math.max(r, 5)} metres`;
    }

    // What to say about the ghost after this fix, or null. `state` starts as {}
    // and is updated in place. Mirrors RunEngine.ghostCue on Android.
    function ghostCue(state, { yourDist, ghostDist, targetM, now }) {
        if (yourDist >= targetM) return null;
        if (state.lastCueDist == null) {
            state.lastCueDist = 0; state.lastGap = 0; state.lastAt = now; state.leader = null;
        }
        if (ghostDist >= targetM) {
            if (state.ghostDone) return null;
            state.ghostDone = true;
            state.lastAt = now;
            return `Your ghost has finished. ${spokenMetres(targetM - yourDist)} to go.`;
        }
        const gap = yourDist - ghostDist; // > 0: you're ahead
        const leader = gap > LEAD_HYSTERESIS_M ? "you" : gap < -LEAD_HYSTERESIS_M ? "ghost" : state.leader;
        const changed = state.leader && leader !== state.leader && yourDist > 50;
        state.leader = leader;
        if (changed) {
            state.lastCueDist = yourDist; state.lastGap = gap; state.lastAt = now;
            return leader === "you" ? "You've overtaken your ghost!" : "Your ghost has overtaken you.";
        }
        if (yourDist - state.lastCueDist < CUE_EVERY_M || now - state.lastAt < CUE_MIN_INTERVAL_MS) return null;
        // The kilometre announcement already compares you with the ghost
        const intoKm = yourDist % 1000;
        if (intoKm < 60 || intoKm > 940) return null;

        let msg;
        if (Math.abs(gap) < LEAD_HYSTERESIS_M) {
            msg = "Level with your ghost.";
        } else {
            const change = Math.abs(gap) - Math.abs(state.lastGap);
            const sameSide = Math.sign(gap) === Math.sign(state.lastGap);
            msg = gap > 0 ? `Ghost ${spokenMetres(gap)} behind` : `Ghost ${spokenMetres(gap)} ahead`;
            if (sameSide && change >= 5) msg += gap > 0 ? ", you're pulling away." : ", and pulling away.";
            else if (sameSide && change <= -5) msg += gap > 0 ? ", and closing." : ", you're closing in.";
            else msg += ".";
        }
        state.lastCueDist = yourDist; state.lastGap = gap; state.lastAt = now;
        return msg;
    }

    // ─── Fitness and the guided-run report ───────────────────────────────────

    // Predicted 5K pace (s/km) from your recent runs, via Riegel's formula.
    function fiveKPace(runs, beforeTime, windowDays = 120) {
        const done = runs.filter(r => r.endTime && r.startTime < beforeTime && r.distance >= 1500 && r.time > 0);
        const recent = done.filter(r => r.startTime > beforeTime - windowDays * 86400000);
        const pool = recent.length ? recent : done;
        if (!pool.length) return null;
        const best = Math.min(...pool.map(r => r.time * Math.pow(5000 / r.distance, 1.06)));
        return best / 5;
    }

    // What a segment asks for, as a pace range in multiples of 5K pace.
    function segmentTarget(seg) {
        const t = (seg.intensity || "").toLowerCase();
        if (seg.type === "rest") return { kind: "rest", label: "Rest" };
        if (seg.type === "walk") return { kind: "walk", label: "Brisk walk", absolute: [450, 780] };
        if (seg.type === "sprint" || t.includes("all-out")) return { kind: "sprint", label: "Faster than 5K pace", range: [0, 0.97] };
        if (t.includes("fartlek") || t.includes("by feel")) return { kind: "feel", label: "By feel" };
        if (t.includes("marathon")) return { kind: "marathon", label: "Marathon pace", range: [1.1, 1.24] };
        if (t.includes("5k") || t.includes("vo2max")) return { kind: "5k", label: "5K pace", range: [0.96, 1.05] };
        if (/9\d%|85|\bhard\b|max effort/.test(t) && !t.includes("comfortably")) {
            // Short reps at 90% effort are run around 1500 m-3K pace; longer ones near 5K-10K pace
            return seg.duration <= 2
                ? { kind: "hard", label: "Hard", range: [0.85, 1.0] }
                : { kind: "hard", label: "Hard", range: [0.95, 1.08] };
        }
        if (t.includes("comfortably hard") || t.includes("tempo")) return { kind: "tempo", label: "Tempo", range: [1.03, 1.16] };
        if (seg.type === "jog" || seg.type === "warmup" || seg.type === "cooldown") return { kind: "easy", label: "Easy jog", range: [1.2, 1.7] };
        if (t.includes("zone 2") || t.includes("conversational") || t.includes("easy")) return { kind: "easy", label: "Easy", range: [1.18, 1.5] };
        return { kind: "unknown", label: seg.intensity || "" };
    }

    // How each segment of a guided session went. `guided.segments` as in
    // courses.js (duration in minutes); the trackers count down 5 s first.
    function guidedReport(run, guided, p5) {
        const ts = seriesForRun(run);
        if (!ts || !guided || !guided.segments) return null;
        const total = run.time * 1000;
        let t = 5000;
        const rows = guided.segments.map((seg, i) => {
            const start = t, end = t + seg.duration * 60000;
            t = end;
            const target = segmentTarget(seg);
            const row = { index: i, seg, target, startMs: start, durationMs: end - start };
            if (start >= total - 1000) { row.status = "skipped"; return row; }
            const stop = Math.min(end, total);
            row.partial = stop < end;
            row.distance = distanceAtTime(ts, stop) - distanceAtTime(ts, start);
            row.paceSec = row.distance > 10 ? (stop - start) / 1000 / (row.distance / 1000) : null;
            row.shortForGps = end - start < 30000;
            let lo = null, hi = null;
            if (target.absolute) [lo, hi] = target.absolute;
            else if (target.range && p5) [lo, hi] = [target.range[0] * p5, target.range[1] * p5];
            row.lo = lo; row.hi = hi;
            if (target.kind === "rest") row.status = row.distance < 30 ? "ok" : "moved";
            else if (row.paceSec == null) row.status = "stood";
            else if (lo == null) row.status = "info";
            else row.status = row.paceSec < lo ? "fast" : row.paceSec > hi ? "slow" : "ok";
            return row;
        });

        const judged = rows.filter(r => ["ok", "fast", "slow", "moved", "stood"].includes(r.status));
        const onTarget = judged.filter(r => r.status === "ok").length;
        // Repeated hard reps: did you fade?
        const reps = rows.filter(r => ["sprint", "hard", "5k"].includes(r.target.kind) && r.paceSec && !r.partial);
        let fade = null;
        if (reps.length >= 3) {
            const k = Math.max(1, Math.floor(reps.length / 3));
            const avg = (xs) => xs.reduce((s, r) => s + r.paceSec, 0) / xs.length;
            fade = avg(reps.slice(-k)) - avg(reps.slice(0, k));
        }
        return { rows, onTarget, judged: judged.length, fade, p5 };
    }

    // ─── Formatting / parsing ────────────────────────────────────────────────

    // "24:59" or "1:05:00" to ms; null if it doesn't parse.
    function parseDuration(text) {
        const m = /^\s*(?:(\d+):)?(\d{1,3}):(\d{2})\s*$/.exec(text || "");
        if (!m) return null;
        const h = +(m[1] || 0), min = +m[2], s = +m[3];
        if (s >= 60 || (m[1] && min >= 60)) return null;
        return ((h * 60 + min) * 60 + s) * 1000;
    }

    function formatDistance(m) {
        if (m % 1000 === 0) return `${m / 1000}K`;
        if (Math.abs(m - 21097.5) < 1) return "Half marathon";
        if (Math.abs(m - 42195) < 1) return "Marathon";
        return `${(m / 1000).toFixed(2)} km`;
    }

    return {
        seriesFromTrack, seriesForRun, evenPaceSeries, distanceAtTime, timeAtDistance, pointAtDistance,
        sparseSeries, kmSplits, findStops, paceSegments, quantile, metres,
        routeSignature, coverage, sameRoute, groupRoutes, rankRoute,
        ghostCue, spokenMetres, CUE_EVERY_M,
        fiveKPace, segmentTarget, guidedReport, parseDuration, formatDistance,
    };
})();

if (typeof module !== "undefined") module.exports = RunAnalysis;
