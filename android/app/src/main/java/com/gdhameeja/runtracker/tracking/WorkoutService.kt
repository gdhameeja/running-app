package com.gdhameeja.runtracker.tracking

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import com.gdhameeja.runtracker.MainActivity
import com.gdhameeja.runtracker.R

// Speaks the gym rest timers and timed holds. All the planning is in the web layer (strength.js),
// which hands over what to say and when; timers in a page stop when the screen
// locks, so the waiting has to happen here.
class WorkoutService : Service() {

    data class Cue(val inMs: Long, val text: String)

    companion object {
        const val ACTION_START = "start"
        private const val CHANNEL_ID = "workout"
        private const val NOTIFICATION_ID = 2
        private const val DRAIN_MS = 10_000L

        /** The running service, if any. Only touched on the main thread. */
        var instance: WorkoutService? = null
            private set

        var title = "Workout"

        /** Cues that arrived before the service was up. */
        var pending: Pair<List<Cue>, String>? = null

        fun intent(context: Context, action: String) =
            Intent(context, WorkoutService::class.java).setAction(action)
    }

    private val main = Handler(Looper.getMainLooper())
    private lateinit var speaker: Speaker
    private var wakeLock: PowerManager.WakeLock? = null
    private var label = ""
    private var endsAt = 0L
    private var stopping = false

    private val countdown = object : Runnable {
        override fun run() {
            notifyProgress()
            if (System.currentTimeMillis() < endsAt) main.postDelayed(this, 1000)
        }
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
        speaker = Speaker(this)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(CHANNEL_ID, "Workout", NotificationManager.IMPORTANCE_LOW).apply {
                description = "Shows your rest timer during a workout"
                setShowBadge(false)
            }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE else 0
        ServiceCompat.startForeground(this, NOTIFICATION_ID, buildNotification(), type)
        stopping = false
        if (wakeLock?.isHeld != true) {
            wakeLock = (getSystemService(Context.POWER_SERVICE) as PowerManager)
                .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "RunTracker::workout")
                .apply { acquire(4 * 60 * 60 * 1000L) }
        }
        pending?.let { (cues, text) ->
            pending = null
            schedule(cues, text)
        }
        return START_NOT_STICKY
    }

    /** Replaces whatever was still to be said. */
    fun schedule(cues: List<Cue>, newLabel: String) {
        main.removeCallbacksAndMessages(null)
        val now = System.currentTimeMillis()
        label = newLabel
        endsAt = now + (cues.maxOfOrNull { it.inMs } ?: 0L)
        cues.forEach { cue -> main.postDelayed({ speaker.speak(cue.text) }, cue.inMs) }
        main.post(countdown)
    }

    /** Stops once anything being said has finished. */
    fun finish() {
        if (stopping) return
        stopping = true
        main.removeCallbacksAndMessages(null)
        val stop = Runnable {
            if (stopping) {
                ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
        }
        speaker.whenIdle { stop.run() }
        main.postDelayed(stop, DRAIN_MS)
    }

    override fun onDestroy() {
        main.removeCallbacksAndMessages(null)
        wakeLock?.let { if (it.isHeld) it.release() }
        speaker.shutdown()
        if (instance === this) instance = null
        super.onDestroy()
    }

    private fun notifyProgress() {
        if (!stopping) getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, buildNotification())
    }

    private fun buildNotification(): Notification {
        val left = (endsAt - System.currentTimeMillis() + 999) / 1000
        val open = PendingIntent.getActivity(
            this, 3,
            Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_run_notification)
            .setContentTitle(if (left > 0) "$title · ${RunEngine.formatTime(left)}" else title)
            .setContentText(label)
            .setContentIntent(open)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_WORKOUT)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .build()
    }
}
