package com.gdhameeja.runtracker.tracking

import android.Manifest
import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import com.gdhameeja.runtracker.MainActivity
import com.gdhameeja.runtracker.R
import org.json.JSONObject
import java.io.File

// Foreground service that owns a run while it is in progress. Android keeps a
// foreground service with an ongoing notification alive with the screen off,
// so GPS, the run clock and voice cues keep working when the phone is locked.
// The web UI is just a viewer: it gets live updates through RunTrackerPlugin
// and re-syncs from getState() whenever it comes back to the foreground.
class RunTrackerService : Service(), LocationListener {

    companion object {
        private const val TAG = "RunTrackerService"
        const val ACTION_START = "start"
        const val ACTION_PAUSE = "pause"
        const val ACTION_RESUME = "resume"
        const val ACTION_STOP = "stop"
        private const val CHANNEL_ID = "run_tracking"
        private const val NOTIFICATION_ID = 1
        private const val TICK_MS = 500L
        private const val PERSIST_EVERY_MS = 10_000L

        /** The running service, if any. Only touched on the main thread. */
        var instance: RunTrackerService? = null
            private set

        /** Receives a summary on every fix and clock tick; set by RunTrackerPlugin. */
        var listener: ((JSONObject) -> Unit)? = null

        /** Config for the next ACTION_START (kept out of the Intent to avoid size limits). */
        var pendingConfig: RunConfig? = null

        fun snapshotFile(context: Context) = File(context.filesDir, "active_run.json")

        fun intent(context: Context, action: String) =
            Intent(context, RunTrackerService::class.java).setAction(action)
    }

    private val main = Handler(Looper.getMainLooper())
    private lateinit var locationManager: LocationManager
    private lateinit var speaker: Speaker
    private var wakeLock: PowerManager.WakeLock? = null

    var engine: RunEngine? = null
        private set
    private var lastPersist = 0L
    private var lastEmittedSecond = -1L
    private var shuttingDown = false
    private var runGeneration = 0

