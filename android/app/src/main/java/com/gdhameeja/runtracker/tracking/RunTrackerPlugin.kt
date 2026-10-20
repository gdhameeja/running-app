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
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import org.json.JSONObject
import java.io.File

// JS bridge to RunTrackerService (see native-tracker.js for the web side).
@CapacitorPlugin(
    name = "RunTracker",
    permissions = [
        Permission(
            alias = "location",
            strings = [Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION],
        ),
        Permission(alias = "notifications", strings = [Manifest.permission.POST_NOTIFICATIONS]),
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
        if (getPermissionState("location") != PermissionState.GRANTED) {
            val aliases = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                arrayOf("location", "notifications")
            } else arrayOf("location")
            requestPermissionForAliases(aliases, call, "startAfterPermissions")
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
            RunTrackerService.pendingConfig = config
            ContextCompat.startForegroundService(context, RunTrackerService.intent(context, RunTrackerService.ACTION_START))
            call.resolve()
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
            }
            call.resolve()
        }
    }

    // ─── Backups and updates (sync.js) ───────────────────────────────────────

    /** Saves `text` as `name` in Downloads; resolves with `{ location }` to show the user. */
    @PluginMethod
    fun saveFile(call: PluginCall) {
        val name = call.getString("name") ?: return call.reject("Missing name")
        val text = call.getString("text") ?: return call.reject("Missing text")
        Thread {
            try {
                call.resolve(JSObject().put("location", writeDownload(name, text.toByteArray())))
            } catch (e: Exception) {
                call.reject("Could not save the file: ${e.message}")
            }
        }.start()
    }

    private fun writeDownload(name: String, bytes: ByteArray): String {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val values = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, name)
                put(MediaStore.Downloads.MIME_TYPE, "application/json")
            }
            val resolver = context.contentResolver
            val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                ?: throw IllegalStateException("No Downloads folder")
            resolver.openOutputStream(uri)?.use { it.write(bytes) } ?: throw IllegalStateException("Could not open $uri")
            return "Downloads/$name"
        }
        // Before Android 10 public Downloads needs a storage permission; the app's own folder doesn't
        val dir = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS) ?: context.filesDir
        File(dir, name).writeBytes(bytes)
        return File(dir, name).absolutePath
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
