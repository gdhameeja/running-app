# Architecture Exploration: Native Mobile Migration

## 1. Current Architecture

The running tracker is a **vanilla HTML/CSS/JS web app** served as a static site (auto-deployed from `main`). There is no build step, no bundler, and no framework.

### Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Maps | Leaflet + OpenStreetMap tiles | GPS track rendering, user position |
| Charts | Chart.js | Pace trend, weekly volume |
| GPS | Web Geolocation API (`watchPosition`) | Live position tracking |
| Voice | Web Speech Synthesis API (`speechSynthesis.speak`) | Milestone announcements, guided run coaching |
| Storage | IndexedDB (RunDB, v2) | Run records, time-series data, course progress |
| Styling | Vanilla CSS + Material Icons + Roboto font | Mobile-first UI |

### Background Execution Limitations

Mobile operating systems aggressively manage background web processes. The web platform provides only best-effort mechanisms:

| Capability | Web API Used | Reality on Mobile |
|---|---|---|
| Keep screen on | Screen Wake Lock API (`navigator.wakeLock`) | Advisory — OS can override at low battery or in battery saver mode |
| Keep tab alive | Silent AudioContext oscillator + Media Session API | Discourages suspension but is not guaranteed; Chrome on Android may still throttle after ~5 minutes |
| GPS tracking | `navigator.geolocation.watchPosition` | Browser may pause callbacks when the tab is backgrounded or the screen is locked |
| Voice output | `SpeechSynthesis` | Killed immediately when browser goes to background on most mobile OSes |
| Timers | `setInterval` | Throttled to ~1/minute in background tabs (Chrome); may stop entirely when screen locked |

**Why these limitations exist:** Mobile OSes (Android Doze, iOS Background App Refresh) are designed to preserve battery by suspending processes that don't hold a Foreground Service (Android) or Background Mode entitlement (iOS). Web apps run inside the browser process and cannot declare themselves as foreground services. The browser is the one that decides whether to keep the tab's JavaScript running, and it almost always yields to the OS power management policy.

**Current mitigations in the web app:**
1. `navigator.wakeLock.request('screen')` — keeps the display on while acquired
2. Silent `AudioContext` oscillator — creates a playing audio stream so the browser treats the tab as media-active
3. `navigator.mediaSession` metadata — registers the tab as an active media session
4. Auto-save every 30 seconds — periodic persistence to IndexedDB so data survives process kill
5. Interrupted run recovery — on page load, checks for runs with no `endTime` and offers to save them
6. GPS gap detection — when fixes resume after a gap, starts a new path segment instead of drawing a straight line

These mitigations reduce data loss but cannot guarantee continuous operation while the screen is locked.

---

## 2. Option A: Native Android (Kotlin)

### Architecture

```
┌─────────────────────────────────────────┐
│  Activity / Jetpack Compose UI          │
│  ├── MapFragment (Google Maps SDK)      │
│  ├── StatsFragment (MPAndroidChart)     │
│  ├── GhostRaceFragment                  │
│  └── CoursesFragment                    │
├─────────────────────────────────────────┤
│  Foreground Service                     │
│  ├── LocationClient (Fused Location)    │
│  ├── TextToSpeech engine               │
│  ├── WakeLock (PARTIAL_WAKE_LOCK)       │
│  └── Notification (required for FG svc) │
├─────────────────────────────────────────┤
│  Room Database (SQLite)                 │
│  ├── RunEntity                          │
│  ├── TimeSeriesEntity                   │
│  └── CourseProgressEntity               │
└─────────────────────────────────────────┘
```

### How Background GPS Works Natively

A **Foreground Service** is Android's sanctioned mechanism for long-running operations that the user is aware of:

```kotlin
class RunTrackingService : Service() {
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = buildOngoingNotification()
        startForeground(NOTIFICATION_ID, notification)

        // Fused Location Provider — battery-efficient, high accuracy
        locationClient.requestLocationUpdates(
            LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 1000)
                .setMinUpdateDistanceMeters(3f)
                .build(),
            locationCallback,
            Looper.getMainLooper()
        )

        // TextToSpeech survives screen lock inside a Foreground Service
        tts = TextToSpeech(this) { status -> /* init */ }

        // PARTIAL_WAKE_LOCK keeps CPU awake even with screen off
        wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK, "RunTracker::Tracking"
        )
        wakeLock.acquire()

        return START_STICKY
    }
}
```

