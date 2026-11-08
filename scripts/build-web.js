// Copies the static web app into www/, which Capacitor bundles into the Android app.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const out = path.join(root, "www");
const files = ["index.html", "styles.css", "coach.js", "courses.js", "run-core.js", "run-store.js", "strength-plan.js", "strength.js", "weekly-report.js", "weekly-report-ui.js", "training-plan.js", "today-ui.js", "stats.js", "stats-ui.js", "script.js", "performance.js", "native-tracker.js", "ar-math.js", "ar-ghost.js", "analysis.js", "gps-filter.js", "ghost-race.js", "run-detail.js", "sync.js", "enrich.js"];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
for (const f of files) fs.copyFileSync(path.join(root, f), path.join(out, f));
fs.cpSync(path.join(root, "vendor"), path.join(out, "vendor"), { recursive: true });
console.log(`Copied ${files.length} files and vendor/ to www/`);
