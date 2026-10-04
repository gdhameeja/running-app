package com.gdhameeja.runtracker.tracking

import android.content.Context
import android.hardware.GeomagneticField
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.max
import kotlin.math.sqrt

// Sensors for the AR ghost view (ar-ghost.js). The page could read
// `deviceorientationabsolute`, but going native guarantees the fused rotation
// vector, adds its heading accuracy, and lets us report true north and the
// camera's real field of view.
class ArSensors(context: Context, private val onOrientation: (JSONObject) -> Unit) : SensorEventListener {

    private val sensors = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private val cameras = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
    private var running = false
    private var accuracyStatus = SensorManager.SENSOR_STATUS_ACCURACY_HIGH

    /** Starts streaming orientation. Returns false if the phone has no rotation vector sensor. */
    fun start(): Boolean {
        if (running) return true
        val sensor = sensors.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR) ?: return false
        running = sensors.registerListener(this, sensor, SensorManager.SENSOR_DELAY_GAME)
        return running
    }

    fun stop() {
        if (!running) return
        sensors.unregisterListener(this)
        running = false
    }

    override fun onSensorChanged(event: SensorEvent) {
        val v = event.values
        val w = if (v.size > 3) v[3] else sqrt(max(0f, 1 - v[0] * v[0] - v[1] * v[1] - v[2] * v[2]))
        // values[4] is the estimated heading accuracy in radians, -1 when unknown
        val headingAccuracy = if (v.size > 4 && v[4] >= 0) Math.toDegrees(v[4].toDouble()) else null
        onOrientation(JSONObject().apply {
            put("q", JSONArray().put(v[0].toDouble()).put(v[1].toDouble()).put(v[2].toDouble()).put(w.toDouble()))
            put("headingAccuracy", headingAccuracy ?: JSONObject.NULL)
            put("status", accuracyStatus)
        })
    }

    override fun onAccuracyChanged(sensor: Sensor, accuracy: Int) {
        accuracyStatus = accuracy
    }

    /** Magnetic declination in degrees (east positive) at a location. */
    fun declination(lat: Double, lon: Double): Double =
        GeomagneticField(lat.toFloat(), lon.toFloat(), 0f, System.currentTimeMillis()).declination.toDouble()

    /**
     * Optics of a rear camera: focal length and the active sensor area in mm.
     * Uses `cameraId` when the WebView told us which camera it opened, otherwise
     * the first rear camera (the one the WebView picks by default).
     */
    fun cameraOptics(cameraId: String?): JSONObject? {
        val ids = cameras.cameraIdList
        val id = cameraId?.takeIf { it in ids } ?: ids.firstOrNull {
            cameras.getCameraCharacteristics(it).get(CameraCharacteristics.LENS_FACING) == CameraCharacteristics.LENS_FACING_BACK
        } ?: return null
        val ch = cameras.getCameraCharacteristics(id)
        val focal = ch.get(CameraCharacteristics.LENS_INFO_AVAILABLE_FOCAL_LENGTHS)?.firstOrNull() ?: return null
        val physical = ch.get(CameraCharacteristics.SENSOR_INFO_PHYSICAL_SIZE) ?: return null
        val pixels = ch.get(CameraCharacteristics.SENSOR_INFO_PIXEL_ARRAY_SIZE)
        val active = ch.get(CameraCharacteristics.SENSOR_INFO_ACTIVE_ARRAY_SIZE)
        // The output comes from the active array, which can be a little smaller than the whole sensor
        val scaleW = if (pixels != null && active != null && pixels.width > 0) active.width().toDouble() / pixels.width else 1.0
        val scaleH = if (pixels != null && active != null && pixels.height > 0) active.height().toDouble() / pixels.height else 1.0
        return JSONObject().apply {
            put("cameraId", id)
            put("focalMm", focal.toDouble())
            put("sensorW", physical.width * scaleW)
            put("sensorH", physical.height * scaleH)
        }
    }
}
