# Android app

The Android app is the same web UI wrapped with Capacitor, plus a native
foreground service that owns the run so it keeps going with the screen locked.

## How it fits together

| Piece | Where | Job |
|---|---|---|
| Web UI | `index.html`, `script.js`, `courses.js`, `performance.js` | Screens, map, charts, IndexedDB storage. Unchanged in the browser. |
| Bridge | `native-tracker.js` | In the app, starts/pauses/stops the service, mirrors its state into the UI, saves finished runs. |
| Plugin | `android/.../tracking/RunTrackerPlugin.kt` | Capacitor plugin `RunTracker` (start, pause, resume, stop, getState, clear, speak). |
| Service | `android/.../tracking/RunTrackerService.kt` | Foreground service: GPS, wake lock, notification (Pause/Finish), TTS, snapshot to disk every 10 s. |
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
