package com.gdhameeja.runtracker.tracking

import android.Manifest
import android.annotation.SuppressLint
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.provider.MediaStore
import android.provider.Settings
import android.util.Log
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import androidx.activity.result.ActivityResult
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.io.File
import java.io.OutputStream
import java.time.Instant

// JS bridge to RunTrackerService (see native-tracker.js for the web side).
@CapacitorPlugin(
    name = "RunTracker",
    permissions = [
        Permission(
            alias = "location",
            strings = [Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION],
        ),
        Permission(alias = "notifications", strings = [Manifest.permission.POST_NOTIFICATIONS]),
        // Step counter, for cadence
        Permission(alias = "activity", strings = [Manifest.permission.ACTIVITY_RECOGNITION]),
    ],
)
class RunTrackerPlugin : Plugin() {

    private val main = Handler(Looper.getMainLooper())
    private var speaker: Speaker? = null
    private val ar by lazy { ArSensors(context) { notifyListeners("orientation", JSObject(it.toString())) } }

    override fun load() {
        RunTrackerService.listener = { summary -> notifyListeners("update", JSObject(summary.toString())) }
    }

    override fun handleOnDestroy() {
        RunTrackerService.listener = null
        speaker?.shutdown()
        ar.stop()
    }

    override fun handleOnPause() {
        ar.stop()
    }

