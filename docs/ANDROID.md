# Android app

The Android app is the same web UI wrapped with Capacitor, plus a native
foreground service that owns the run so it keeps going with the screen locked.

## How it fits together

| Piece | Where | Job |
|---|---|---|
| Web UI | `index.html`, `script.js`, `courses.js`, `performance.js` | Screens, map, charts, IndexedDB storage. Unchanged in the browser. |
| Bridge | `native-tracker.js` | In the app, starts/pauses/stops the service, mirrors its state into the UI, saves finished runs. |
| Plugin | `android/.../tracking/RunTrackerPlugin.kt` | Capacitor plugin `RunTracker` (start, pause, resume, stop, getState, clear, speak, rate). |
| Service | `android/.../tracking/RunTrackerService.kt` | Foreground service: GPS, wake lock, notification (Pause/Finish; during a Tune-In run, the pace to aim for and yours), TTS, snapshot to disk every 10 s. |
| GPS filter | `gps-filter.js`, `GpsFilter` in `RunEngine.kt` | Constant-velocity Kalman filter in metres, using the receiver's Doppler speed and bearing; keeps jitter out of distance. |
| Tune-In | `coach.js`, `PaceCoach.kt` | Plans a run from your recent runs (`TuneInPlanner`, web only) and coaches its paces live (`PaceCoach`, in both). |
| Backup and updates | `sync.js` | Supabase sync, JSON export/import, update check against GitHub Releases. See [CLOUD_SYNC.md](CLOUD_SYNC.md). |
| AR sensors | `android/.../tracking/ArSensors.kt` | Rotation-vector stream, magnetic declination and rear-camera optics for the AR ghost view. |
| Engine | `android/.../tracking/RunEngine.kt` | Pure Kotlin port of the tracking logic (filtering, gaps, splits, guided segments, ghost race). Unit tested. |

If the app is killed mid-run, the snapshot on disk comes back as an interrupted
run on the next launch. A run that finished while the app was closed (a guided
run completing, or Finish in the notification) is saved on the next launch.

## Build

Needs only Docker:

    docker/build-apk.sh

This runs the JS tests and Kotlin unit tests, then writes
`android/app/build/outputs/apk/debug/app-debug.apk`. Install it with
`adb install -r app-debug.apk`, or copy it to the phone and open it.
The version is `1.<commit count>`, so a build of a later commit always
installs over an earlier one.

## Releases (no cable)

Every push to `main` builds the APK on GitHub (`.github/workflows/release.yml`)
and publishes it as a release (`v1.<commit count>`). You can also run it from
the **Actions** tab on any branch. The app checks for a newer release when it
opens (at most every 6 hours) and offers **Download** under **History → Cloud
backup**. Open the downloaded APK to install. The first time, Android asks you
to allow installs from your browser.

The release must be signed with the same key as the app on your phone, or
Android refuses the update (and uninstalling wipes your runs). One-time setup:

    base64 -w0 .android-user/debug.keystore

Copy the output into a repo secret named `DEBUG_KEYSTORE_B64` (**GitHub →
Settings → Secrets and variables → Actions → New repository secret**).

After changing web files, rebuild; `npm run sync` copies them into the Android project.

## Adding features

- UI or logic that only runs while the app is open: write it in the web files.
- Anything that must work with the screen locked (new voice cues, sensors,
  heart-rate straps): add it to `RunEngine`/`RunTrackerService` and expose
  it through `RunTrackerPlugin`.

## AR ghost view

During a ghost race, "See your ghost (AR)" opens the rear camera with the ghost
drawn where it would be (`ar-ghost.js`, geometry in `ar-math.js`).

- **Position:** the race is on distance, so the ghost is placed on *your* route:
  on your own GPS trail when it's behind; on the PB run's recorded route when
  it's ahead and you're on the same route (shifted by your offset from that
  route); otherwise straight ahead along your direction of travel. The chip at
  the bottom says which.
- **Direction:** Android's fused rotation vector, corrected from magnetic to
  true north with `GeomagneticField`. If the compass is off, point the camera
  the way you're running and tap **Align**.
- **Scale:** projected with the real lens focal length and sensor size from
  Camera2, so a ghost 20 m away is drawn at the size a person would be.
- In a browser it falls back to `deviceorientationabsolute` and a 66° lens guess.

## Run data

Besides `timeSeries` (a point every 100 m and every minute), each run stores
`track`: one entry per accepted GPS fix,
`[movingMs, distanceM, lat, lng, speedMps|null, bearingDeg|null]`, rounded the
same way in `script.js` (`addTrackPoint`) and `RunJson.trackPoint` (~110 KB per
hour). A ghost race against a run with a track replays its exact path and
pacing; older runs fall back to the 100 m splits. Speed and bearing come from
the GPS receiver itself and give the AR view an instant direction of travel.

