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
                    game = s.optNullableString("game"),
                    chaser = s.optNullableString("chaser"),
                )
            }
        },
        meta = json.optString("meta").ifEmpty { null },
        funRef = json.optJSONObject("fun")?.let {
            FunRef(it.optNum("easyPace"), it.optNum("bestBurst"), it.optNum("lastBurst"), it.optNum("bestFinish"), it.optNum("bestSteps")?.toInt())
        },
    )

    private fun JSONObject.optNum(key: String): Double? = if (has(key) && !isNull(key)) getDouble(key) else null

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
        put("gpsLost", e.gpsLost)
        if (e.config.guided != null) {
            put("guided", JSONObject().apply {
                put("index", e.guidedIndex)
                put("remainingMs", e.guidedRemainingMs(now))
                put("completed", e.guidedCompleted)
            })
        }
        if (e.config.ghost != null) put("ghostWon", e.ghostWon ?: JSONObject.NULL)
        e.funCoach?.chaseState(e.elapsedMs(now), e.totalDistance)?.let { (who, gap, caught) ->
            put("chase", JSONObject().put("chaser", who).put("gap", gap).put("caught", caught))
        }
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
    }

    fun snapshot(e: RunEngine, now: Long): JSONObject = summary(e, now).apply {
        put("meta", e.config.meta ?: JSONObject.NULL)
        put("endTime", e.endTime ?: JSONObject.NULL)
        put("savedAt", now)
        put("engine", engineState(e))
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
        e.funCoach?.let { put("funResults", funResults(it)) }
    }

    private fun funResults(f: FunCoach): JSONObject = JSONObject().apply {
        put("bursts", JSONArray().apply { f.results.bursts.forEach { (i, p) -> put(JSONArray().put(i).put(p)) } })
        put("finish", f.results.finish ?: JSONObject.NULL)
        put("escaped", f.results.escaped)
        put("caught", f.results.caught)
        put("steps", JSONArray().apply { f.results.steps.forEach { (i, n) -> put(JSONArray().put(i).put(n)) } })
    }

    private fun engineState(e: RunEngine): JSONObject {
        val s = e.state()
        return JSONObject().apply {
            put("nextMilestone", s.nextMilestone)
            put("splitStartMs", s.splitStartMs)
            put("lastTimeSeriesDistance", s.lastTimeSeriesDistance)
            put("lastTimeSeriesMs", s.lastTimeSeriesMs)
            put("stepCount", s.stepCount)
            put("guidedIndex", s.guidedIndex)
            put("guidedStarted", s.guidedStarted)
            put("guidedCompleted", s.guidedCompleted)
            put("ghostWon", s.ghostWon ?: JSONObject.NULL)
            put("cueDistance", s.cueDistance)
            put("cueGap", s.cueGap)
            put("cueAtMs", s.cueAtMs)
            put("cueLeader", s.cueLeader ?: JSONObject.NULL)
            put("ghostDoneAnnounced", s.ghostDoneAnnounced)
            put("everFixed", s.everFixed)
            put("pausedAt", s.pausedAt)
            e.funCoach?.let { f ->
                put("fun", JSONObject().apply {
                    put("seg", f.seg)
                    f.start?.let { st -> put("start", JSONArray().put(st.t).put(st.dist).put(st.steps ?: JSONObject.NULL)) }
                    f.chase?.let { c -> put("chase", JSONArray().put(c.speed).put(c.saidAt).put(c.close).put(c.caught)) }
                    put("results", funResults(f))
                    put("ref", JSONArray().put(f.bestBurst ?: JSONObject.NULL).put(f.lastBurst ?: JSONObject.NULL)
                        .put(f.bestFinish ?: JSONObject.NULL).put(f.bestSteps ?: JSONObject.NULL))
                })
            }
            e.coach?.state()?.let { c ->
                put("coach", JSONObject().apply {
                    put("scale", c.scale)
                    put("eases", c.eases)
                    put("misses", c.misses)
                    put("seg", c.seg)
                    put("segStart", c.segStart)
                    put("segStartDist", c.segStartDist)
                    put("nextCheckAt", c.nextCheckAt)
                    put("results", JSONArray().apply {
                        c.results.forEach { r -> put(JSONArray().put(r.index).put(r.target).put(r.actual ?: JSONObject.NULL)) }
                    })
                })
            }
        }
    }

    private fun JSONArray.arrays(): List<JSONArray> = (0 until length()).map { getJSONArray(it) }

    private fun JSONArray.optNumber(i: Int): Double? = if (isNull(i)) null else getDouble(i)

    /**
     * Rebuilds a run from its last [snapshot] (with `engine` state) and the [config]
     * it started with. It comes back paused; see [RunEngine.restore].
     */
    fun restore(snapshot: JSONObject, config: RunConfig): RunEngine {
        val st = snapshot.getJSONObject("engine")
        val e = RunEngine(config, snapshot.getLong("startTime"))

        e.pathSegments.clear()
        snapshot.getJSONArray("pathSegments").arrays().forEach { seg ->
            e.pathSegments.add(seg.arrays().map { LatLng(it.getDouble(0), it.getDouble(1)) }.toMutableList())
        }
        if (e.pathSegments.isEmpty()) e.pathSegments.add(mutableListOf())
        snapshot.getJSONArray("gapCoords").arrays().forEach { g ->
            val a = g.getJSONArray(0)
            val b = g.getJSONArray(1)
            e.gapCoords.add(LatLng(a.getDouble(0), a.getDouble(1)) to LatLng(b.getDouble(0), b.getDouble(1)))
        }
        e.timeSeries.addAll(parseTimeSeries(snapshot.getJSONArray("timeSeries")))
        snapshot.getJSONArray("track").arrays().forEach {
            e.track.add(TrackPoint(it.getLong(0), it.getDouble(1), it.getDouble(2), it.getDouble(3), it.optNumber(4), it.optNumber(5), it.optNumber(6)))
        }
        snapshot.getJSONArray("raw").arrays().forEach {
            e.raw.add(RawFix(it.getLong(0), it.getDouble(1), it.getDouble(2), it.optNumber(3), it.optNumber(4), it.optNumber(5), it.optNumber(6)))
        }
        snapshot.getJSONArray("steps").arrays().forEach { e.steps.add(it.getLong(0) to it.getLong(1)) }
        snapshot.getJSONArray("pauses").arrays().forEach { e.pauses.add(it.getLong(0) to it.getLong(1)) }
        snapshot.getJSONArray("coachLog").arrays().forEach { e.coachLog.add(it.getLong(0) to it.getString(1)) }

        st.optJSONObject("coach")?.let { c ->
            e.coach?.restore(PaceCoach.State(
                c.getDouble("scale"), c.getInt("eases"), c.getInt("misses"), c.getInt("seg"), c.getLong("segStart"),
                c.getDouble("segStartDist"), c.getLong("nextCheckAt"),
                c.getJSONArray("results").arrays().map { PaceCoach.Result(it.getInt(0), it.getDouble(1), it.optNumber(2)) },
            ))
        }
        st.optJSONObject("fun")?.let { j ->
            val f = e.funCoach ?: return@let
            f.seg = j.getInt("seg")
            j.optJSONArray("start")?.let { a -> f.start = FunCoach.Start(a.getLong(0), a.getDouble(1), if (a.isNull(2)) null else a.getLong(2)) }
            j.optJSONArray("chase")?.let { a -> f.chase = FunCoach.Chase(a.getDouble(0), a.getLong(1), a.getBoolean(2), a.getBoolean(3)) }
            j.optJSONObject("results")?.let { r ->
                r.getJSONArray("bursts").arrays().forEach { f.results.bursts += it.getInt(0) to it.getDouble(1) }
                f.results.finish = if (r.isNull("finish")) null else r.getDouble("finish")
                f.results.escaped = r.getInt("escaped")
                f.results.caught = r.getInt("caught")
                r.getJSONArray("steps").arrays().forEach { f.results.steps += it.getInt(0) to it.getInt(1) }
            }
            j.optJSONArray("ref")?.let { a ->
                f.bestBurst = a.optNumber(0); f.lastBurst = a.optNumber(1); f.bestFinish = a.optNumber(2); f.bestSteps = a.optNumber(3)?.toInt()
            }
        }
        e.restore(
            EngineState(
                st.getDouble("nextMilestone"), st.getLong("splitStartMs"), st.getDouble("lastTimeSeriesDistance"),
                st.getLong("lastTimeSeriesMs"), st.getLong("stepCount"), st.getInt("guidedIndex"),
                st.getBoolean("guidedStarted"), st.getBoolean("guidedCompleted"),
                if (st.isNull("ghostWon")) null else st.getBoolean("ghostWon"),
                st.getDouble("cueDistance"), st.getDouble("cueGap"), st.getLong("cueAtMs"),
                st.optNullableString("cueLeader"), st.getBoolean("ghostDoneAnnounced"),
                st.getBoolean("everFixed"), st.getLong("pausedAt"),
            ),
            snapshot.getLong("elapsedMs"), snapshot.getLong("savedAt"),
            snapshot.getDouble("distance"), snapshot.getDouble("estimatedDistance"),
        )
        return e
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