    @PluginMethod
    fun start(call: PluginCall) {
        val aliases = mutableListOf<String>()
        if (getPermissionState("location") != PermissionState.GRANTED) aliases += "location"
        val prefs = context.getSharedPreferences("run_tracker", Context.MODE_PRIVATE)
        // Asked once, and not tied to location: the map's first GPS request usually
        // gets location granted before anyone taps Start. Without this, no notification.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && getPermissionState("notifications") != PermissionState.GRANTED &&
            !prefs.getBoolean("notificationsAsked", false)
        ) {
            prefs.edit().putBoolean("notificationsAsked", true).apply()
            aliases += "notifications"
        }
        // Asked once; runs work without it, just with no cadence
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && getPermissionState("activity") != PermissionState.GRANTED &&
            !prefs.getBoolean("activityAsked", false)
        ) {
            prefs.edit().putBoolean("activityAsked", true).apply()
            aliases += "activity"
        }
        if (aliases.isNotEmpty()) {
            requestPermissionForAliases(aliases.toTypedArray(), call, "startAfterPermissions")
            return
        }
        startService(call)
    }

    @PermissionCallback
    private fun startAfterPermissions(call: PluginCall) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            call.reject("Location permission denied", "PERMISSION_DENIED")
            return
        }
        startService(call)
    }

    private fun startService(call: PluginCall) {
        val config = try {
            RunJson.parseConfig(call.data)
        } catch (e: Exception) {
            call.reject("Invalid run config: ${e.message}")
            return
        }
        main.post {
            val active = RunTrackerService.instance?.engine
            if (active != null && active.status != RunEngine.Status.FINISHED) {
                call.reject("A run is already in progress", "RUN_IN_PROGRESS")
                return@post
            }
            try {
                RunTrackerService.configFile(context).writeText(call.data.toString())
            } catch (e: Exception) {
                Log.w("RunTrackerPlugin", "Could not save the run config; this run can't be carried on if the app is killed", e)
            }
            RunTrackerService.pendingConfig = config
            ContextCompat.startForegroundService(context, RunTrackerService.intent(context, RunTrackerService.ACTION_START))
            call.resolve()
        }
    }

    /** Carries on with a run whose service died; resolves with `{ run }`, paused until you tap Resume. */
    @PluginMethod
    fun resumeInterrupted(call: PluginCall) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            call.reject("Location permission denied", "PERMISSION_DENIED")
            return
        }
        main.post {
            val active = RunTrackerService.instance?.engine
            if (active != null && active.status != RunEngine.Status.FINISHED) {
                call.reject("A run is already in progress", "RUN_IN_PROGRESS")
                return@post
            }
            val restored = try {
                val config = RunJson.parseConfig(JSONObject(RunTrackerService.configFile(context).readText()))
                RunJson.restore(JSONObject(RunTrackerService.snapshotFile(context).readText()), config)
            } catch (e: Exception) {
                call.reject("Could not read the saved run: ${e.message}")
                return@post
            }
            RunTrackerService.pendingRestore = restored
            ContextCompat.startForegroundService(context, RunTrackerService.intent(context, RunTrackerService.ACTION_RESTORE))
            call.resolve(JSObject().put("run", RunJson.snapshot(restored, System.currentTimeMillis())))
        }
    }

    @PluginMethod
    fun pause(call: PluginCall) {
        main.post {
            RunTrackerService.instance?.pauseRun()
            call.resolve()
        }
    }

    @PluginMethod
    fun resume(call: PluginCall) {
        main.post {
            RunTrackerService.instance?.resumeRun()
            call.resolve()
        }
    }

    /** Ends the run; resolves with `{ run }`, the final snapshot (null if nothing was running). */
    @PluginMethod
    fun stop(call: PluginCall) {
        main.post {
            call.resolve(JSObject().put("run", RunTrackerService.instance?.stopRun() ?: currentState()))
        }
    }

    /**
     * Resolves with `{ run }`: the live run, the last finished run not yet cleared,
     * or a run whose service died (status "orphaned"). `run` is null when there is none.
     */
    @PluginMethod
    fun getState(call: PluginCall) {
        main.post {
            call.resolve(JSObject().put("run", currentState() ?: JSONObject.NULL))
        }
    }

    /** Forgets the stored snapshot once the web layer has saved it. */
    @PluginMethod
    fun clear(call: PluginCall) {
        main.post {
            val active = RunTrackerService.instance?.engine
            if (active == null || active.status == RunEngine.Status.FINISHED) {
                RunTrackerService.snapshotFile(context).delete()
                RunTrackerService.configFile(context).delete()
            }
            call.resolve()
        }
    }

    // ─── Gym voice (strength.js) ──────────────────────────────────────────────

    @PluginMethod
    fun workoutStart(call: PluginCall) {
        val title = call.getString("title") ?: "Workout"
        main.post {
            WorkoutService.title = title
            ContextCompat.startForegroundService(context, WorkoutService.intent(context, WorkoutService.ACTION_START))
            call.resolve()
        }
    }

    /** Replaces what's still to be said: `{ cues: [{ inMs, text }], label }`. */
    @PluginMethod
    fun workoutCues(call: PluginCall) {
        val array = call.getArray("cues") ?: return call.reject("Missing cues")
        val cues = (0 until array.length()).map {
            val c = array.getJSONObject(it)
            WorkoutService.Cue(c.getLong("inMs"), c.getString("text"))
        }
        val label = call.getString("label") ?: ""
        main.post {
            val service = WorkoutService.instance
            if (service != null) service.schedule(cues, label) else WorkoutService.pending = cues to label
            call.resolve()
        }
    }

    @PluginMethod
    fun workoutStop(call: PluginCall) {
        main.post {
            WorkoutService.pending = null
            WorkoutService.instance?.finish()
            call.resolve()
        }
    }

    // ─── The Monday notification (weekly-report-ui.js) ───────────────────────

    @PluginMethod
    fun reportReminder(call: PluginCall) {
        val at = call.getLong("at") ?: return call.reject("Missing at")
        WeeklyReportReceiver.schedule(context, at)
        call.resolve()
    }

    @PluginMethod
    fun reportReminderOff(call: PluginCall) {
        WeeklyReportReceiver.cancel(context)
        call.resolve()
    }

    // ─── Health Connect (watch heart rate, sleep, resting HR; enrich.js) ─────

    private val health by lazy { HealthBridge(context) }
    private val io = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    /** Resolves with `{ status, granted }`: status "available", "update_required" or "unavailable". */
    @PluginMethod
    fun healthStatus(call: PluginCall) {
        val status = health.status()
        if (status != "available") return call.resolve(JSObject().put("status", status).put("granted", false))
        io.launch {
            val granted = try { health.granted().containsAll(HealthBridge.READ) } catch (e: Exception) { false }
            call.resolve(JSObject().put("status", status).put("granted", granted))
        }
    }

    /** Shows Health Connect's permission screen; resolves with `{ granted }`. */
    @PluginMethod
    fun healthRequest(call: PluginCall) {
        when (health.status()) {
            "available" -> startActivityForResult(call, health.permissionIntent(), "healthPermissionResult")
            "update_required" -> {
                // Android 13 and older: Health Connect is an app from the Play Store
                val uri = Uri.parse("market://details?id=com.google.android.apps.healthdata&url=healthconnect%3A%2F%2Fonboarding")
                try {
                    context.startActivity(Intent(Intent.ACTION_VIEW, uri).setPackage("com.android.vending").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                } catch (e: Exception) { /* no Play Store */ }
                call.resolve(JSObject().put("granted", false).put("status", "update_required"))
            }
            else -> call.resolve(JSObject().put("granted", false).put("status", "unavailable"))
        }
    }

    @ActivityCallback
    private fun healthPermissionResult(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        io.launch {
            val granted = try { health.granted().containsAll(HealthBridge.READ) } catch (e: Exception) { false }
            call.resolve(JSObject().put("granted", granted).put("status", "available"))
        }
    }

    /** `{ start, end }` (epoch ms) -> `{ hr: [[epochMs, bpm], ...] }`. */
    @PluginMethod
    fun healthHeartRate(call: PluginCall) {
        val start = call.getLong("start") ?: return call.reject("Missing start")
        val end = call.getLong("end") ?: return call.reject("Missing end")
        io.launch {
            try {
                call.resolve(JSObject().put("hr", health.heartRate(Instant.ofEpochMilli(start), Instant.ofEpochMilli(end))))
            } catch (e: Exception) {
                call.reject("Health Connect: ${e.message}")
            }
        }
    }

    /** `{ start, end }` (epoch ms) -> `{ sleep: [[startMs, endMs]], resting: [[epochMs, bpm]] }`. */
    @PluginMethod
    fun healthDaily(call: PluginCall) {
        val start = Instant.ofEpochMilli(call.getLong("start") ?: return call.reject("Missing start"))
        val end = Instant.ofEpochMilli(call.getLong("end") ?: return call.reject("Missing end"))
        io.launch {
            try {
                call.resolve(JSObject().put("sleep", health.sleep(start, end)).put("resting", health.restingHeartRate(start, end)))
            } catch (e: Exception) {
                call.reject("Health Connect: ${e.message}")
            }
        }
    }

    // ─── Backups and updates (sync.js) ───────────────────────────────────────

    // A file in Downloads written a piece at a time: the whole history would be
    // too big for one message from the page. One at a time; each call is awaited.
    private var fileOut: OutputStream? = null
    private var fileUri: Uri? = null
    private var filePath: File? = null
    private var fileLocation = ""

    @PluginMethod
    fun fileStart(call: PluginCall) {
        val name = call.getString("name") ?: return call.reject("Missing name")
        io.launch {
            try {
                discardFile()
                openDownload(name)
                call.resolve()
            } catch (e: Exception) {
                call.reject("Could not save the file: ${e.message}")
            }
        }
    }

    @PluginMethod
    fun fileAppend(call: PluginCall) {
        val text = call.getString("text") ?: return call.reject("Missing text")
        io.launch {
            try {
                (fileOut ?: throw IllegalStateException("No file open")).write(text.toByteArray())
                call.resolve()
            } catch (e: Exception) {
                call.reject("Could not save the file: ${e.message}")
            }
        }
    }

    /** Resolves with `{ location }` to show the user. */
    @PluginMethod
    fun fileFinish(call: PluginCall) {
        io.launch {
            try {
                (fileOut ?: throw IllegalStateException("No file open")).close()
                fileOut = null
                fileUri = null
                filePath = null
                call.resolve(JSObject().put("location", fileLocation))
            } catch (e: Exception) {
                call.reject("Could not save the file: ${e.message}")
            }
        }
    }

    @PluginMethod
    fun fileCancel(call: PluginCall) {
        io.launch {
            discardFile()
            call.resolve()
        }
    }

    private fun openDownload(name: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val values = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, name)
                put(MediaStore.Downloads.MIME_TYPE, "application/json")
            }
            val resolver = context.contentResolver
            val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                ?: throw IllegalStateException("No Downloads folder")
            fileUri = uri
            fileOut = resolver.openOutputStream(uri) ?: throw IllegalStateException("Could not open $uri")
            fileLocation = "Downloads/$name"
            return
        }
        // Before Android 10 public Downloads needs a storage permission; the app's own folder doesn't
        val dir = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS) ?: context.filesDir
        val file = File(dir, name)
        filePath = file
        fileOut = file.outputStream()
        fileLocation = file.absolutePath
    }

    /** Drops a half-written file, so a failed backup can't be mistaken for a good one. */
    private fun discardFile() {
        try { fileOut?.close() } catch (e: Exception) { /* going anyway */ }
        fileOut = null
        fileUri?.let { uri -> try { context.contentResolver.delete(uri, null, null) } catch (e: Exception) { /* going anyway */ } }
        fileUri = null
        filePath?.delete()
        filePath = null
    }

    /** Opens a link in the browser (the APK download for an update). */
    @PluginMethod
    fun openUrl(call: PluginCall) {
        val url = call.getString("url") ?: return call.reject("Missing url")
        try {
            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            call.resolve()
        } catch (e: Exception) {
            call.reject("No app can open $url")
        }
    }

    /** Resolves with `{ versionCode, versionName }` of the installed app. */
    @PluginMethod
    fun appInfo(call: PluginCall) {
        val info = context.packageManager.getPackageInfo(context.packageName, 0)
        @Suppress("DEPRECATION")
        val code = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) info.longVersionCode else info.versionCode.toLong()
        call.resolve(JSObject().put("versionCode", code).put("versionName", info.versionName ?: ""))
    }

    @PluginMethod
    fun speak(call: PluginCall) {
        main.post {
            val text = call.getString("text")
            if (!text.isNullOrBlank()) {
                (speaker ?: Speaker(context).also { speaker = it }).speak(text)
            }
            call.resolve()
        }
    }

    // ─── AR ghost view ───────────────────────────────────────────────────────

    /** Starts "orientation" events: `{ q: [x, y, z, w], headingAccuracy, status }`. */
    @PluginMethod
    fun startOrientation(call: PluginCall) {
        main.post {
            if (ar.start()) call.resolve() else call.reject("No rotation vector sensor", "UNAVAILABLE")
        }
    }

    @PluginMethod
    fun stopOrientation(call: PluginCall) {
        main.post {
            ar.stop()
            call.resolve()
        }
    }

    /** Resolves with `{ declination, camera }`; either is null when unknown. */
    @PluginMethod
    fun getArInfo(call: PluginCall) {
        val lat = call.getDouble("lat")
        val lon = call.getDouble("lon")
        val result = JSObject()
        result.put("declination", if (lat != null && lon != null) ar.declination(lat, lon) else JSONObject.NULL)
        result.put("camera", try {
            ar.cameraOptics(call.getString("cameraId")) ?: JSONObject.NULL
        } catch (e: Exception) {
            JSONObject.NULL
        })
        call.resolve(result)
    }

    @PluginMethod
    fun isIgnoringBatteryOptimizations(call: PluginCall) {
        call.resolve(JSObject().put("value", ignoringBatteryOptimizations()))
    }

    /** Asks the user to exempt the app from battery optimisation so aggressive OEM task killers leave runs alone. */
    @SuppressLint("BatteryLife")
    @PluginMethod
    fun requestBatteryExemption(call: PluginCall) {
        if (!ignoringBatteryOptimizations() && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
                .setData(Uri.parse("package:${context.packageName}"))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            try {
                context.startActivity(intent)
            } catch (e: Exception) {
                context.startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            }
        }
        call.resolve()
    }

    private fun ignoringBatteryOptimizations(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true
        val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        return pm.isIgnoringBatteryOptimizations(context.packageName)
    }

    private fun currentState(): JSONObject? {
        val engine = RunTrackerService.instance?.engine
        if (engine != null) return RunJson.snapshot(engine, System.currentTimeMillis())
        val file = RunTrackerService.snapshotFile(context)
        if (!file.exists()) return null
        return try {
            JSONObject(file.readText()).apply {
                if (optString("status") != "finished") put("status", "orphaned")
            }
        } catch (e: Exception) {
            null
        }
    }
}