    private val ticker = object : Runnable {
        override fun run() {
            val e = engine ?: return
            val now = System.currentTimeMillis()
            speakAll(e.tick(now))
            if (e.status == RunEngine.Status.FINISHED) {
                finishRun()
                return
            }
            val second = e.elapsedMs(now) / 1000
            if (second != lastEmittedSecond) {
                lastEmittedSecond = second
                publish(now)
            }
            main.postDelayed(this, TICK_MS)
        }
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
        locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        speaker = Speaker(this)
        createChannel()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                val config = pendingConfig
                pendingConfig = null
                val busy = engine?.let { it.status != RunEngine.Status.FINISHED } ?: false
                if (config == null || busy) {
                    if (engine == null) stopSelf()
                    return START_NOT_STICKY
                }
                startRun(config)
            }
            ACTION_PAUSE -> pauseRun()
            ACTION_RESUME -> resumeRun()
            ACTION_STOP -> stopRun()
            else -> if (engine == null) stopSelf()
        }
        // Not sticky: if the process dies the web layer recovers the last snapshot
        // as an interrupted run instead of Android silently restarting tracking.
        return START_NOT_STICKY
    }

    private fun startRun(config: RunConfig) {
        val now = System.currentTimeMillis()
        val e = RunEngine(config, now)
        engine = e
        shuttingDown = false
        runGeneration++
        startInForeground(e, now)

        wakeLock?.let { if (it.isHeld) it.release() }
        wakeLock = (getSystemService(Context.POWER_SERVICE) as PowerManager)
            .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "RunTracker::run")
            .apply { acquire(6 * 60 * 60 * 1000L) }

        requestLocation()
        persist(now)
        main.post(ticker)
    }

    fun pauseRun() {
        val e = engine ?: return
        val now = System.currentTimeMillis()
        e.pause(now)
        locationManager.removeUpdates(this)
        persist(now)
        publish(now)
    }

    fun resumeRun() {
        val e = engine ?: return
        if (e.status != RunEngine.Status.PAUSED) return
        val now = System.currentTimeMillis()
        e.resume(now)
        requestLocation()
        publish(now)
    }

    /** Ends the run and returns its final snapshot. */
    fun stopRun(): JSONObject? {
        val e = engine ?: return null
        e.finish(System.currentTimeMillis())
        return finishRun()
    }

    private fun finishRun(): JSONObject? {
        val e = engine ?: return null
        if (shuttingDown) return RunJson.snapshot(e, System.currentTimeMillis())
        shuttingDown = true
        val now = System.currentTimeMillis()
        main.removeCallbacks(ticker)
        locationManager.removeUpdates(this)
        val snapshot = persist(now)
        publish(now)
        // Let the last announcement ("Workout complete!", ghost result) finish
        // before the service, and with it the TTS engine, goes away.
        val generation = runGeneration
        speaker.whenIdle {
            if (generation != runGeneration) return@whenIdle // a new run started meanwhile
            wakeLock?.let { if (it.isHeld) it.release() }
            ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
            stopSelf()
        }
        return snapshot
    }

    override fun onDestroy() {
        main.removeCallbacks(ticker)
        locationManager.removeUpdates(this)
        engine?.let { if (it.status != RunEngine.Status.FINISHED) persist(System.currentTimeMillis()) }
        wakeLock?.let { if (it.isHeld) it.release() }
        speaker.shutdown()
        if (instance === this) instance = null
        super.onDestroy()
    }

    // ─── Location ────────────────────────────────────────────────────────────

    @SuppressLint("MissingPermission")
    private fun requestLocation() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED
        ) {
            Log.w(TAG, "Location permission missing; run will not record distance")
            return
        }
        // Raw GPS at 1 Hz; RunEngine does its own filtering (accuracy gate, Kalman, outliers).
        locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000L, 0f, this, Looper.getMainLooper())
    }

    override fun onLocationChanged(location: Location) {
        val e = engine ?: return
        val now = System.currentTimeMillis()
        val accuracy = if (location.hasAccuracy()) location.accuracy.toDouble() else Double.MAX_VALUE
        val speed = if (location.hasSpeed()) location.speed.toDouble() else null
        val bearing = if (location.hasBearing()) location.bearing.toDouble() else null
        speakAll(e.onLocation(location.latitude, location.longitude, accuracy, now, speed, bearing))
        if (now - lastPersist >= PERSIST_EVERY_MS) persist(now)
        publish(now)
    }

    @Deprecated("Deprecated in Java")
    override fun onStatusChanged(provider: String?, status: Int, extras: android.os.Bundle?) {}
    override fun onProviderEnabled(provider: String) {}
    override fun onProviderDisabled(provider: String) {}

    // ─── Output: voice, web layer, notification, disk ────────────────────────

    private fun speakAll(phrases: List<String>) = phrases.forEach(speaker::speak)

    private fun publish(now: Long) {
        val e = engine ?: return
        listener?.invoke(RunJson.summary(e, now))
        if (!shuttingDown) {
            getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, buildNotification(e, now))
        }
    }

    private fun persist(now: Long): JSONObject {
        val snapshot = RunJson.snapshot(engine!!, now)
        lastPersist = now
        try {
            val file = snapshotFile(this)
            val tmp = File(file.path + ".tmp")
            tmp.writeText(snapshot.toString())
            tmp.renameTo(file)
        } catch (ex: Exception) {
            Log.e(TAG, "Failed to persist run", ex)
        }
        return snapshot
    }

    private fun startInForeground(e: RunEngine, now: Long) {
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION else 0
        ServiceCompat.startForeground(this, NOTIFICATION_ID, buildNotification(e, now), type)
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(CHANNEL_ID, "Run tracking", NotificationManager.IMPORTANCE_LOW).apply {
            description = "Shows your run while it is being recorded"
            setShowBadge(false)
        }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    private fun buildNotification(e: RunEngine, now: Long): Notification {
        val elapsedSec = e.elapsedMs(now) / 1000
        val km = e.totalDistance / 1000
        val pace = if (e.totalDistance > 0) RunEngine.formatTime((elapsedSec / km).toLong()) else "--:--"
        val title = String.format("%.2f km · %s", km, RunEngine.formatTime(elapsedSec))
        var text = "$pace /km"
        val guided = e.config.guided
        if (guided != null && e.guidedIndex in guided.indices) {
            val seg = guided[e.guidedIndex]
            text += " · ${RunEngine.segmentName(seg.type)} ${RunEngine.formatTime(e.guidedRemainingMs(now) / 1000)} left"
        }
        if (e.status == RunEngine.Status.PAUSED) text = "Paused · $text"

        val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        val open = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            flags,
        )
        val paused = e.status == RunEngine.Status.PAUSED
        val toggle = PendingIntent.getService(this, 1, intent(this, if (paused) ACTION_RESUME else ACTION_PAUSE), flags)
        val stop = PendingIntent.getService(this, 2, intent(this, ACTION_STOP), flags)

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_run_notification)
            .setContentTitle(title)
            .setContentText(text)
            .setContentIntent(open)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_WORKOUT)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .addAction(0, if (paused) "Resume" else "Pause", toggle)
            .addAction(0, "Finish", stop)
            .build()
    }
}