**Key guarantees the web app cannot provide:**
- `PARTIAL_WAKE_LOCK` keeps the CPU running with screen off — not advisory, not overridable
- Foreground Service with persistent notification is **exempt from Doze and battery saver**
- `FusedLocationProviderClient` is optimized for continuous tracking and survives all power states
- `TextToSpeech` runs in the service process and is not killed when the Activity is destroyed
- `START_STICKY` tells the OS to restart the service if it's killed for memory pressure

### How TTS and Speech Recognition Work Natively

- **TextToSpeech**: Android's `android.speech.tts.TextToSpeech` runs in any `Context` (Activity or Service). Inside a Foreground Service, it continues speaking through screen lock, battery saver, and Doze mode.
- **SpeechRecognizer**: Android's `android.speech.SpeechRecognizer` requires an Activity context and audio focus. It does **not** work when the screen is locked — the microphone is disabled in most lock-screen states for privacy reasons. Voice commands would require the screen to be on.

### Pros
- **Full background execution** — GPS, voice, sensors all work reliably while locked
- **Google Maps SDK** — offline maps, smooth vector rendering, better than Leaflet tiles
- **Sensor APIs** — Bluetooth HR monitors, step counter, barometer for elevation
- **Fused Location** — combines GPS + WiFi + cell towers + accelerometer for better accuracy with lower battery drain
- **Play Store distribution** — auto-updates, discoverability
- **Wear OS** — can extend to smartwatch companion

### Cons
- **Android only** — no iOS unless built separately
- **Kotlin learning curve** — if unfamiliar with Android SDK
- **Play Store overhead** — signing, review process, privacy policy
- **Larger codebase** — Android boilerplate (manifests, permissions, lifecycle)
- **Development velocity** — slower iteration vs. editing HTML/JS and refreshing browser

### Effort Estimate
Full rewrite: **4-6 weeks** for feature parity. Breakdown: core tracking service + Room database (~1 week), UI in Jetpack Compose (2-3 weeks), courses/ghost race/stats (1-2 weeks).

---

## 3. Option B: Go Mobile (gomobile)

### What Go Mobile Is

`golang.org/x/mobile` (`gomobile bind` / `gomobile build`) compiles Go code to a native Android `.aar` library or iOS `.framework`. It targets the **computation/logic layer only** — it cannot render UI, access platform services, or declare background execution modes.

### Architecture

```
┌────────────────────────────────────────┐
│  Thin Android Shell (Kotlin)           │
│  ├── UI (Compose or XML)              │
│  ├── Foreground Service wrapper        │
│  └── JNI bridge to Go library          │
├────────────────────────────────────────┤
│  Go Library (.aar)                     │
│  ├── Kalman filter                     │
│  ├── Distance calculation (Haversine)  │
│  ├── Pace / stats computation          │
│  ├── Ghost race interpolation          │
│  ├── Course session logic              │
│  └── Database layer (go-sqlite3)       │
├────────────────────────────────────────┤
│  Android Platform APIs (Kotlin)        │
│  ├── FusedLocationProvider             │
│  ├── TextToSpeech                      │
│  └── WakeLock                          │
└────────────────────────────────────────┘
```

### Background Services and GPS Support

Go Mobile **does not help with background execution**. The Go code runs as a library inside the Android process — it has no access to Android Services, WakeLocks, or location APIs. You still need:

- A **Kotlin/Java Foreground Service** to keep the process alive
- **Android location APIs** called from Kotlin, with GPS coordinates passed to Go via JNI
- **Android TextToSpeech** called from Kotlin

The Go library handles computation (Kalman filtering, Haversine distance, pace stats, ghost interpolation), but all platform interactions must remain in Kotlin.

### Pros
- **Shared logic** — Kalman filter, Haversine, stats, ghost interpolation written once in Go, usable on both Android and iOS
- **Go expertise** — if more comfortable in Go than Kotlin for algorithmic code
- **Testability** — pure Go functions are easy to unit test without Android emulators
- **Cross-platform potential** — same `.aar` on Android, same `.framework` on iOS

### Cons
- **Still need Kotlin for platform APIs** — Foreground Service, location, TTS, sensors
- **JNI overhead** — marshaling data between Go and Kotlin adds complexity and latency
- **Debugging difficulty** — stack traces cross JNI boundaries, harder to diagnose
- **Limited community** — Go Mobile has a small community; fewer examples and libraries
- **Two languages** — maintaining Go + Kotlin is more complex than pure Kotlin
- **No UI** — Go Mobile cannot render UI; you still need Jetpack Compose or XML layouts
- **gomobile type restrictions** — only supports a subset of Go types across the JNI bridge (no maps, limited struct nesting)