Runs also store what they were doing, for the run detail page:

- `ghost`: the ghost raced, as a small spec (`{ type: "run", runId, targetM }`
  to replay a run, or `{ type: "pace", targetM, timeMs }` for a target time).
  `buildGhost` in `ghost-race.js` turns a spec into the ghost's series.
- `guided`: the course session (title and segments) for the workout report.
- `ratings`: effort check-ins from the old Tune-In course, `[[movingMs, rating 1-5], ...]`.
- `updatedAt`: when the record last changed on this phone, for cloud sync.

Recorded during the run (web and service alike):

- `track` points carry altitude as a 7th value: `[..., speed, bearing, altitude]`.
- `raw`: every fix as delivered, accepted or not, before filtering:
  `[movingMs, lat, lng, accuracy, altitude, speed, bearing]`. Lets a better
  filter re-process old runs.
- `steps`: `[movingMs, steps since start]` every 5 s from the step counter
  (Android, needs the "Physical activity" permission). Cadence for the run
  details, and the pace coach says "quicker, lighter steps" instead of
  "a little quicker" when you're slow at under 160 steps/min.
- `pauses`: `[movingMs at the pause, ms paused]`, to line watch data up with moving time.
- `coachLog`: `[movingMs, text]`, everything spoken.
- `coachResults`: `{ eases, parts: [[segment index, target s/km, your s/km | null]] }` for Tune-In runs.

Asked of you:

- `feel`: Tired / Normal / Fresh, picked on the Run tab or the Tune-In card.
- `readiness`: `{ sleepMin, restingHr, baseline, suggested }` from Health Connect at the start.
- `rpe` (1-10) and `note`: the question on the run summary and run details.

Filled in afterwards by `enrich.js` (old runs too, 25 per app start):

- `elevation`: `{ points: [[distance m, elevation m], ...] every 100 m, gain, loss }`
  from the Copernicus 90 m terrain model via Open-Meteo. `RunAnalysis.flatMetres`
  turns it into hill-adjusted distance (Minetti's cost of running on a slope).
- `weather`: `{ tempC, feelsC, humidity, dewPointC, windKmh, windDirDeg, precipMm }`
  at the start (Open-Meteo forecast API for recent runs, its archive for older ones).
- `hr`: `{ samples: [[ms since startTime, bpm]], avg, max }` from Health Connect,
  whatever the watch app wrote there (Zepp Life does). Retried for 3 days,
  as watches sync late.

Tune-In uses these: each past run counts as if flat and cool, today's target is
set for your typical route and today's heat, and a Tune-In you hit with heart
rate above 92% of your max counts as too hard. The minimum Android version is 8.0,
which Health Connect needs.

## Courses with scripted and coached segments

Guided segments can carry `label` and `say` (their own name and spoken words;
Fun Run games and bursts) and `role` plus `pace` (s/km; Tune-In). Both the web
runner in `script.js` and `RunEngine.tickGuided` honour them; for paced
segments the coach speaks the announcement. `PaceCoach` in `coach.js` and
`PaceCoach.kt` must stay in step (`tests.js` and `PaceCoachTest.kt` test the
same cases).

**Tune-In** is not a course: the card on the Courses tab plans a run each
time from your last 10 runs (it needs 5). The main set averages a few percent
quicker than your usual pace, reached with pushes, surges, floats and
recoveries, and capped by your predicted 5K pace. The step grows after a
Tune-In run you hit and shrinks after one you missed (`run.guided.tuneIn`
keeps the plan). During the run, two missed parts in a row make the rest 4%
gentler.

## Ghost races, routes and run details

| Piece | Where |
|---|---|
| Analysis (pure, tested in `tests.js`): splits, stops, pace colours, route matching, spoken ghost cues, guided-run report | `analysis.js` |
| Ghost Race tab: PBs, target time, past runs, route leaderboards | `ghost-race.js` |
| Run detail page: pace map, splits, stops, replay vs the ghost, workout report | `run-detail.js` |

- **Routes** are matched by shape: same start and finish (within 150 m), similar
  length (within 12%), and 85% of each route within 40 m of the other, in the
  same order. Ranking uses each run's time over the shortest run's distance.
- **Spoken ghost updates** (every 250 m, at most every 30 s, never next to a
  km announcement, and at once on an overtake) run in `RunEngine.ghostCue` on
  Android so they work with the screen locked, and in `RunAnalysis.ghostCue`
  in the browser. Keep the two in step.
- **Workout targets** are pace ranges scaled from your predicted 5K pace
  (Riegel, best run of 1.5 km+ in the last 120 days); see `segmentTarget`.
