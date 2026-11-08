package com.gdhameeja.runtracker.tracking

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import com.gdhameeja.runtracker.MainActivity
import com.gdhameeja.runtracker.R

// Says on Monday morning that last week's report is ready. The report itself is
// worked out when you open it (weekly-report-ui.js): Health Connect only lets an
// app read while it's on screen. The time needn't be exact, so it's an inexact
// alarm, which needs no special permission.
class WeeklyReportReceiver : BroadcastReceiver() {

    companion object {
        private const val CHANNEL_ID = "weekly_report"
        private const val NOTIFICATION_ID = 3
        private const val WEEK_MS = 7 * 24 * 60 * 60 * 1000L

        private fun pending(context: Context) = PendingIntent.getBroadcast(
            context, 4, Intent(context, WeeklyReportReceiver::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        fun schedule(context: Context, at: Long) {
            context.getSystemService(AlarmManager::class.java).set(AlarmManager.RTC_WAKEUP, at, pending(context))
        }

        fun cancel(context: Context) {
            context.getSystemService(AlarmManager::class.java).cancel(pending(context))
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "Weekly report", NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = "Says when last week's report is ready"
                setShowBadge(false)
            },
        )
        val open = PendingIntent.getActivity(
            context, 5,
            Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        manager.notify(
            NOTIFICATION_ID,
            NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_run_notification)
                .setContentTitle("Your week is ready")
                .setContentText("See how last week went.")
                .setContentIntent(open)
                .setAutoCancel(true)
                .build(),
        )
        // Opening the app sets the exact Monday again; this covers the weeks it isn't opened
        schedule(context, System.currentTimeMillis() + WEEK_MS)
    }
}
