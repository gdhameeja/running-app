// enrich.js — Fills in what the phone can't measure during a run, for new
// runs and (a batch at a time) old ones:
//  - Elevation profile from the Copernicus 90 m terrain model via Open-Meteo
//    (free, no account): steadier than GPS altitude, and works for old runs.
//    Used for hill-adjusted paces (RunAnalysis.flatMetres).
//  - Weather at the start: temperature, feels-like, humidity, wind, rain
//    (Open-Meteo forecast API for the last ~3 months, its archive before that).
//  - Heart rate from your watch through Health Connect, matched to the run by time.
// It also reads last night's sleep and your resting heart rate to suggest
// how fresh you are (Tired / Normal / Fresh) before a run.
// Changes are saved with patchRun, so cloud sync picks them up.

const Enrich = (() => {
    const ELEVATION_URL = "https://api.open-meteo.com/v1/elevation";
    const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
    const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";
    const HOURLY = "temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,wind_speed_10m,wind_direction_10m,precipitation";
    const PROFILE_STEP_M = 100;
    const PER_PASS = 25;
    // The watch may sync to Health Connect a while after the run; give up after this
    const HR_WAIT_MS = 3 * 86400000;
    const RECENT_MS = 80 * 86400000;
    const REFRESH_MS = 3600000;

    let running = null;
    let health = { status: "unknown", granted: false };
    let readiness = null;
    let today = null;
    let refreshedAt = 0;

    function getJson(url) {
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), 20000);
        return fetch(url, { signal: ctl.signal }).then(res => {
            clearTimeout(timer);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        }, err => { clearTimeout(timer); throw err; });
    }

    // Points along the route every 100 m: [[distance m, lat, lng], ...]
    function routePoints(run) {
        const series = RunAnalysis.seriesForRun(run);
        if (!series || !series.some(p => p.lat != null) || !(run.distance > 0)) return [];
        const out = [];
        for (let d = 0; d < run.distance; d += PROFILE_STEP_M) {
            const p = RunAnalysis.pointAtDistance(series, d);
            if (p) out.push([d, p[0], p[1]]);
        }
        const end = RunAnalysis.pointAtDistance(series, run.distance);
        if (end) out.push([run.distance, end[0], end[1]]);
        return out;
    }

    function elevation(run) {
        const pts = routePoints(run);
        if (pts.length < 2) return Promise.resolve({ none: true });
        const batches = [];
        for (let i = 0; i < pts.length; i += 100) batches.push(pts.slice(i, i + 100));
        return Promise.all(batches.map(b => getJson(`${ELEVATION_URL}?latitude=${b.map(p => p[1].toFixed(5)).join(",")}&longitude=${b.map(p => p[2].toFixed(5)).join(",")}`)))
            .then(results => {
                const elev = results.flatMap(r => r.elevation);
                const points = pts.map((p, i) => [Math.round(p[0]), elev[i]]);
                let gain = 0, loss = 0;
                for (let i = 1; i < points.length; i++) {
                    const dz = points[i][1] - points[i - 1][1];
                    if (dz > 0) gain += dz; else loss -= dz;
                }
                return { source: "Copernicus DEM 90 m (Open-Meteo)", points, gain: Math.round(gain), loss: Math.round(loss) };
            });
    }

    // The hour nearest a time, as "2026-11-06T23" in GMT. Near midnight that's
    // the next day, so the request has to ask for that day too.
    const nearestHour = (time) => new Date(Math.round(time / 3600000) * 3600000).toISOString().slice(0, 13);

    function hourlyAt(data, time) {
        const h = data && data.hourly;
        if (!h || !h.time || !h.time.length) return null;
        const target = nearestHour(time);
        const i = h.time.findIndex(t => t.startsWith(target));
        if (i < 0 || h.temperature_2m[i] == null) return null;
        return {
            tempC: h.temperature_2m[i], feelsC: h.apparent_temperature[i], humidity: h.relative_humidity_2m[i],
            dewPointC: h.dew_point_2m[i], windKmh: h.wind_speed_10m[i], windDirDeg: h.wind_direction_10m[i],
            precipMm: h.precipitation[i], at: h.time[i] + "Z",
        };
    }

    function weather(run) {
        const pts = routePoints(run);
        if (!pts.length) return Promise.resolve({ none: true });
        const [, lat, lng] = pts[0];
        const day = nearestHour(run.startTime).slice(0, 10);
        const base = Date.now() - run.startTime < RECENT_MS ? FORECAST_URL : ARCHIVE_URL;
        return getJson(`${base}?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&start_date=${day}&end_date=${day}&hourly=${HOURLY}&timezone=GMT`)
            .then(data => {
                const w = hourlyAt(data, run.startTime);
                if (w) return w;
                // The archive lags a few days behind; try again later
                return Date.now() - run.startTime > 14 * 86400000 ? { none: true } : null;
            });
    }

    // Heart rate from Health Connect during the run: samples are [ms since startTime, bpm]
    function heartRate(run) {
        const end = run.endTime || run.startTime + run.time * 1000;
        return NativeTracker.healthHeartRate(run.startTime, end).then(samples => {
            if (!samples.length) return Date.now() - end > HR_WAIT_MS ? { samples: [], none: true } : null;
            const bpm = samples.map(x => x[1]);
            return {
                source: "health-connect",
                samples: samples.map(([t, b]) => [t - run.startTime, b]),
                avg: Math.round(bpm.reduce((s, x) => s + x, 0) / bpm.length),
                max: Math.max(...bpm),
            };
        });
    }

    // What a run still needs, as [field, fetcher] pairs
    function missing(run) {
        const out = [];
        if (!run.endTime || !(run.distance > 0)) return out;
        if (!run.elevation) out.push(["elevation", elevation]);
        if (!run.weather) out.push(["weather", weather]);
        if (!run.hr && health.granted) out.push(["hr", heartRate]);
        return out;
    }

    // Fills in up to PER_PASS runs, newest first. Resolves with how many changed.
    function pass() {
        if (running) return running;
        if (typeof isRunLive === "function" && isRunLive()) return Promise.resolve(0);
        running = getAllRuns().then(runs => {
            const todo = runs.filter(r => missing(r).length).sort((a, b) => b.startTime - a.startTime).slice(0, PER_PASS);
            let changed = 0;
            return todo.reduce((chain, summary) => chain.then(() => getRunById(summary.runId)).then(run => {
                if (!run) return; // deleted meanwhile
                const found = {};
                return missing(run).reduce((c, [field, fetcher]) => c.then(() => fetcher(run).then(value => {
                    if (value) found[field] = value;
                }).catch(() => { /* offline or no data yet: next time */ })), Promise.resolve())
                    .then(() => {
                        if (!Object.keys(found).length) return;
                        changed++;
                        // Only these fields, so anything that changed meanwhile (an RPE answer, say) stays
                        return patchRun(run.runId, found);
                    });
            }), Promise.resolve()).then(() => changed);
        }).finally(() => { running = null; });
        return running;
    }

    // ─── Health Connect ──────────────────────────────────────────────────────

    function refreshHealth() {
        if (!NativeTracker.available) return Promise.resolve(health);
        return NativeTracker.healthStatus().then(s => { health = s; return s; }).catch(() => health);
    }

    function connectHealth() {
        return NativeTracker.healthRequest().then(res => {
            health = { status: res.status || health.status, granted: !!res.granted };
            if (health.granted) { refreshReadiness(); pass(); }
            return health;
        });
    }

    // Last night's sleep and resting heart rate against your usual: a suggested feel
    function suggest(sleep, resting, now) {
        const night = sleep.filter(([, end]) => now - end < 16 * 3600000 && now >= end);
        const sleepMin = night.length ? Math.round(night.reduce((s, [a, b]) => s + (b - a), 0) / 60000) : null;
        const todayRhr = resting.filter(([t]) => now - t < 24 * 3600000).map(x => x[1]);
        const before = resting.filter(([t]) => now - t >= 24 * 3600000).map(x => x[1]).sort((a, b) => a - b);
        const restingHr = todayRhr.length ? todayRhr[todayRhr.length - 1] : null;
        const baseline = before.length >= 3 ? before[Math.floor(before.length / 2)] : null;
        const why = [];
        if (sleepMin != null) why.push(`${Math.floor(sleepMin / 60)}h ${sleepMin % 60}m sleep`);
        if (restingHr != null && baseline != null) why.push(`resting HR ${restingHr} (usually ${baseline})`);
        let feel = null;
        if (sleepMin != null || (restingHr != null && baseline != null)) {
            if ((sleepMin != null && sleepMin < 360) || (restingHr != null && baseline != null && restingHr >= baseline + 5)) feel = "tired";
            else if ((sleepMin == null || sleepMin >= 450) && (restingHr == null || baseline == null || restingHr <= baseline)) feel = "fresh";
            else feel = "normal";
        }
        return { feel, sleepMin, restingHr, baseline, why: why.join(", ") };
    }

    function refreshReadiness() {
        if (!health.granted) return Promise.resolve(null);
        const now = Date.now();
        return NativeTracker.healthDaily(now - 15 * 86400000, now).then(d => {
            readiness = Object.assign(suggest(d.sleep, d.resting, now), { at: now });
            return readiness;
        }).catch(() => null);
    }

    // Ten weeks of sleep and resting heart rate for the weekly report, or null without a watch
    function dailyHealth(now = Date.now()) {
        if (!health.granted) return Promise.resolve(null);
        return NativeTracker.healthDaily(now - 70 * 86400000, now).catch(() => null);
    }

    // ─── Today's weather, for the Tune-In plan ───────────────────────────────

    function here() {
        return new Promise(resolve => {
            if (!navigator.geolocation) return resolve(null);
            navigator.geolocation.getCurrentPosition(p => resolve([p.coords.latitude, p.coords.longitude]),
                () => resolve(null), { maximumAge: 30 * 60000, timeout: 8000 });
        }).then(pos => pos || getAllRuns().then(runs => {
            const last = runs.filter(r => r.endTime && r.distance > 0).sort((a, b) => b.startTime - a.startTime)[0];
            const p = last && routePoints(last)[0];
            return p ? [p[1], p[2]] : null;
        }));
    }

    // Resolves with { tempC, feelsC, humidity, windKmh } now, or null; cached 30 min
    function todayWeather() {
        if (today && Date.now() - today.at < 30 * 60000) return Promise.resolve(today.data);
        return here().then(pos => {
            if (!pos) return null;
            return getJson(`${FORECAST_URL}?latitude=${pos[0].toFixed(4)}&longitude=${pos[1].toFixed(4)}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,precipitation`)
                .then(d => {
                    const c = d.current;
                    const data = c ? { tempC: c.temperature_2m, feelsC: c.apparent_temperature, humidity: c.relative_humidity_2m, windKmh: c.wind_speed_10m, precipMm: c.precipitation } : null;
                    today = { at: Date.now(), data };
                    return data;
                });
        }).catch(() => null);
    }

    function refresh() {
        refreshedAt = Date.now();
        return refreshHealth().then(() => refreshReadiness())
            .then(() => { if (typeof renderFeelPicker === "function") renderFeelPicker(); })
            .then(() => pass()).then(n => { if (n) CloudSync.soon(); }).catch(() => {});
    }

    // Android keeps the app alive for days, so this can't only happen at launch:
    // last night's sleep, and heart rate the watch synced late, would never arrive
    function init() {
        refresh();
        document.addEventListener("visibilitychange", () => {
            if (!document.hidden && Date.now() - refreshedAt > REFRESH_MS) refresh();
        });
    }

    // After a run: weather and hills now, heart rate once the watch has synced
    function afterRun() {
        setTimeout(() => pass().then(n => { if (n) CloudSync.soon(); }), 5000);
    }

    return {
        init, pass, afterRun, connectHealth, dailyHealth, refreshHealth, refreshReadiness, todayWeather, suggest, routePoints, weather,
        healthState: () => health,
        readinessNow: () => readiness && Date.now() - readiness.at < 6 * 3600000
            ? { sleepMin: readiness.sleepMin, restingHr: readiness.restingHr, baseline: readiness.baseline, suggested: readiness.feel } : null,
        readiness: () => readiness,
    };
})();

if (typeof module !== "undefined") module.exports = Enrich;
