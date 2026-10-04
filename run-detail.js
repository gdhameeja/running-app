// run-detail.js — One run in depth: the route coloured by pace, km splits,
// stops, a replay against the ghost you raced, and (for course sessions) how
// each interval compared with what the session asked for.

const RunDetail = (() => {
    // Fast → slow, five steps
    const PACE_COLORS = ["#c62828", "#ef6c00", "#f9a825", "#7cb342", "#1e88e5"];
    const SPEEDS = [10, 30, 60, 120];

    let el = null, map = null, current = null, replay = null;

    function ensureElement() {
        if (el) return el;
        el = document.createElement("div");
        el.id = "run-detail";
        el.style.display = "none";
        document.body.appendChild(el);
        window.addEventListener("popstate", () => { if (current) close(true); });
        return el;
    }

    function open(runId) {
        ensureElement();
        return Promise.all([getRunById(runId), getAllRuns()]).then(([run, runs]) => {
            if (!run) { alert("That run no longer exists."); return; }
            if (current) close(true);
            current = run;
            try { history.pushState({ runDetail: runId }, ""); } catch (e) { /* not allowed here */ }
            render(run, runs.filter(r => r.endTime));
        });
    }

    function close(fromHistory) {
        if (!current) return;
        stopReplay();
        if (map) { map.remove(); map = null; }
        el.style.display = "none";
        el.innerHTML = "";
        current = null;
        document.body.classList.remove("rd-open");
        if (!fromHistory && history.state && history.state.runDetail) history.back();
    }

    function render(run, runs) {
        const series = RunAnalysis.seriesForRun(run);
        const hasTrack = !!(run.track && run.track.length > 1);
        const stops = hasTrack ? RunAnalysis.findStops(run.track) : [];
        const stoppedMs = stops.reduce((s, x) => s + x.durationMs, 0);
        const splits = RunAnalysis.kmSplits(series, run.distance, run.time * 1000);

        el.innerHTML = `
            <div class="rd-bar">
                <button class="rd-back" aria-label="Back"><span class="material-icons">arrow_back</span></button>
                <div class="rd-title">${new Date(run.startTime).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
            </div>
            <div class="rd-body">
                <div class="rd-stats">
                    <div><span>${(run.distance / 1000).toFixed(2)}</span><small>km</small></div>
                    <div><span>${formatTime(Math.round(run.time))}</span><small>time</small></div>
                    <div><span>${formatPace(run.pace)}</span><small>/km</small></div>
                    ${hasTrack ? `<div><span>${formatTime(Math.round(stoppedMs / 1000))}</span><small>stopped</small></div>` : ""}
                </div>
                <div id="rd-tags"></div>
                <div id="rd-map"></div>
                <div class="rd-legend" id="rd-legend"></div>
                <div class="rd-replay" id="rd-replay" style="display:none;">
                    <button class="rd-play" id="rd-play" aria-label="Play"><span class="material-icons">play_arrow</span></button>
                    <input type="range" id="rd-scrub" min="0" max="1000" value="0">
                    <select id="rd-speed">${SPEEDS.map(s => `<option value="${s}">${s}×</option>`).join("")}</select>
                    <div class="rd-readout" id="rd-readout"></div>
                </div>
                <div id="rd-guided"></div>
                <h3>Splits</h3>
                <div id="rd-splits"></div>
                ${hasTrack ? `<h3>Stops</h3><div id="rd-stops"></div>` : ""}
                ${hasTrack ? "" : `<p class="gr-note">Runs recorded before this version only have 100 m splits: no pace colours, stops or smooth replay.</p>`}
            </div>`;
        el.style.display = "flex";
        document.body.classList.add("rd-open");
        el.querySelector(".rd-back").addEventListener("click", () => close(false));

        renderTags(run, runs);
        renderMap(run, stops);
        renderSplits(splits);
        if (hasTrack) renderStops(stops);
        if (run.guided) renderGuided(run, runs);
        setupReplay(run, series);
    }

    // ─── Header tags: ghost, guided session, route rank ─────────────────────

    function renderTags(run, runs) {
        const tags = document.getElementById("rd-tags");
        const add = (html) => { const d = document.createElement("div"); d.className = "rd-tag"; d.innerHTML = html; tags.appendChild(d); };
        if (run.ghost) {
            buildGhost(run.ghost).then(g => {
                if (current !== run) return;
                const series = RunAnalysis.seriesForRun(run);
                const yourT = RunAnalysis.timeAtDistance(series, g.targetM);
                const ghostT = RunAnalysis.timeAtDistance(g.series, g.targetM);
                let result = "didn't finish";
                if (yourT != null && run.distance >= g.targetM) {
                    const d = Math.round((ghostT - yourT) / 1000);
                    result = d > 0 ? `won by ${formatTime(d)}` : d < 0 ? `lost by ${formatTime(-d)}` : "dead heat";
                }
                add(`👻 Raced <b>${escapeHtml(g.label)}</b>: ${result}`);
            }).catch(() => add(`👻 Raced ${escapeHtml(run.ghost.label || "a ghost")}`));
        }
        if (run.guided) add(`🏃 Course session: <b>${escapeHtml(run.guided.title)}</b>`);
        const r = routeFor(findRoutes(runs), run.runId);
        if (r) {
            const n = r.route.ranked.entries.length;
            add(r.rank === 1 ? `🥇 Fastest of ${n} on <b>${escapeHtml(r.route.name)}</b>`
                : `${ordinal(r.rank)} of ${n} on <b>${escapeHtml(r.route.name)}</b>`);
        }
    }

    // ─── Map ─────────────────────────────────────────────────────────────────

    function renderMap(run, stops) {
        map = L.map("rd-map", { zoomControl: true, attributionControl: true });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "&copy; OpenStreetMap contributors",
        }).addTo(map);
        const legend = document.getElementById("rd-legend");
        let bounds = null;

        const segs = RunAnalysis.paceSegments(run.track);
        const paces = segs.filter(s => s.kind === "run" && s.paceSec).map(s => s.paceSec).sort((a, b) => a - b);
        if (paces.length > 10) {
            let lo = RunAnalysis.quantile(paces, 0.1), hi = RunAnalysis.quantile(paces, 0.9);
            // An evenly paced run shouldn't flicker between colours on GPS noise
            if (hi - lo < 30) {
                const mid = RunAnalysis.quantile(paces, 0.5);
                lo = mid - 15; hi = mid + 15;
            }
            const bucket = (p) => hi > lo ? Math.min(4, Math.max(0, Math.floor((p - lo) / (hi - lo) * 5))) : 2;
            // Join neighbouring pieces of the same colour into one line
            let line = null, lineKey = null;
            const flush = () => {
                if (!line) return;
                const style = lineKey === "gap" ? { color: "#9e9e9e", weight: 3, dashArray: "6,8" }
                    : { color: PACE_COLORS[lineKey], weight: 5, opacity: 0.95 };
                L.polyline(line, style).addTo(map);
                line = null;
            };
            segs.forEach(s => {
                if (s.kind === "stop") return;
                const key = s.kind === "gap" ? "gap" : s.paceSec ? bucket(s.paceSec) : lineKey;
                if (key !== lineKey || !line) { flush(); line = [s.from]; lineKey = key; }
                line.push(s.to);
            });
            flush();
            legend.innerHTML = `<span>Faster ${formatPace(lo)}</span>
                <span class="rd-scale">${PACE_COLORS.map(c => `<i style="background:${c}"></i>`).join("")}</span>
                <span>${formatPace(hi)} Slower</span>`;
            bounds = L.latLngBounds(run.track.map(p => [p[2], p[3]]));
        } else {
            const path = (run.pathSegments || []).filter(s => s && s.length);
            const fallback = path.length ? path : [(run.timeSeries || []).filter(p => p.lat != null).map(p => [p.lat, p.lng])];
            const pts = [].concat(...fallback);
            if (pts.length) {
                L.polyline(fallback, { color: "#e53935", weight: 4 }).addTo(map);
                bounds = L.latLngBounds(pts);
            }
            legend.innerHTML = "";
        }

        stops.forEach(s => {
            L.circleMarker([s.lat, s.lng], { radius: 7, color: "#fff", weight: 2, fillColor: "#ff9800", fillOpacity: 1 })
                .bindTooltip(`Stopped ${formatTime(Math.round(s.durationMs / 1000))} at ${(s.distance / 1000).toFixed(2)} km`)
                .addTo(map);
        });
        if (bounds) {
            const ends = run.track && run.track.length ? [[run.track[0][2], run.track[0][3]], [run.track[run.track.length - 1][2], run.track[run.track.length - 1][3]]] : null;
            if (ends) {
                L.circleMarker(ends[0], { radius: 6, color: "#fff", weight: 2, fillColor: "#43a047", fillOpacity: 1 }).bindTooltip("Start").addTo(map);
                L.circleMarker(ends[1], { radius: 6, color: "#fff", weight: 2, fillColor: "#212121", fillOpacity: 1 }).bindTooltip("Finish").addTo(map);
            }
            map.fitBounds(bounds, { padding: [20, 20] });
        } else {
            map.setView([0, 0], 2);
        }
        setTimeout(() => map && map.invalidateSize(), 100);
    }

    // ─── Splits and stops ────────────────────────────────────────────────────

    function renderSplits(splits) {
        const box = document.getElementById("rd-splits");
        if (!splits.length) { box.innerHTML = '<p class="gr-note">No timing data for splits.</p>'; return; }
        const full = splits.filter(s => !s.partial);
        const fastest = Math.min(...splits.map(s => s.paceSec));
        box.innerHTML = `<table class="rd-table">
            <tr><th>km</th><th>Time</th><th>Pace</th><th></th></tr>
            ${splits.map(s => {
                // Full bar for the fastest; 10% slower loses 40%
                const w = Math.max(20, 100 - (s.paceSec - fastest) / fastest * 400);
                const best = full.length > 1 && !s.partial && s.paceSec === Math.min(...full.map(f => f.paceSec));
                return `<tr${best ? ' class="rd-best"' : ""}>
                    <td>${s.partial ? (s.distance / 1000).toFixed(2) : s.km}</td>
                    <td>${formatTime(Math.round(s.timeMs / 1000))}</td>
                    <td>${formatPace(s.paceSec)}</td>
                    <td class="rd-bar-cell"><i style="width:${w}%"></i></td></tr>`;
            }).join("")}
        </table>`;
    }

    function renderStops(stops) {
        const box = document.getElementById("rd-stops");
        box.innerHTML = stops.length
            ? `<ul class="rd-stops">${stops.map(s => `<li>Stopped <b>${formatTime(Math.round(s.durationMs / 1000))}</b> at ${(s.distance / 1000).toFixed(2)} km (${formatTime(Math.round(s.timeMs / 1000))} in)</li>`).join("")}</ul>`
            : '<p class="gr-note">No stops longer than 10 seconds.</p>';
    }

    // ─── Guided-run report ───────────────────────────────────────────────────

    const VERDICT = {
        ok: ["✓ On target", "ok"], fast: ["Too fast", "fast"], slow: ["Too slow", "slow"],
        moved: ["Kept moving", "slow"], stood: ["Stood still", "slow"], info: ["", "info"], skipped: ["Not reached", "info"],
    };

    function renderGuided(run, runs) {
        const box = document.getElementById("rd-guided");
        const p5 = RunAnalysis.fiveKPace(runs, run.startTime);
        const rep = RunAnalysis.guidedReport(run, run.guided, p5);
        if (!rep) return;
        const dur = (ms) => ms >= 60000 && ms % 60000 === 0 ? `${ms / 60000} min` : formatTime(Math.round(ms / 1000));
        const range = (r) => r.lo == null ? r.target.label
            : r.lo <= 0 ? `${r.target.label}: under ${formatPace(r.hi)}` : `${r.target.label}: ${formatPace(r.lo)}–${formatPace(r.hi)}`;
        let summary = rep.judged ? `<b>${rep.onTarget} of ${rep.judged}</b> segments on target.` : "";
        if (rep.fade != null && Math.abs(rep.fade) >= 5) {
            summary += rep.fade > 0
                ? ` Your hard reps slowed by ${formatPace(rep.fade)} /km from first to last.`
                : ` You got faster through the hard reps (by ${formatPace(-rep.fade)} /km). Strong finish.`;
        }
        box.innerHTML = `
            <h3>Workout report</h3>
            <p class="rd-guided-summary">${summary}</p>
            <table class="rd-table rd-guided">
                <tr><th>#</th><th>Asked</th><th>You</th><th></th></tr>
                ${rep.rows.map(r => {
                    const [text, cls] = VERDICT[r.status] || ["", "info"];
                    const you = r.status === "skipped" ? "—"
                        : r.target.kind === "rest" ? `${Math.round(r.distance)} m`
                        : r.paceSec ? `${formatPace(r.paceSec)} /km` : "—";
                    return `<tr>
                        <td>${r.index + 1}</td>
                        <td><b>${SEGMENT_NAMES[r.seg.type] || r.seg.type}</b> ${dur(r.durationMs)}<br><small>${escapeHtml(range(r))}</small></td>
                        <td>${you}${r.partial ? "<br><small>ended early</small>" : ""}${r.shortForGps && r.paceSec ? "<br><small>short: GPS pace is rough</small>" : ""}</td>
                        <td><span class="rd-verdict ${cls}">${text}</span></td></tr>`;
                }).join("")}
            </table>
            <p class="gr-note">${p5
                ? `Targets come from your predicted 5K pace of ${formatPace(p5)} /km (your best recent run, scaled to 5K). Without heart rate, effort is judged by pace.`
                : "Do a run of 1.5 km or more and pace targets will appear here."}</p>`;
    }

    // ─── Replay ──────────────────────────────────────────────────────────────

    function setupReplay(run, series) {
        if (!series || !series.some(p => p.lat != null) || !map) return;
        const box = document.getElementById("rd-replay");
        box.style.display = "";
        const total = run.time * 1000;
        const speedSel = document.getElementById("rd-speed");
        // Aim for a replay of about a minute
        speedSel.value = String(SPEEDS.reduce((best, s) => Math.abs(total / s - 60000) < Math.abs(total / best - 60000) ? s : best, SPEEDS[0]));

        const you = L.circleMarker(RunAnalysis.pointAtDistance(series, 0), { radius: 8, color: "#fff", weight: 3, fillColor: "#e53935", fillOpacity: 1 }).addTo(map);
        replay = { t: 0, total, series, you, ghost: null, ghostSeries: null, playing: false, raf: 0, last: 0 };

        if (run.ghost) {
            buildGhost(run.ghost).then(g => {
                if (!replay || replay.series !== series) return;
                replay.ghostSeries = g.series;
                replay.targetM = g.targetM;
                replay.ghost = L.marker(RunAnalysis.pointAtDistance(series, 0), {
                    icon: L.divIcon({ className: "ghost-map-marker", html: '<span style="font-size:26px">👻</span>', iconSize: [30, 30], iconAnchor: [15, 15] }),
                }).addTo(map);
                draw();
            }).catch(() => {});
        }

        const scrub = document.getElementById("rd-scrub");
        scrub.addEventListener("input", () => { replay.t = scrub.value / 1000 * total; draw(); });
        document.getElementById("rd-play").addEventListener("click", () => replay.playing ? pause() : play());
        draw();
    }

    function play() {
        if (replay.t >= replay.total) replay.t = 0;
        replay.playing = true;
        replay.last = performance.now();
        document.getElementById("rd-play").innerHTML = '<span class="material-icons">pause</span>';
        replay.raf = requestAnimationFrame(step);
    }

    function pause() {
        replay.playing = false;
        cancelAnimationFrame(replay.raf);
        const btn = document.getElementById("rd-play");
        if (btn) btn.innerHTML = '<span class="material-icons">play_arrow</span>';
    }

    function step(now) {
        if (!replay || !replay.playing) return;
        const speed = Number(document.getElementById("rd-speed").value) || 30;
        replay.t = Math.min(replay.total, replay.t + (now - replay.last) * speed);
        replay.last = now;
        draw();
        if (replay.t >= replay.total) { pause(); return; }
        replay.raf = requestAnimationFrame(step);
    }

    function stopReplay() {
        if (!replay) return;
        pause();
        replay = null;
    }

    function draw() {
        const r = replay;
        const d = RunAnalysis.distanceAtTime(r.series, r.t);
        const p = RunAnalysis.pointAtDistance(r.series, d);
        if (p) r.you.setLatLng(p);
        document.getElementById("rd-scrub").value = String(Math.round(r.t / r.total * 1000));
        let text = `${formatTime(Math.round(r.t / 1000))} · ${(d / 1000).toFixed(2)} km`;
        if (r.ghost) {
            // Like the AR view: the race is on distance, so the ghost runs along your route
            const gd = Math.min(RunAnalysis.distanceAtTime(r.ghostSeries, r.t), r.targetM);
            const gp = RunAnalysis.pointAtDistance(r.series, gd);
            if (gp) r.ghost.setLatLng(gp);
            const gap = Math.round(d - gd);
            text += Math.abs(gap) < 5 ? " · level with the ghost"
                : gap > 0 ? ` · ghost <b>${gap} m behind</b>` : ` · ghost <b>${-gap} m ahead</b>`;
        }
        document.getElementById("rd-readout").innerHTML = text;
    }

    return { open, close };
})();

function openRunDetail(runId) {
    return RunDetail.open(runId);
}
