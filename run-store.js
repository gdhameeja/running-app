// run-store.js — Where runs live in IndexedDB.
//
// A run is split across two stores, because the per-fix GPS data is most of its
// size and almost nothing needs it:
//   runs        everything else: what lists, stats and plans read (getAllRuns)
//   runDetails  `raw`, `track` and `pathSegments` (getRunById merges them back)
// So that lists never need the GPS data, each finished run's summary keeps
// `derived`: its route signature and best efforts, worked out from the full
// track when it's saved. `derived` never leaves the phone.
// Deleted runs leave a small record in `deletedRuns`, so that sync can tell other
// phones about the delete.
//
// updateRun takes a whole run or a summary: without GPS fields the stored ones
// stay as they are. Every local write stamps `updatedAt`, so cloud sync (sync.js)
// knows what changed.

const DB_VERSION = 3;
const HEAVY_FIELDS = ["raw", "track", "pathSegments"];
const EFFORT_METRES = [1000, 3000, 5000, 10000];

let db;

function analysis() {
    return typeof RunAnalysis !== "undefined" ? RunAnalysis : require("./analysis.js");
}

// What lists need from the full track
function deriveRun(run) {
    const RA = analysis();
    const whole = Object.assign({}, run, { derived: undefined });
    const efforts = {};
    EFFORT_METRES.forEach(m => {
        const e = RA.runBestEffort(whole, m);
        if (e) efforts[m] = e;
    });
    const sig = RA.routeSignature(whole);
    const round = (p) => [Math.round(p[0] * 1e6) / 1e6, Math.round(p[1] * 1e6) / 1e6];
    return {
        dense: !!(run.track && run.track.length > 1), efforts,
        routeSig: sig && Object.assign({}, sig, { pts: sig.pts.map(round) }),
    };
}

// { summary, details }; details is null when the run has no GPS fields
function splitRun(run) {
    const summary = Object.assign({}, run);
    if (!HEAVY_FIELDS.some(k => run[k] !== undefined)) return { summary, details: null };
    const details = { runId: run.runId };
    HEAVY_FIELDS.forEach(k => {
        if (run[k] !== undefined) details[k] = run[k];
        delete summary[k];
    });
    delete summary.derived;
    if (run.endTime) {
        // Lists work without it, just less exactly: never let it stop a save
        try { summary.derived = deriveRun(run); } catch (e) { console.warn("Could not summarise run", run.runId, e); }
    }
    return { summary, details };
}

// The run as it goes to the cloud or a backup file
function exportableRun(run) {
    const out = Object.assign({}, run);
    delete out.derived;
    return out;
}

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("RunDB", DB_VERSION);

        request.onerror = (event) => {
            console.error("IndexedDB error:", event.target.error);
            reject("Error opening database");
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            if (!db.objectStoreNames.contains("runs")) {
                const runsStore = db.createObjectStore("runs", { keyPath: "runId" });
                runsStore.createIndex("startTime", "startTime", { unique: false });
            }

            if (!db.objectStoreNames.contains("courseProgress")) {
                const cpStore = db.createObjectStore("courseProgress", { keyPath: "progressId" });
                cpStore.createIndex("courseId", "courseId", { unique: false });
                cpStore.createIndex("status", "status", { unique: false });
            }

            if (!db.objectStoreNames.contains("runDetails")) db.createObjectStore("runDetails", { keyPath: "runId" });
            if (!db.objectStoreNames.contains("deletedRuns")) db.createObjectStore("deletedRuns", { keyPath: "runId" });

            // v3 split runs in two. Not a change to the run, so `updatedAt` stays
            if (event.oldVersion > 0 && event.oldVersion < 3) {
                const tx = event.target.transaction;
                tx.objectStore("runs").openCursor().onsuccess = (e) => {
                    const cursor = e.target.result;
                    if (!cursor) return;
                    const { summary, details } = splitRun(cursor.value);
                    if (details) {
                        tx.objectStore("runDetails").put(details);
                        cursor.update(summary);
                    }
                    cursor.continue();
                };
            }
        };
    });
}

function finished(tx, value) {
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve(typeof value === "function" ? value() : value);
        tx.onabort = tx.onerror = () => reject(tx.error);
    });
}