### Effort Estimate
**5-8 weeks** — longer than pure Kotlin because of JNI bridge setup, cross-boundary testing, and maintaining two build systems. The Go library itself takes ~1 week, but the Kotlin shell with Foreground Service is the same 4-6 weeks as Option A.

---

## 4. Recommendation

**Native Android with Kotlin** is the strongest path for this app's requirements:

1. **Guaranteed background execution** via Foreground Service — the only reliable mechanism on Android for continuous GPS + voice
2. **Better location accuracy** via Fused Location Provider (GPS + WiFi + cell + accelerometer fusion)
3. **Direct sensor access** for future features (HR monitors, barometric elevation)
4. **Simpler architecture** — one language, one build system, one debugger
5. **Lower maintenance burden** than Go Mobile's two-language approach

**Go Mobile is not recommended** because:
- The computation layer (Kalman filter, distance calc, ghost interpolation) is small (~200 lines) — rewriting it in Kotlin is trivial
- The platform integration layer (location, TTS, services) must be in Kotlin regardless
- JNI bridge complexity outweighs any code-sharing benefit for this app's scale
- No iOS target is planned that would justify the cross-platform investment

**Cross-platform comparison (brief):**

| Framework | Background GPS | Voice/TTS | Effort | Notes |
|---|---|---|---|---|
| React Native | `react-native-background-geolocation` (mature, $300 license) | `expo-speech` | 3-4 weeks | JS knowledge transfers from current web app |
| Flutter | `geolocator` + Foreground Service plugin | `flutter_tts` | 3-4 weeks | Excellent UI framework, Dart is new |
| Capacitor/Ionic | `@capacitor/geolocation` + background plugin | `@capacitor-community/text-to-speech` | 2-3 weeks | Wraps existing web app; background support fragile |

### Migration Strategy

If proceeding with native Android:

1. **Phase 1 — Tracking Core** (Week 1-2): Foreground Service + Fused Location + Kalman filter + distance tracking + PARTIAL_WAKE_LOCK + TTS milestone announcements
2. **Phase 2 — Data Layer** (Week 2-3): Room database (RunEntity, TimeSeriesEntity, CourseProgressEntity), migration from IndexedDB via JSON export/import
3. **Phase 3 — UI** (Week 3-5): Jetpack Compose screens for Track, Courses, Ghost Race, Stats; Google Maps SDK; MPAndroidChart
4. **Phase 4 — Polish** (Week 5-6): Course guided runs, ghost race comparison, settings, Wear OS companion (stretch)

---

## 5. Short-Term vs Long-Term

### Short-Term: Fix the Current Web App

The bugs identified (background execution, GPS gaps, pace calculation) have been addressed with best-effort web platform mitigations:

| Fix | Approach | Reliability |
|---|---|---|
| Voice in background | Silent AudioContext + Media Session + Wake Lock | Works on most Android Chrome; fails in battery saver or after extended lock |
| Run data preservation | Auto-save to IndexedDB every 30s + save on visibility hide + interrupted run recovery on next load | Data loss limited to last 30s even if process is killed |
| GPS straight lines | Gap detection (>10s between fixes) renders gaps as dashed lines instead of straight connections | Cosmetic fix; underlying GPS gap still loses distance data |
| Pace calculation | Filter outliers (>20 min/km or <2 min/km), clamp chart Y-axis | Handles noise from GPS jitter at start/stop |
| Voice commands in background | Not feasible in web — `SpeechRecognizer` requires active tab | Documented limitation; native Android also requires screen on for microphone |

These fixes make the web app **usable** for most runs, with data loss risk limited to ~30 seconds. The remaining gap is runs where the OS kills the browser process entirely (common in battery saver mode or on low-RAM devices).

### Long-Term: Native Rewrite When Warranted

The native rewrite should be triggered by one of these conditions:
1. **Data loss becomes unacceptable** — if auto-save + recovery still loses significant run data in regular use
2. **Sensor features needed** — Bluetooth HR monitor, step counter, barometric elevation
3. **Offline maps needed** — Google Maps SDK supports offline tile caching; Leaflet requires online tile servers
4. **Wear OS companion wanted** — smartwatch integration is only possible natively

Until then, the web app with the current mitigations provides a functional running tracker with known limitations that are documented in the UI.

The web app can continue to serve as a lightweight viewer and backup during and after the native migration.
