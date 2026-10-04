// Copies the static web app into www/, which Capacitor bundles into the Android app.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const out = path.join(root, "www");
const files = ["index.html", "styles.css", "courses.js", "script.js", "performance.js", "native-tracker.js", "ar-math.js", "ar-ghost.js", "analysis.js", "ghost-race.js", "run-detail.js"];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
for (const f of files) fs.copyFileSync(path.join(root, f), path.join(out, f));
console.log(`Copied ${files.length} files to www/`);
