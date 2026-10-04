# Architecture Exploration: Native Mobile Migration

## Current State

The running tracker is a vanilla HTML/CSS/JS web app using:
- **Leaflet** for map rendering
- **Chart.js** for stats visualization
- **Web Geolocation API** for GPS tracking
- **Web Speech Synthesis API** for voice coaching
- **IndexedDB** for local data persistence

### Current Limitations

| Capability | Web App Behavior | Impact |
|---|---|---|
| Background GPS | Browser may suspend `watchPosition` when tab is hidden or screen locked | Straight-line artifacts, missed distance |
| Voice output | `SpeechSynthesis` is killed when browser goes to background | No coaching or milestone announcements while locked |
| Battery saver | OS aggressively restricts background web processes below ~20% battery | Complete loss of tracking and audio |
| Wake Lock | Screen Wake Lock API exists but is advisory — OS can override, especially at low battery | Screen may sleep mid-run |
| Sensor access | No heart rate monitor, accelerometer step counting is limited | Can't do HR-based zone training |

The app currently mitigates these with the Screen Wake Lock API and a silent AudioContext oscillator to discourage the browser from suspending the tab. These are best-effort — the OS retains final authority over background web processes.

---

## Option 1: Native Android (Kotlin)

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

### Background Execution

**Foreground Service** is the sanctioned Android mechanism for long-running GPS tracking:

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

**Key guarantees that the web app cannot provide:**
- `PARTIAL_WAKE_LOCK` keeps the CPU running with screen off — no OS override
- Foreground Service with persistent notification is exempt from battery saver restrictions
- `FusedLocationProviderClient` is optimized for continuous tracking and survives Doze mode
- `TextToSpeech` runs in-process and is not killed with the Activity
- `START_STICKY` restarts the service if the OS kills it for memory

### Pros
- **Full background execution** — GPS, voice, sensors all work reliably while locked
- **Google Maps SDK** — offline maps, smooth vector rendering, better than Leaflet tiles
- **Sensor APIs** — Bluetooth HR monitors, step counter, barometer for elevation
- **Fused Location** — combines GPS + WiFi + cell towers + accelerometer for better accuracy with lower battery drain
- **Play Store distribution** — auto-updates, discoverability
- **Wear OS** — can extend to smartwatch companion

### Cons
- **Android only** — no iOS unless you build separately
- **Kotlin learning curve** — if unfamiliar with Android SDK
- **Play Store overhead** — signing, review process, privacy policy
- **Larger codebase** — Android boilerplate (manifests, permissions, lifecycle)
- **Development velocity** — slower iteration vs. editing HTML/JS and refreshing

### Effort Estimate
Full rewrite: **4-6 weeks** for feature parity. The core tracking service and Room database can be built in ~1 week; UI in Jetpack Compose takes 2-3 weeks; courses/ghost race/stats take another 1-2 weeks.

---

## Option 2: Go Mobile (gomobile)

### What It Is