function writeRun(run, { add = false } = {}) {
    const { summary, details } = splitRun(run);
    const tx = db.transaction(["runs", "runDetails", "deletedRuns"], "readwrite");
    tx.objectStore("runs")[add ? "add" : "put"](summary);
    if (details) tx.objectStore("runDetails").put(details);
    tx.objectStore("deletedRuns").delete(run.runId);
    return finished(tx, run.runId);
}

function saveRun(runData) {
    runData.updatedAt = Date.now();
    return writeRun(runData, { add: true });
}

function updateRun(runData) {
    runData.updatedAt = Date.now();
    return writeRun(runData);
}

// A run from the cloud or a backup: keeps its own `updatedAt`
function storeRemoteRun(run) {
    return writeRun(run);
}

// Changes a few fields without touching the GPS data; undefined removes a field.
// Resolves with the summary, or null if the run is gone.
function patchRun(runId, patch) {
    const tx = db.transaction(["runs"], "readwrite");
    const store = tx.objectStore("runs");
    let run = null;
    store.get(runId).onsuccess = (e) => {
        if (!e.target.result) return;
        run = Object.assign(e.target.result, patch, { updatedAt: Date.now() });
        Object.keys(run).forEach(k => run[k] === undefined && delete run[k]);
        store.put(run);
    };
    return finished(tx, () => run);
}

// Saves the run in progress, every 30 s or so. Not a change sync cares about.
function saveLiveRun(runId, fields) {
    const tx = db.transaction(["runs", "runDetails"], "readwrite");
    const store = tx.objectStore("runs");
    store.get(runId).onsuccess = (e) => {
        if (!e.target.result) return;
        const { summary, details } = splitRun(Object.assign(e.target.result, fields));
        store.put(summary);
        if (details) tx.objectStore("runDetails").put(details);
    };
    return finished(tx);
}

function getAllRuns() {
    return new Promise((resolve, reject) => {
        const req = db.transaction(["runs"], "readonly").objectStore("runs").getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = (e) => reject("Error retrieving runs: " + e.target.error);
    });
}

// The whole run, GPS data included
function getRunById(runId) {
    const tx = db.transaction(["runs", "runDetails"], "readonly");
    const summary = tx.objectStore("runs").get(runId);
    const details = tx.objectStore("runDetails").get(runId);
    return finished(tx, () => summary.result ? Object.assign(summary.result, details.result) : null);
}

function getLatestRun() {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(["runs"], "readonly");
        const store = tx.objectStore("runs");
        const index = store.index("startTime");
        const req = index.openCursor(null, "prev");
        req.onsuccess = (event) => {
            const cursor = event.target.result;
            // Walks and gym sessions live here too, but they aren't runs
            if (cursor && cursor.value.activity) cursor.continue();
            else resolve(cursor ? cursor.value : null);
        };
        req.onerror = (e) => reject("Error retrieving latest run: " + e.target.error);
    });
}

// Removes a run that never reached the cloud (nothing recorded, or you said no)
function forgetRun(runId) {
    const tx = db.transaction(["runs", "runDetails"], "readwrite");
    tx.objectStore("runs").delete(runId);
    tx.objectStore("runDetails").delete(runId);
    return finished(tx);
}

// Deletes a run here, and through sync everywhere. `at` is when, if another phone did it.
function deleteRun(runId, at = Date.now()) {
    const tx = db.transaction(["runs", "runDetails", "deletedRuns"], "readwrite");
    tx.objectStore("runs").delete(runId);
    tx.objectStore("runDetails").delete(runId);
    tx.objectStore("deletedRuns").put({ runId, deleted: true, updatedAt: at });
    return finished(tx);
}

function getDeletedRuns() {
    return new Promise((resolve, reject) => {
        const req = db.transaction(["deletedRuns"], "readonly").objectStore("deletedRuns").getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = (e) => reject(e.target.error);
    });
}

if (typeof module !== "undefined") {
    module.exports = {
        initDB, splitRun, deriveRun, exportableRun, saveRun, updateRun, storeRemoteRun, patchRun, saveLiveRun,
        getAllRuns, getRunById, getLatestRun, forgetRun, deleteRun, getDeletedRuns,
        database: () => db,
    };
}
