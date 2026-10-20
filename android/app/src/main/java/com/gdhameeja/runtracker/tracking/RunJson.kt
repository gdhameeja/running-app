package com.gdhameeja.runtracker.tracking

import org.json.JSONArray
import org.json.JSONObject

// JSON shapes shared with native-tracker.js. Field names match the run records
// that script.js stores in IndexedDB so the web layer can save them as-is.
object RunJson {

    fun parseConfig(json: JSONObject): RunConfig = RunConfig(
        runId = json.getLong("runId"),
        previousTimeSeries = json.optJSONArray("previousTimeSeries")?.let(::parseTimeSeries),
        ghost = json.optJSONObject("ghost")?.let {
            val target = if (it.has("targetM")) it.getDouble("targetM") else it.getInt("targetKm") * 1000.0
            GhostConfig(target, parseTimeSeries(it.getJSONArray("timeSeries")))
        },
        guided = json.optJSONArray("guided")?.let { arr ->
            (0 until arr.length()).map {
                val s = arr.getJSONObject(it)
                GuidedSegment(
                    type = s.getString("type"),
                    durationSec = s.getInt("durationSec"),
                    intensity = s.optString("intensity"),
                    label = s.optNullableString("label"),
                    say = s.optNullableString("say"),
                    role = s.optNullableString("role"),
                    pace = if (s.has("pace") && !s.isNull("pace")) s.getDouble("pace") else null,
                )
            }
        },
        meta = json.optString("meta").ifEmpty { null },
    )

    private fun JSONObject.optNullableString(key: String): String? =
        if (has(key) && !isNull(key)) getString(key).ifEmpty { null } else null

    private fun parseTimeSeries(arr: JSONArray): List<TimePoint> = (0 until arr.length()).map {
        val p = arr.getJSONObject(it)
        TimePoint(
            distance = p.getDouble("distance"),
            time = p.getLong("time"),
            lat = if (p.has("lat") && !p.isNull("lat")) p.getDouble("lat") else null,
            lng = if (p.has("lng") && !p.isNull("lng")) p.getDouble("lng") else null,
            pace = p.optDouble("pace", 0.0),
        )
    }

    private fun point(p: LatLng) = JSONArray().put(p.lat).put(p.lng)

    /** Small per-update payload; the full path is only sent by [snapshot]. */
    fun summary(e: RunEngine, now: Long): JSONObject = JSONObject().apply {
        put("runId", e.config.runId)
        put("status", e.status.name.lowercase())
        put("startTime", e.startedAt)
        put("elapsedMs", e.elapsedMs(now))
        put("distance", e.totalDistance)
        put("estimatedDistance", e.estimatedDistance)
        put("accuracy", e.lastAccuracy ?: JSONObject.NULL)
        put("pointCount", e.pointCount)
        put("segmentCount", e.pathSegments.size)
        put("gapCount", e.gapCoords.size)
        put("lastPoint", e.lastPoint?.let(::point) ?: JSONObject.NULL)
        put("speed", e.lastSpeed ?: JSONObject.NULL)
        put("bearing", e.lastBearing ?: JSONObject.NULL)
        put("motionAgeMs", e.lastMotionAt?.let { now - it } ?: JSONObject.NULL)
        put("currentSpeed", e.currentSpeed ?: JSONObject.NULL)
        put("currentSpeedAgeMs", e.currentSpeedAt?.let { now - it } ?: JSONObject.NULL)
        put("cadence", e.cadence(now) ?: JSONObject.NULL)
        if (e.config.guided != null) {
            put("guided", JSONObject().apply {
                put("index", e.guidedIndex)
                put("remainingMs", e.guidedRemainingMs(now))
                put("completed", e.guidedCompleted)
            })
        }
        if (e.config.ghost != null) put("ghostWon", e.ghostWon ?: JSONObject.NULL)
        e.coach?.let { c ->
            val active = e.coachActive
            put("coach", JSONObject().apply {
                put("active", active)
                put("role", c.role ?: JSONObject.NULL)
                put("target", (if (active) c.pace() else null) ?: JSONObject.NULL)
                put("now", (if (active) c.now else null) ?: JSONObject.NULL)
                put("status", (if (active) c.status else null) ?: JSONObject.NULL)
                put("eases", c.eases)
                put("instruction", (if (active) c.instruction() else null) ?: JSONObject.NULL)
            })
        }
        put("meta", e.config.meta ?: JSONObject.NULL)
    }

    fun snapshot(e: RunEngine, now: Long): JSONObject = summary(e, now).apply {
        put("endTime", e.endTime ?: JSONObject.NULL)
        put("pathSegments", JSONArray().apply {
            e.pathSegments.forEach { seg -> put(JSONArray().apply { seg.forEach { put(point(it)) } }) }
        })
        put("gapCoords", JSONArray().apply {
            e.gapCoords.forEach { (a, b) -> put(JSONArray().put(point(a)).put(point(b))) }
        })
        put("timeSeries", JSONArray().apply {
            e.timeSeries.forEach {
                put(JSONObject().put("distance", it.distance).put("time", it.time)
                    .put("lat", it.lat).put("lng", it.lng).put("pace", it.pace))
            }
        })
        put("track", JSONArray().apply { e.track.forEach { put(trackPoint(it)) } })
        put("raw", JSONArray().apply { e.raw.forEach { put(rawFix(it)) } })
        put("steps", JSONArray().apply { e.steps.forEach { (t, n) -> put(JSONArray().put(t).put(n)) } })
        put("pauses", JSONArray().apply { e.pauses.forEach { (at, ms) -> put(JSONArray().put(at).put(ms)) } })
        put("coachLog", JSONArray().apply { e.coachLog.forEach { (t, text) -> put(JSONArray().put(t).put(text)) } })
        e.coach?.let { c ->
            put("coachResults", JSONObject().apply {
                put("eases", c.eases)
                put("parts", JSONArray().apply {
                    c.results.forEach { r ->
                        put(JSONArray().put(r.index).put(r.target).put(r.actual?.let { round(it, 10.0) } ?: JSONObject.NULL))
                    }
                })
            })
        }
    }

    /** `[timeMs, distanceM, lat, lng, speed|null, bearing|null, altitude|null]`, rounded to keep runs small (same as script.js). */
    fun trackPoint(p: TrackPoint): JSONArray = JSONArray()
        .put(p.time)
        .put(round(p.distance, 10.0))
        .put(round(p.lat, 1e7))
        .put(round(p.lng, 1e7))
        .put(p.speed?.let { round(it, 100.0) } ?: JSONObject.NULL)
        .put(p.bearing?.let { round(it, 10.0) } ?: JSONObject.NULL)
        .put(p.altitude?.let { round(it, 10.0) } ?: JSONObject.NULL)

    /** `[timeMs, lat, lng, accuracy|null, altitude|null, speed|null, bearing|null]` (same as script.js). */
    fun rawFix(f: RawFix): JSONArray = JSONArray()
        .put(f.time)
        .put(round(f.lat, 1e7))
        .put(round(f.lng, 1e7))
        .put(f.accuracy?.let { round(it, 10.0) } ?: JSONObject.NULL)
        .put(f.altitude?.let { round(it, 10.0) } ?: JSONObject.NULL)
        .put(f.speed?.let { round(it, 100.0) } ?: JSONObject.NULL)
        .put(f.bearing?.let { round(it, 10.0) } ?: JSONObject.NULL)

    private fun round(v: Double, scale: Double) = Math.round(v * scale) / scale
}