[Go Mobile](https://github.com/aspect-build/aspect-cli) (`golang.org/x/mobile`) lets you write Go code that compiles to a native Android `.aar` library or iOS `.framework`. It targets the computation/logic layer, not the UI.

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
│  Android Platform APIs                 │
│  ├── FusedLocationProvider             │
│  ├── TextToSpeech                      │
│  └── WakeLock                          │
└────────────────────────────────────────┘
```

### Background Execution with Go Mobile

Go Mobile **does not help with background execution**. The Go code runs as a library inside the Android process — it has no access to Android Services, WakeLocks, or location APIs on its own. You still need:

- A **Kotlin/Java Foreground Service** to keep the process alive
- **Android location APIs** called from Kotlin, with results passed to Go via JNI
- **Android TextToSpeech** called from Kotlin

The Go library handles computation (filtering, distance, pace, ghost interpolation), but all platform interactions remain in Kotlin.

### Pros
- **Shared logic** — Kalman filter, Haversine, stats, ghost interpolation written once in Go, usable on both Android and iOS
- **Go expertise** — if you're more comfortable in Go than Kotlin for algorithmic code
- **Testability** — pure Go functions are easy to unit test without Android emulators
- **Cross-platform potential** — same `.aar` on Android, same `.framework` on iOS

### Cons
- **Still need Kotlin for platform APIs** — Foreground Service, location, TTS, sensors
- **JNI overhead** — marshaling data between Go and Kotlin adds complexity and latency
- **Debugging difficulty** — stack traces cross JNI boundaries, harder to diagnose
- **Limited community** — Go Mobile has a small community; fewer examples and libraries
- **Two languages** — maintaining Go + Kotlin is more complex than pure Kotlin
- **No UI** — Go Mobile cannot render UI; you still need Jetpack Compose or XML layouts
- **gomobile limitations** — only supports a subset of Go types across the JNI bridge (no maps, no interfaces with multiple return values, limited struct nesting)

### Effort Estimate
**5-8 weeks** — longer than pure Kotlin because of JNI bridge setup, testing across the boundary, and maintaining two build systems. The Go library itself is ~1 week, but the Kotlin shell with Foreground Service is the same 4-6 weeks as Option 1.

---

## Option 3: Cross-Platform (Brief Overview)

| Framework | Background GPS | Voice/TTS | Effort | Notes |
|---|---|---|---|---|
| **React Native** | Via `react-native-background-geolocation` (mature, $300 license) | `expo-speech` works in background on Android | 3-4 weeks | Closest to current web codebase; JS knowledge transfers |
| **Flutter** | Via `geolocator` + Foreground Service plugin | `flutter_tts` | 3-4 weeks | Dart is new but framework is excellent for UI |
| **Capacitor/Ionic** | Via `@capacitor/geolocation` + background plugin | Via `@capacitor-community/text-to-speech` | 2-3 weeks | Wraps existing web app; least rewrite but background support is fragile |
| **PWA (current + improvements)** | Best-effort with Wake Lock + audio hack | Best-effort; fails in battery saver | 0 weeks | Current approach; limitations documented above |

---

## Comparison: Background Execution

| Requirement | Web App (Current) | Native Android (Kotlin) | Go Mobile + Kotlin Shell |
|---|---|---|---|
| GPS while screen off | Unreliable | Foreground Service — reliable | Foreground Service — reliable |
| GPS in battery saver | Fails | Foreground Service is exempt | Foreground Service is exempt |
| Voice while locked | Fails | TTS in Service — reliable | TTS in Kotlin Service — reliable |
| Wake Lock | Advisory (OS can override) | PARTIAL_WAKE_LOCK — guaranteed | PARTIAL_WAKE_LOCK — guaranteed |
| Continuous tracking | Gaps after ~30s background | Continuous, hardware-level | Continuous, hardware-level |
| Location accuracy | `navigator.geolocation` only | Fused (GPS+WiFi+cell+accel) | Fused (via Kotlin bridge) |

---

## Recommendation

**Native Android with Kotlin** is the strongest path for solving the core problems (background GPS, voice while locked, battery saver immunity). It provides:

1. **Guaranteed background execution** via Foreground Service — the only reliable mechanism on Android
2. **Better location accuracy** via Fused Location Provider
3. **Direct sensor access** for future features (HR monitors, elevation)
4. **Simpler architecture** — one language, one build system, one debugger
5. **Lower maintenance burden** than Go Mobile's two-language approach

**Go Mobile is not recommended** for this app because:
- The computation layer (Kalman filter, distance calc, ghost interpolation) is small and simple — rewriting it in Kotlin is trivial
- The platform integration layer (location, TTS, services) must be in Kotlin regardless
- JNI bridge complexity outweighs any code-sharing benefit
- There's no iOS target planned that would justify the cross-platform investment

### Migration Strategy

If proceeding with native Android:

1. **Phase 1 — Tracking Core** (Week 1-2): Foreground Service with Fused Location, Kalman filter, distance tracking, PARTIAL_WAKE_LOCK, TTS milestone announcements
2. **Phase 2 — Data Layer** (Week 2-3): Room database with RunEntity + TimeSeriesEntity + CourseProgressEntity, migration from IndexedDB (export/import JSON)
3. **Phase 3 — UI** (Week 3-5): Jetpack Compose screens for Track, Courses, Ghost Race, Stats; Google Maps integration; Chart rendering with MPAndroidChart
4. **Phase 4 — Polish** (Week 5-6): Course guided runs, ghost race real-time comparison, settings, Wear OS companion (stretch)

The web app can continue to serve as a lightweight viewer/backup while the native app is being built.
