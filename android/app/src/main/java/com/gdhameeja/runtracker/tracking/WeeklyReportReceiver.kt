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

// Says on Monday morning that last week's report is ready, and (with "plan" extras)
// that today's planned session is waiting. The report itself is worked out when you
// open it (weekly-report-ui.js): Health Connect only lets an app read while it's on
// screen. The time needn't be exact, so these are inexact alarms, which need no
// special permission. The page sets the plan reminder again whenever anything
// changes, so it only ever points at a session you haven't done.
class WeeklyReportReceiver : BroadcastReceiver() {

    companion object {
        private const val CHANNEL_ID = "weekly_report"
        private const val PLAN_CHANNEL_ID = "plan_reminder"
        private const val NOTIFICATION_ID = 3
        private const val PLAN_NOTIFICATION_ID = 4
        private const val WEEK_MS = 7 * 24 * 60 * 60 * 1000L
        private const val EXTRA_TITLE = "title"
        private const val EXTRA_TEXT = "text"

        private fun pending(context: Context) = PendingIntent.getBroadcast(
            context, 4, Intent(context, WeeklyReportReceiver::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        private fun planPending(context: Context, title: String = "", text: String = "") = PendingIntent.getBroadcast(
            context, 6,
            Intent(context, WeeklyReportReceiver::class.java).putExtra(EXTRA_TITLE, title).putExtra(EXTRA_TEXT, text),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        fun schedule(context: Context, at: Long) {
            context.getSystemService(AlarmManager::class.java).set(AlarmManager.RTC_WAKEUP, at, pending(context))
        }

        fun cancel(context: Context) {
            context.getSystemService(AlarmManager::class.java).cancel(pending(context))
        }

        fun schedulePlan(context: Context, at: Long, title: String, text: String) {
            context.getSystemService(AlarmManager::class.java).set(AlarmManager.RTC_WAKEUP, at, planPending(context, title, text))
        }

        fun cancelPlan(context: Context) {
            context.getSystemService(AlarmManager::class.java).cancel(planPending(context))
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        val manager = context.getSystemService(NotificationManager::class.java)
        val planTitle = intent.getStringExtra(EXTRA_TITLE)
        if (!planTitle.isNullOrEmpty()) return notifyPlan(context, manager, planTitle, intent.getStringExtra(EXTRA_TEXT).orEmpty())
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

    private fun notifyPlan(context: Context, manager: NotificationManager, title: String, text: String) {
        manager.createNotificationChannel(
            NotificationChannel(PLAN_CHANNEL_ID, "Plan reminders", NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = "One reminder on a planned day, only if it isn't done yet"
                setShowBadge(false)
            },
        )
        val open = PendingIntent.getActivity(
            context, 7,
            Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        manager.notify(
            PLAN_NOTIFICATION_ID,
            NotificationCompat.Builder(context, PLAN_CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_run_notification)
                .setContentTitle(title)
                .setContentText(text)
                .setStyle(NotificationCompat.BigTextStyle().bigText(text))
                .setContentIntent(open)
                .setAutoCancel(true)
                .build(),
        )
    }
}
