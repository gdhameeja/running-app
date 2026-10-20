package com.gdhameeja.runtracker.tracking

import android.content.Context
import android.content.Intent
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.HealthConnectFeatures
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import org.json.JSONArray
import java.time.Instant
import kotlin.reflect.KClass

/**
 * Reads what your watch app (Zepp Life, Fitbit, ...) writes to Health Connect:
 * heart rate during runs, and sleep and resting heart rate for how recovered
 * you are. Read-only; nothing is written back.
 */
class HealthBridge(private val context: Context) {

    companion object {
        val READ = setOf(
            HealthPermission.getReadPermission(HeartRateRecord::class),
            HealthPermission.getReadPermission(SleepSessionRecord::class),
            HealthPermission.getReadPermission(RestingHeartRateRecord::class),
        )
    }

    /** "available", "update_required" (Health Connect needs installing or updating) or "unavailable". */
    fun status(): String = when (HealthConnectClient.getSdkStatus(context)) {
        HealthConnectClient.SDK_AVAILABLE -> "available"
        HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "update_required"
        else -> "unavailable"
    }

    private val client by lazy { HealthConnectClient.getOrCreate(context) }

    /** The permissions to ask for: plus history older than 30 days where the phone supports it. */
    fun wanted(): Set<String> {
        val history = client.features.getFeatureStatus(HealthConnectFeatures.FEATURE_READ_HEALTH_DATA_HISTORY) ==
            HealthConnectFeatures.FEATURE_STATUS_AVAILABLE
        return if (history) READ + HealthPermission.PERMISSION_READ_HEALTH_DATA_HISTORY else READ
    }

    fun permissionIntent(): Intent =
        PermissionController.createRequestPermissionResultContract().createIntent(context, wanted())

    suspend fun granted(): Set<String> = client.permissionController.getGrantedPermissions()

    private suspend fun <T : Record> readAll(type: KClass<T>, start: Instant, end: Instant): List<T> {
        val out = mutableListOf<T>()
        var token: String? = null
        do {
            val res = client.readRecords(ReadRecordsRequest(type, TimeRangeFilter.between(start, end), pageToken = token))
            out += res.records
            token = res.pageToken
        } while (token != null)
        return out
    }

    /** Heart-rate samples between two instants: `[[epochMs, bpm], ...]`, oldest first. */
    suspend fun heartRate(start: Instant, end: Instant): JSONArray {
        val samples = readAll(HeartRateRecord::class, start, end)
            .flatMap { r -> r.samples.map { it.time.toEpochMilli() to it.beatsPerMinute } }
            .filter { (t, _) -> t >= start.toEpochMilli() && t <= end.toEpochMilli() }
            .sortedBy { it.first }
        return JSONArray().apply { samples.forEach { (t, bpm) -> put(JSONArray().put(t).put(bpm)) } }
    }

    /** Sleep sessions `[[startMs, endMs], ...]` that ended in the window. */
    suspend fun sleep(start: Instant, end: Instant): JSONArray = JSONArray().apply {
        readAll(SleepSessionRecord::class, start, end).sortedBy { it.startTime }.forEach {
            put(JSONArray().put(it.startTime.toEpochMilli()).put(it.endTime.toEpochMilli()))
        }
    }

    /** Resting heart rate readings `[[epochMs, bpm], ...]`. */
    suspend fun restingHeartRate(start: Instant, end: Instant): JSONArray = JSONArray().apply {
        readAll(RestingHeartRateRecord::class, start, end).sortedBy { it.time }.forEach {
            put(JSONArray().put(it.time.toEpochMilli()).put(it.beatsPerMinute))
        }
    }
}
