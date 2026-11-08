// stats-ui.js — The Stats tab: headline cards for a period you pick, then three
// short sections (Running · Strength · You). The numbers are in stats.js.
//
// Charts follow one palette: blue for your runs (the series that matters), orange
// for the comparison, aqua for walks; one y-axis each, thin lines, a hover
// tooltip, and a legend whenever there are two series. Colours checked for
// colour blindness (dataviz validator: all pairs pass); aqua is light on white,
// so it always comes with a text label.

const COLORS = { blue: "#2a78d6", orange: "#eb6834", aqua: "#1baf7a", blueLight: "#86b6ef", blueDark: "#184f95", gray: "#c3c2b7", grid: "#e1e0d9", muted: "#898781" };

const StatsUI = (() => {
    const charts = {};
    let state = { period: "4w", section: "running" };
    try { Object.assign(state, JSON.parse(localStorage.getItem("statsView") || "{}")); } catch (e) { /* storage unavailable */ }
    const saveState = () => { try { localStorage.setItem("statsView", JSON.stringify(state)); } catch (e) { /* storage unavailable */ } };
    const $ = (id) => document.getElementById(id);
    const shortDate = (t) => new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" });

    function chart(id, config) {
        if (charts[id]) { charts[id].destroy(); delete charts[id]; }
        const el = $(id);
        if (el) charts[id] = new Chart(el, config);
    }

    // Shared look: recessive grid, muted axes, a crosshair-style tooltip on lines
    function base(yTitle, { reverse = false, ticks = null, legend = false } = {}) {
        return {
            responsive: true, maintainAspectRatio: false, animation: false,
            interaction: { mode: "nearest", intersect: false },
            plugins: { legend: { display: legend, labels: { boxWidth: 12, color: "#52514e" } } },
            scales: {
                x: { grid: { display: false }, ticks: { color: COLORS.muted, maxRotation: 0, autoSkip: true, maxTicksLimit: 6 } },
                y: { reverse, title: { display: !!yTitle, text: yTitle, color: COLORS.muted }, grid: { color: COLORS.grid }, ticks: Object.assign({ color: COLORS.muted }, ticks ? { callback: ticks } : {}) },
            },
        };
    }

    const paceTick = (v) => Stats.clock(v);

    // A heading, a canvas and a note in one block, or nothing at all
    function block(id, title, canvasId, note = "", table = "") {
        $(id).innerHTML = `<h3>${title}</h3><div class="chart-container"><canvas id="${canvasId}"></canvas></div>${note ? `<p class="st-note">${note}</p>` : ""}${table}`;
    }

    // The numbers behind a chart, for anyone who'd rather read them
    function tableHtml(heads, rows) {
        if (!rows.length) return "";
        return `<details class="st-table"><summary>See the numbers</summary><table class="rd-table"><tr>${heads.map(h => `<th>${h}</th>`).join("")}</tr>
            ${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</table></details>`;
    }

    // ─── Top of the page ─────────────────────────────────────────────────────

    function controls() {
        $("st-periods").innerHTML = Object.keys(Stats.PERIODS).map(k =>
            `<button class="st-chip${state.period === k ? " on" : ""}" data-period="${k}">${Stats.PERIODS[k].label}</button>`).join("");
        $("st-sections").innerHTML = [["running", "Running"], ["strength", "Strength"], ["you", "You"]].map(([k, l]) =>
            `<button class="st-tab${state.section === k ? " on" : ""}" role="tab" aria-selected="${state.section === k}" data-section="${k}">${l}</button>`).join("");
        document.querySelectorAll("[data-period]").forEach(b => b.addEventListener("click", () => { state.period = b.dataset.period; saveState(); renderStats(); }));
        document.querySelectorAll("[data-section]").forEach(b => b.addEventListener("click", () => { state.section = b.dataset.section; saveState(); showSection(); }));
        showSection();
    }

    function showSection() {
        ["running", "strength", "you"].forEach(k => { $("st-" + k).style.display = state.section === k ? "" : "none"; });
        document.querySelectorAll("[data-section]").forEach(b => { b.classList.toggle("on", b.dataset.section === state.section); b.setAttribute("aria-selected", b.dataset.section === state.section); });
        Object.values(charts).forEach(c => c.resize());
        // The year scrolls to the latest weeks, once it can be measured
        const wrap = document.querySelector("#st-calendar .st-cal-wrap");
        if (wrap && state.section === "you") wrap.scrollLeft = wrap.scrollWidth;
    }

    function cards(all) {
        const h = Stats.headline(all, state.period);
        const delta = (pct) => pct == null ? `<small class="st-delta">no data before</small>` : pct === 0 ? `<small class="st-delta">same as before</small>`
            : `<small class="st-delta">${pct > 0 ? "▲" : "▼"} ${Math.abs(pct)}% on the ${Stats.PERIODS[state.period].label.toLowerCase()} before</small>`;
        const card = (value, label, pct, section) => `<button class="st-card" data-go="${section}"><b>${value}</b><span>${label}</span>${delta(pct)}</button>`;
        $("st-cards").innerHTML = card(h.cur.km.toFixed(1), "km run", h.km, "running") + card(h.cur.runs, `run${h.cur.runs === 1 ? "" : "s"}`, h.runs, "running")
            + card(h.cur.workouts, `workout${h.cur.workouts === 1 ? "" : "s"}`, h.workouts, "strength") + card(h.cur.hours.toFixed(1), "hours moving", h.hours, "you");
        document.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => { state.section = b.dataset.go; saveState(); showSection(); $("st-sections").scrollIntoView({ behavior: "smooth" }); }));
    }

    function recap(all) {
        const el = $("st-recap");
        const r = new Date().getDate() <= 7 ? Stats.monthRecap(all) : null;
        if (!r) { el.innerHTML = ""; return; }
        const bits = [r.cur.runs && `${r.cur.km.toFixed(1)} km over ${r.cur.runs} run${r.cur.runs === 1 ? "" : "s"}`, r.cur.workouts && `${r.cur.workouts} workout${r.cur.workouts === 1 ? "" : "s"}`, r.cur.walks && `${r.cur.walks} walk${r.cur.walks === 1 ? "" : "s"}`].filter(Boolean);
        el.innerHTML = `<div class="st-recap"><h3>Your ${escapeHtml(r.month)}</h3>
            <p>${bits.join(", ")}.${r.change != null ? ` ${r.change >= 0 ? "Up" : "Down"} ${Math.abs(r.change)}% on the month before.` : ""}${r.longest ? ` Longest run: ${r.longest.toFixed(1)} km.` : ""}</p>
            ${r.records.length ? `<p>New records: ${r.records.map(escapeHtml).join(" · ")}</p>` : ""}</div>`;
    }

    // ─── Running ─────────────────────────────────────────────────────────────

    function flatCool(all, rg) {
        const pts = Stats.flatCoolPace(all, rg.start, rg.end);
        if (pts.length < 2) { $("st-flat").innerHTML = ""; return; }
        const hottest = pts.reduce((m, p) => p.heat > m.heat ? p : m, pts[0]);
        const note = hottest.heat > 0.01 ? `Your ${shortDate(hottest.t)} run felt slow at ${Stats.clock(hottest.pace)}, but in the heat that's ${Stats.clock(hottest.flat)} on a cool, flat day.`
            : "Hills and heat are taken out, so runs on different days compare fairly.";
        block("st-flat", "Pace, as if flat and cool", "st-flat-c", note,
            tableHtml(["Date", "Pace", "Flat & cool"], pts.slice(-12).reverse().map(p => [shortDate(p.t), Stats.clock(p.pace), Stats.clock(p.flat)])));
        chart("st-flat-c", {
            type: "line",
            data: {
                labels: pts.map(p => shortDate(p.t)),
                datasets: [
                    { label: "Flat and cool", data: pts.map(p => p.flat), borderColor: COLORS.blue, backgroundColor: COLORS.blue, borderWidth: 2, pointRadius: 3, tension: 0.25 },
                    { label: "As run", data: pts.map(p => p.pace), borderColor: COLORS.orange, backgroundColor: COLORS.orange, borderWidth: 2, pointRadius: 3, tension: 0.25 },
                ],
            },
            options: Object.assign(base("min/km (quicker is higher)", { reverse: true, ticks: paceTick, legend: true }), {
                plugins: { legend: { display: true, labels: { boxWidth: 12 } }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${Stats.clock(c.parsed.y)} /km` } } },
            }),
        });
    }

    function efficiency(all, rg) {
        const pts = Stats.efficiency(all, rg.prevStart, rg.end);
        if (pts.length < 3) {
            $("st-eff").innerHTML = `<h3>Fitter than your pace says</h3><p class="st-note">Needs heart rate from your watch on a few steady runs (${pts.length} so far). Connect a watch under History, Backup & updates.</p>`;
            return;
        }
        const first = pts[0].trend, last = pts[pts.length - 1].trend;
        const change = Math.round((last / first - 1) * 100);
        block("st-eff", "Fitter than your pace says", "st-eff-c",
            `Metres you cover per heartbeat on steady runs, as if flat and cool. More is fitter. ${Math.abs(change) >= 2 ? `${change > 0 ? "Up" : "Down"} ${Math.abs(change)}% since ${shortDate(pts[0].t)}.` : "About level so far."} The heart often shows fitness before pace does.`,
            tableHtml(["Date", "m/beat", "Heart rate"], pts.slice(-12).reverse().map(p => [shortDate(p.t), p.value.toFixed(2), Math.round(p.hr)])));
        chart("st-eff-c", {
            type: "line",
            data: {
                labels: pts.map(p => shortDate(p.t)),
                datasets: [
                    { label: "Trend (last 5 runs)", data: pts.map(p => p.trend), borderColor: COLORS.blue, borderWidth: 2, pointRadius: 0, tension: 0.3 },
                    { label: "Each run", data: pts.map(p => p.value), borderColor: "transparent", backgroundColor: COLORS.blueLight, pointRadius: 4, showLine: false },
                ],
            },
            options: Object.assign(base("metres per heartbeat", { legend: true }), {
                plugins: { legend: { display: true, labels: { boxWidth: 12 } }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.parsed.y.toFixed(2)} m per beat` } } },
            }),
        });
    }

    function intensityBar(all, rg) {
        const it = Stats.intensity(all, rg.start, rg.end);
        if (!it.total) { $("st-intensity").innerHTML = ""; return; }
        const parts = [["easy", "Easy (1-4)", COLORS.blueLight], ["moderate", "Moderate (5-6)", COLORS.blue], ["hard", "Hard (7+)", COLORS.blueDark], ["unrated", "Not rated", COLORS.gray]];
        const pct = (k) => it[k] / it.total * 100;
        const share = it.easyShare == null ? null : Math.round(it.easyShare * 100);
        const verdict = share == null ? "Rate your runs to see this." : share >= 75 ? `${share}% of your rated running was easy: right where it should be (about 80%).`
            : `${share}% of your rated running was easy. The guide is about 80%: slow some runs right down.`;
        $("st-intensity").innerHTML = `<h3>How hard your running was</h3>
            <div class="st-stack" role="img" aria-label="${parts.map(([k, l]) => `${l} ${Math.round(it[k])} min`).join(", ")}">${parts.filter(([k]) => it[k] > 0).map(([k, l, c]) =>
                `<span style="flex:${pct(k)};background:${c}" title="${l}: ${Math.round(it[k])} min"></span>`).join("")}</div>
            <div class="st-legend">${parts.filter(([k]) => it[k] > 0).map(([k, l, c]) => `<span><i style="background:${c}"></i>${l} · ${Math.round(it[k])} min</span>`).join("")}</div>
            <p class="st-note">${verdict}</p>`;
    }

    function effort(all) {
        const e = Stats.effortVsPace(all, state.period);
        if (e.now.length + e.before.length < 4) { $("st-effort").innerHTML = ""; return; }
        block("st-effort", "Effort against pace", "st-effort-c", "Each dot is a rated run. Getting fitter moves the dots right: quicker for the same effort.");
        const ds = (label, pts, color) => ({ label, data: pts.map(p => ({ x: p.pace, y: p.rpe })), backgroundColor: color, borderColor: "#fff", borderWidth: 2, pointRadius: 5, pointHoverRadius: 7 });
        chart("st-effort-c", {
            type: "scatter",
            data: { datasets: [ds(`Last ${Stats.PERIODS[state.period].label.toLowerCase()}`, e.now, COLORS.blue), ds("The period before", e.before, COLORS.orange)] },
            options: Object.assign(base("how hard (1-10)", { legend: true }), {
                interaction: { mode: "nearest", intersect: true },
                plugins: { legend: { display: true, labels: { boxWidth: 12 } }, tooltip: { callbacks: { label: c => `${Stats.clock(c.parsed.x)} /km, felt ${c.parsed.y}` } } },
                scales: {
                    x: { reverse: true, title: { display: true, text: "pace, flat and cool (quicker →)", color: COLORS.muted }, grid: { display: false }, ticks: { color: COLORS.muted, callback: paceTick } },
                    y: { min: 0, max: 10, grid: { color: COLORS.grid }, ticks: { color: COLORS.muted, stepSize: 2 }, title: { display: true, text: "how hard (1-10)", color: COLORS.muted } },
                },
            }),
        });
    }

    function predictions(all) {
        const p = Stats.predictions(all, state.period);
        if (!p) { $("st-predict").innerHTML = ""; return; }
        const fmt = (s) => formatDuration(Math.round(s));
        $("st-predict").innerHTML = `<h3>Race predictions</h3><table class="rd-table st-predict"><tr><th></th><th>Now</th><th>${Stats.PERIODS[state.period].label} ago</th></tr>
            ${p.map(r => `<tr><td>${r.label}</td><td><b>${fmt(r.sec)}</b></td><td>${r.was ? `${fmt(r.was)}${Math.abs(r.was - r.sec) >= 5 ? ` <small>${r.sec < r.was ? "▲" : "▼"} ${formatDuration(Math.round(Math.abs(r.was - r.sec)))}</small>` : ""}` : "–"}</td></tr>`).join("")}</table>
            <p class="st-note">From your fastest recent run, scaled by Riegel's formula. Longer races assume you've trained for the distance.</p>`;
    }

    function routes(all) {
        const list = Stats.routeProgress(findRoutes(all.filter(r => r.endTime)));
        if (!list.length) { $("st-routes").innerHTML = ""; return; }
        const t = (s) => formatDuration(Math.round(s));
        $("st-routes").innerHTML = `<h3>Your routes</h3>${list.slice(0, 6).map(r => `<button class="st-route" data-run="${r.bestRunId}">
            <b>${escapeHtml(r.name)}</b><span>${r.count} runs · first ${t(r.first)} → latest ${t(r.latest)} · best ${t(r.best)}</span></button>`).join("")}`;
        $("st-routes").querySelectorAll("[data-run]").forEach(b => b.addEventListener("click", () => openRunDetail(Number(b.dataset.run))));
    }

    function fun(all) {
        const f = Stats.funStats(all);
        if (!f.runs) { $("st-fun").innerHTML = ""; return; }
        const chases = f.escaped + f.caught;
        const head = `${f.runs} Fun Run${f.runs === 1 ? "" : "s"}${chases ? ` · escaped ${f.escaped} of ${chases} chases` : ""}${f.finishes.length ? ` · best photo finish ${Stats.clock(Math.min(...f.finishes.map(x => x.pace)))} /km` : ""}`;
        if (f.bestBursts.length < 2) { $("st-fun").innerHTML = `<h3>Fun Runs</h3><p class="st-note">${head}</p>`; return; }
        block("st-fun", "Fun Runs: your quickest burst each time", "st-fun-c", head);
        chart("st-fun-c", {
            type: "line",
            data: { labels: f.bestBursts.map(b => shortDate(b.t)), datasets: [{ label: "Quickest burst", data: f.bestBursts.map(b => b.pace), borderColor: COLORS.blue, backgroundColor: COLORS.blue, borderWidth: 2, pointRadius: 4, tension: 0.25 }] },
            options: Object.assign(base("min/km (quicker is higher)", { reverse: true, ticks: paceTick }), { plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${Stats.clock(c.parsed.y)} /km` } } } }),
        });
    }

    function shoes(all) {
        const list = Today.shoeList().filter(s => !s.retired);
        if (!list.length) { $("st-shoes").innerHTML = ""; return; }
        const km = (id) => all.filter(r => r.shoe === id && r.activity !== "strength").reduce((a, r) => a + r.distance / 1000, 0);
        $("st-shoes").innerHTML = `<h3>Shoes</h3>${list.map(s => {
            const total = (s.startKm || 0) + km(s.id), limit = s.limitKm || 700;
            return `<div class="st-shoe"><span>${escapeHtml(s.name)}</span><div class="st-meter"><i style="width:${Math.min(100, total / limit * 100)}%;background:${total >= limit ? "#d03b3b" : COLORS.blue}"></i></div><small>${Math.round(total)} / ${limit} km${total >= limit ? " · time for new ones" : ""}</small></div>`;
        }).join("")}`;
    }

    // ─── Strength ────────────────────────────────────────────────────────────

    function ladders(all, rg) {
        const list = Stats.ladders(all, rg.start, rg.end);
        if (!list.length) { $("st-ladders").innerHTML = ""; return; }
        const climbed = list.reduce((a, l) => a + Math.max(0, l.to - l.from), 0);
        $("st-ladders").innerHTML = `<h3>Climbing the ladders</h3>
            <p class="st-note">${climbed ? `${climbed} step${climbed === 1 ? "" : "s"} up in the last ${Stats.PERIODS[state.period].label.toLowerCase()}.` : "Same steps as the start of the period: the reps are where the work is."}</p>
            ${list.map(l => `<div class="st-ladder"><div><b>${escapeHtml(l.name)}</b><small>${escapeHtml(l.variation || "")}</small></div>
                <div class="st-steps" aria-label="Step ${l.to + 1} of ${l.of}">${Array.from({ length: l.of }, (_, i) =>
                    `<i class="${i <= l.to ? (i > l.from ? "up" : "on") : ""}"></i>`).join("")}</div>
                <small>${l.to > l.from ? `step ${l.from + 1} → ${l.to + 1}` : `step ${l.to + 1}`} of ${l.of}</small></div>`).join("")}
            <div class="st-legend"><span><i style="background:${COLORS.blueDark}"></i>where you were</span><span><i style="background:${COLORS.orange}"></i>climbed this period</span></div>`;
    }

    function balanceBars(all, rg) {
        const b = Stats.balance(all, rg.start, rg.end);
        const max = Math.max(...Object.values(b));
        if (!max) { $("st-balance").innerHTML = ""; return; }
        const names = { push: "Pushing", pull: "Pulling", legs: "Legs", hinge: "Back & hips", core: "Core" };
        const low = Object.keys(b).filter(k => b[k] < max / 3);
        $("st-balance").innerHTML = `<h3>Balance</h3>${Object.keys(names).map(k => `<div class="st-bar"><span>${names[k]}</span><div class="st-meter"><i style="width:${b[k] / max * 100}%;background:${COLORS.blue}"></i></div><small>${b[k]} sets</small></div>`).join("")}
            <p class="st-note">${low.length ? `Light on ${low.map(k => names[k].toLowerCase()).join(" and ")}: the full-body workouts keep it even if you take them in turn.` : "Even across the body. Good."}</p>`;
    }

    function calf(all) {
        const tests = Stats.calfTests(all);
        if (!tests.length) { $("st-calf").innerHTML = `<h3>Calf test</h3><p class="st-note">Once a month: as many single-leg calf raises as you can. It's under Gym, Short extras. 25 a leg is a good benchmark.</p>`; return; }
        $("st-calf").innerHTML = `<h3>Calf test</h3><table class="rd-table"><tr><th></th><th>Left</th><th>Right</th></tr>
            ${tests.slice(-6).reverse().map(t => `<tr><td>${shortDate(t.t)}</td><td>${t.left}${t.left >= 25 ? " ✓" : ""}</td><td>${t.right == null ? "–" : t.right + (t.right >= 25 ? " ✓" : "")}</td></tr>`).join("")}</table>
            <p class="st-note">25 or more a leg is a good benchmark, and unlocks single-leg hops.</p>`;
    }

    // ─── You ─────────────────────────────────────────────────────────────────

    function calendar(all) {
        const weeks = Stats.calendar(all);
        const st = Stats.dayStreaks(all);
        const fill = (d) => {
            const c = [d.runs && COLORS.blue, d.gyms && COLORS.orange, d.walks && COLORS.aqua].filter(Boolean);
            if (!c.length) return "";
            return c.length === 1 ? `background:${c[0]}` : `background:linear-gradient(135deg, ${c[0]} 50%, ${c[1]} 50%)`;
        };
        const what = (d) => [d.runs && `${d.km.toFixed(1)} km run`, d.gyms && "gym", d.walks && "walk"].filter(Boolean).join(", ") || "rest";
        const months = weeks.map((w, i) => { const m = new Date(w[0].t).getMonth(); return i === 0 || m !== new Date(weeks[i - 1][0].t).getMonth() ? new Date(w[0].t).toLocaleDateString(undefined, { month: "short" }) : ""; });
        $("st-calendar").innerHTML = `<h3>Your year</h3>
            <div class="st-cal-wrap"><div class="st-cal-months">${months.map(m => `<span>${m}</span>`).join("")}</div>
            <div class="st-cal">${weeks.map(w => `<div>${w.map(d => d.future ? `<i class="future"></i>`
                : `<i class="${fill(d) ? "on" : ""}" style="${fill(d)}" data-day="${d.key}" title="${new Date(d.t).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}: ${what(d)}"></i>`).join("")}</div>`).join("")}</div></div>
            <div class="st-legend"><span><i style="background:${COLORS.blue}"></i>Run</span><span><i style="background:${COLORS.orange}"></i>Gym</span><span><i style="background:${COLORS.aqua}"></i>Walk</span></div>
            <p class="st-note" id="st-cal-day">${st.current >= 2 ? `${st.current} days in a row right now. ` : ""}Longest run of days: ${st.longest}. Tap a day to see it.</p>`;
        const wrap = $("st-calendar").querySelector(".st-cal-wrap");
        requestAnimationFrame(() => { wrap.scrollLeft = wrap.scrollWidth; });
        $("st-calendar").querySelectorAll("[data-day]").forEach(c => c.addEventListener("click", () => { $("st-cal-day").textContent = c.title; }));
    }

    function records(all) {
        const list = Stats.records(all);
        if (!list.length) { $("st-records").innerHTML = ""; return; }
        $("st-records").innerHTML = `<h3>Records</h3><div class="st-records">${list.map(r => `<button class="st-record" ${r.runId ? `data-run="${r.runId}"` : "disabled"}>
            <small>${escapeHtml(r.label)}</small><b>${escapeHtml(r.value)}</b>${r.at ? `<span>${shortDate(r.at)}</span>` : ""}</button>`).join("")}</div>`;
        $("st-records").querySelectorAll("[data-run]").forEach(b => b.addEventListener("click", () => openRunDetail(Number(b.dataset.run))));
    }

    function patterns(all) {
        const list = Stats.patterns(all);
        $("st-patterns").innerHTML = `<h3>Your patterns</h3>${list.length ? list.map(p => `<div class="st-pattern"><p>${escapeHtml(p.text)}</p><small>From ${escapeHtml(p.n)}.</small></div>`).join("")
            : `<p class="st-note">Nothing to say yet, and that's on purpose: a pattern only shows once there are at least 5 runs on each side (mornings and evenings, hot days and cool ones, after the gym and not). Keep going and they'll appear here.</p>`}`;
    }

    function fitnessAge(all) {
        WeekReport.profile().then(me => {
            const pts = Stats.fitnessAgeByMonth(all, me);
            if (pts.length < 2) { $("st-fitage").innerHTML = ""; return; }
            $("st-fitage").innerHTML = `<p class="st-note">Your fitness age at the end of each month (lower is fitter).</p><div class="chart-container"><canvas id="st-fitage-c"></canvas></div>`;
            const age = new Date().getFullYear() - me.birthYear;
            chart("st-fitage-c", {
                type: "line",
                data: {
                    labels: pts.map(p => new Date(p.t).toLocaleDateString(undefined, { month: "short" })),
                    datasets: [
                        { label: "Fitness age", data: pts.map(p => p.age), borderColor: COLORS.blue, backgroundColor: COLORS.blue, borderWidth: 2, pointRadius: 4, tension: 0.25 },
                        { label: `Your age (${age})`, data: pts.map(() => age), borderColor: COLORS.muted, borderWidth: 1, borderDash: [4, 4], pointRadius: 0 },
                    ],
                },
                options: Object.assign(base("years", { legend: true }), { plugins: { legend: { display: true, labels: { boxWidth: 12 } } } }),
            });
        });
    }

    function lifetime(all) {
        const l = Stats.lifetime(all);
        $("st-lifetime").innerHTML = `<h3>All time</h3><div class="st-life">
            <div><b>${Math.round(l.km).toLocaleString()}</b><small>km run</small></div>
            <div><b>${Math.round(l.hours).toLocaleString()}</b><small>hours moving</small></div>
            <div><b>${l.runs + l.workouts + l.walks}</b><small>sessions</small></div>
            ${l.steps ? `<div><b>${Math.round(l.steps / 1000).toLocaleString()}k</b><small>steps</small></div>` : ""}</div>
            ${l.like.length ? `<p class="st-note">That's ${l.like.map(escapeHtml).join(", and ")}.</p>` : ""}`;
    }

    // ─── Everything ──────────────────────────────────────────────────────────

    function render() {
        return getAllRuns().then(all => {
            const done = all.filter(r => r.endTime);
            const empty = !done.length;
            $("stats-empty").style.display = empty ? "block" : "none";
            $("stats-content").style.display = empty ? "none" : "block";
            if (empty) return;
            const rg = Stats.range(state.period);
            controls();
            recap(done);
            cards(done);
            flatCool(done, rg);
            efficiency(done, rg);
            intensityBar(done, rg);
            effort(done);
            renderVolumeChart(done);
            renderPersonalBests(done);
            predictions(done);
            routes(done);
            fun(done);
            shoes(done);
            ladders(done, rg);
            balanceBars(done, rg);
            calf(done);
            $("strength-stats").innerHTML = strengthStatsHtml(done);
            $("walk-stats").innerHTML = walkStatsHtml(done);
            calendar(done);
            records(done);
            patterns(done);
            renderVO2max(done);
            fitnessAge(done);
            lifetime(done);
            WeekReport.renderList();
            renderCourseProgress();
        });
    }

    return { render };
})();

function renderStats() {
    return StatsUI.render();
}
