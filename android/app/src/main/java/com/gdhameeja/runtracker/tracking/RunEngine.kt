package com.gdhameeja.runtracker.tracking

import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.roundToLong
import kotlin.math.sin
import kotlin.math.sqrt

// Pure-Kotlin run state machine: GPS filtering, distance, splits, guided-run
// segments and ghost race. It has no Android dependencies so it can be unit
// tested on the JVM; RunTrackerService feeds it fixes and clock ticks and
// speaks whatever it returns. The logic mirrors script.js so the web and
// native builds behave the same.

data class LatLng(val lat: Double, val lng: Double)

data class TimePoint(
    val distance: Double,
    val time: Long,
    val lat: Double? = null,
    val lng: Double? = null,
    val pace: Double = 0.0,
)

/**
 * One accepted GPS fix: moving time since the start, cumulative distance, the
 * filtered position, and the receiver's own speed (m/s) and bearing (degrees
 * from true north) when it reported them. Dense enough to replay a run exactly.
 */
data class TrackPoint(
    val time: Long,
    val distance: Double,
    val lat: Double,
    val lng: Double,
    val speed: Double? = null,
    val bearing: Double? = null,
)

data class GuidedSegment(val type: String, val durationSec: Int, val intensity: String)

/** The ghost to race: finish line in metres and its run (moving time vs distance). */
data class GhostConfig(val targetMeters: Double, val timeSeries: List<TimePoint>)

data class RunConfig(
    val runId: Long,
    val previousTimeSeries: List<TimePoint>? = null,
    val ghost: GhostConfig? = null,
    val guided: List<GuidedSegment>? = null,
    /** Opaque JSON from the web layer (ghost/guided context), handed back on recovery. */
    val meta: String? = null,
)

class KalmanFilter(private val processNoise: Double, initialEstimate: Double) {
    private var estimateError = 1.0
    private var estimate = initialEstimate

    fun update(measurement: Double, accuracyMeters: Double): Double {
        // Weight measurement by GPS-reported accuracy (metres -> degrees, squared for variance)
        val accuracyDeg = accuracyMeters / 111320
        val measurementNoise = accuracyDeg * accuracyDeg
        estimateError += processNoise
        val gain = estimateError / (estimateError + measurementNoise)
        estimate += gain * (measurement - estimate)
        estimateError *= (1 - gain)
        return estimate
    }
}

class RunEngine(val config: RunConfig, now: Long) {

    enum class Status { RUNNING, PAUSED, FINISHED }

    companion object {
        const val GAP_THRESHOLD_MS = 10_000L
        const val MAX_SPEED_MPS = 12.5
        const val MAX_ACCURACY_M = 20.0
        const val TIME_SERIES_INTERVAL_M = 100.0
        const val GUIDED_COUNTDOWN_MS = 5_000L

        // Spoken ghost updates; same rules as ghostCue in analysis.js
        const val CUE_EVERY_M = 250.0
        const val CUE_MIN_INTERVAL_MS = 30_000L
        const val LEAD_HYSTERESIS_M = 5.0

        fun spokenMetres(metres: Double): String {
            val m = abs(metres)
            if (m >= 1000) {
                val km = Math.round(m / 100) / 10.0
                val text = if (km % 1 == 0.0) km.toLong().toString() else km.toString()
                return "$text kilometre${if (km == 1.0) "" else "s"}"
            }
            val r = if (m < 100) Math.round(m / 5) * 5 else Math.round(m / 10) * 10
            return "${max(r, 5L)} metres"
        }

        val SEGMENT_NAMES = mapOf(
            "warmup" to "Warm up", "cooldown" to "Cool down", "run" to "Run",
            "sprint" to "Sprint", "jog" to "Jog", "walk" to "Walk", "rest" to "Rest",
        )

        fun segmentName(type: String) = SEGMENT_NAMES[type] ?: type

        fun distance(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
            val r = 6371000.0
            val dLat = Math.toRadians(lat2 - lat1)
            val dLon = Math.toRadians(lon2 - lon1)
            val a = sin(dLat / 2) * sin(dLat / 2) +
                cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) * sin(dLon / 2) * sin(dLon / 2)
            return r * 2 * atan2(sqrt(a), sqrt(1 - a))
        }

        fun formatTime(seconds: Long): String = "${seconds / 60}:${(seconds % 60).toString().padStart(2, '0')}"

        fun ghostDistanceAtTime(ts: List<TimePoint>, elapsedMs: Long): Double {
            if (ts.isEmpty()) return 0.0
            for (i in ts.indices) {
                if (ts[i].time >= elapsedMs) {
                    if (i == 0) return if (ts[0].distance > 0) (elapsedMs.toDouble() / ts[0].time) * ts[0].distance else 0.0
                    val prev = ts[i - 1]
                    val next = ts[i]
                    val ratio = (elapsedMs - prev.time).toDouble() / (next.time - prev.time)
                    return prev.distance + ratio * (next.distance - prev.distance)
                }
            }
            return ts.last().distance
        }

        fun ghostTimeAtDistance(ts: List<TimePoint>, distance: Double): Double? {
            if (ts.isEmpty()) return null
            for (i in ts.indices) {
                if (ts[i].distance >= distance) {
                    if (i == 0) return if (ts[0].distance > 0) (distance / ts[0].distance) * ts[0].time else null
                    val prev = ts[i - 1]
                    val next = ts[i]
                    val ratio = (distance - prev.distance) / (next.distance - prev.distance)
                    return prev.time + ratio * (next.time - prev.time)
                }
            }
            return null
        }

        fun previousTimeAtDistance(ts: List<TimePoint>?, distance: Double): Long? =
            ts?.firstOrNull { it.distance >= distance }?.time
    }

    var status = Status.RUNNING
        private set

    val startedAt = now

    /** Wall-clock start, shifted forward by every pause so `now - startTime` is moving time. */
    var startTime = now
        private set
    private var pausedAt = 0L
    var endTime: Long? = null
        private set

    var totalDistance = 0.0
        private set
    var estimatedDistance = 0.0
        private set
    var lastAccuracy: Double? = null
        private set

    /** The last element is the segment currently being drawn. */
    val pathSegments: MutableList<MutableList<LatLng>> = mutableListOf(mutableListOf())
    val gapCoords: MutableList<Pair<LatLng, LatLng>> = mutableListOf()
    val timeSeries: MutableList<TimePoint> = mutableListOf()
    val track: MutableList<TrackPoint> = mutableListOf()

    // Latest speed/bearing straight from the GPS receiver (Doppler), for the AR view's direction of travel
    var lastSpeed: Double? = null
        private set
    var lastBearing: Double? = null
        private set
    var lastMotionAt: Long? = null
        private set

    private var prevPosition: LatLng? = null
    private var lastFixTime = 0L
    private var lastRawFixTime: Long? = null
    private var kalmanLat: KalmanFilter? = null
    private var kalmanLon: KalmanFilter? = null
    private var nextMilestone = 1000.0
    private var lastMilestoneTime = now
    private var lastTimeSeriesDistance = 0.0
    private var lastTimeSeriesTime = 0L

    // Guided run: -1 while counting down, then the index of the current segment.
    var guidedIndex = -1
        private set
    var guidedCompleted = false
        private set
    private var guidedStarted = false
    private val announcedWarnings = mutableSetOf<Int>()
    private val guidedSegmentEnds: List<Long> = config.guided.orEmpty().runningFold(GUIDED_COUNTDOWN_MS) { acc, s ->
        acc + s.durationSec * 1000L
    }

    // Ghost race result: null while racing, true/false once you cross the target.
    var ghostWon: Boolean? = null
        private set

    // Spoken ghost update state
    private var cueDistance = 0.0
    private var cueGap = 0.0
    private var cueAt = now
    private var cueLeader: String? = null
    private var ghostDoneAnnounced = false

    val pointCount get() = pathSegments.sumOf { it.size }
    val lastPoint get() = pathSegments.lastOrNull { it.isNotEmpty() }?.last()

    fun elapsedMs(now: Long): Long = when (status) {
        Status.RUNNING -> now - startTime
        Status.PAUSED -> pausedAt - startTime
        Status.FINISHED -> (endTime ?: now) - startTime
    }

    fun pause(now: Long) {
        if (status != Status.RUNNING) return
        pausedAt = now
        status = Status.PAUSED
    }

    fun resume(now: Long) {
        if (status != Status.PAUSED) return
        startTime += now - pausedAt
        lastMilestoneTime += now - pausedAt
        prevPosition = null
        kalmanLat = null
        kalmanLon = null
        lastRawFixTime = null
        status = Status.RUNNING
    }

    fun finish(now: Long) {
        if (status == Status.FINISHED) return
        if (status == Status.PAUSED) startTime += now - pausedAt
        endTime = now
        status = Status.FINISHED
    }

    /**
     * Feeds one raw GPS fix, with the receiver's speed (m/s) and bearing (degrees)
     * when it has them. Returns phrases to speak.
     */
    fun onLocation(
        rawLat: Double, rawLon: Double, accuracy: Double, now: Long,
        speed: Double? = null, bearing: Double? = null,
    ): List<String> {
        if (status != Status.RUNNING) return emptyList()
        val rawGapStart = lastRawFixTime
        lastRawFixTime = now
        lastAccuracy = accuracy
        if (accuracy > MAX_ACCURACY_M) return emptyList()
        lastSpeed = speed
        lastBearing = bearing
        lastMotionAt = now

        if (kalmanLat == null) resetKalman(rawLat, rawLon)
        val lat = kalmanLat!!.update(rawLat, accuracy)
        val lon = kalmanLon!!.update(rawLon, accuracy)
        val point = LatLng(lat, lon)
        val current = pathSegments.last()

        val prev = prevPosition
        if (prev == null) {
            // First fix of the run, or first fix after resuming from pause
            lastFixTime = now
            if (current.isNotEmpty()) pathSegments.add(mutableListOf())
            pathSegments.last().add(point)
            prevPosition = point
            addTrackPoint(now, point, speed, bearing)
            return emptyList()
        }

        val dist = distance(prev.lat, prev.lng, lat, lon)
        val dt = (now - lastFixTime) / 1000.0
        val isGap = now - (rawGapStart ?: lastFixTime) > GAP_THRESHOLD_MS

        if (dt > 0 && dist / dt > MAX_SPEED_MPS) {
            // After a long gap a bad first fix could otherwise poison every later
            // one; start a fresh segment without counting distance.
            if (isGap) {
                pathSegments.add(mutableListOf(point))
                prevPosition = point
                lastFixTime = now
                resetKalman(lat, lon)
                addTrackPoint(now, point, speed, bearing)
            }
            return emptyList()
        }
        if (!isGap && dist < 3) return emptyList()

        lastFixTime = now
        if (isGap && current.isNotEmpty()) {
            gapCoords.add(current.last() to point)
            pathSegments.add(mutableListOf(point))
            estimatedDistance += dist
            resetKalman(lat, lon)
        } else {
            current.add(point)
        }
        prevPosition = point
        totalDistance += dist
        addTrackPoint(now, point, speed, bearing)

        val currentTimeMs = now - startTime
        val instantPace = if (dt > 0 && dist > 0) dt / (dist / 1000) else 0.0

        if (totalDistance - lastTimeSeriesDistance >= TIME_SERIES_INTERVAL_M) {
            val bucket = floor(totalDistance / TIME_SERIES_INTERVAL_M) * TIME_SERIES_INTERVAL_M
            timeSeries.add(TimePoint(bucket, currentTimeMs, lat, lon, instantPace))
            lastTimeSeriesDistance = bucket
        }
        if (currentTimeMs - lastTimeSeriesTime >= 60_000) {
            val alreadyRecorded = timeSeries.isNotEmpty() && abs(timeSeries.last().time - currentTimeMs) < 5000
            if (!alreadyRecorded) timeSeries.add(TimePoint(totalDistance, currentTimeMs, lat, lon, instantPace))
            lastTimeSeriesTime = currentTimeMs
        }

        val speech = mutableListOf<String>()
        if (totalDistance >= nextMilestone) speech += milestoneMessage(now)
        speech += checkGhost(now)
        ghostCue(now)?.let { speech += it }
        return speech
    }

    /** Called on a timer (~500 ms) to drive guided segments and the ghost finish. */
    fun tick(now: Long): List<String> {
        if (status == Status.FINISHED) return emptyList()
        val speech = mutableListOf<String>()
        speech += checkGhost(now)
        if (status == Status.RUNNING) speech += tickGuided(now)
        return speech
    }

    /** Guided-run display state: segment index (-1 = get ready) and ms left in it. */
    fun guidedRemainingMs(now: Long): Long {
        val segments = config.guided ?: return 0
        val elapsed = elapsedMs(now)
        if (guidedIndex < 0) return max(0, GUIDED_COUNTDOWN_MS - elapsed)
        if (guidedIndex >= segments.size) return 0
        return max(0, guidedSegmentEnds[guidedIndex + 1] - elapsed)
    }

    private fun tickGuided(now: Long): List<String> {
        val segments = config.guided ?: return emptyList()
        if (guidedCompleted || segments.isEmpty()) return emptyList()
        val speech = mutableListOf<String>()
        if (!guidedStarted) {
            guidedStarted = true
            speech += "Get ready. Starting in 5 seconds."
        }

        val elapsed = elapsedMs(now)
        // Segment i runs from guidedSegmentEnds[i] to guidedSegmentEnds[i + 1].
        val index = guidedSegmentEnds.indexOfLast { it <= elapsed }
        if (index >= segments.size) {
            guidedIndex = segments.size
            guidedCompleted = true
            speech += "Workout complete! Great job!"
            finish(now)
            return speech
        }
        if (index != guidedIndex) {
            guidedIndex = index
            announcedWarnings.clear()
            if (index >= 0) speech += segmentAnnouncement(segments[index])
        }
        if (index < 0) return speech

        val seg = segments[index]
        val remaining = (guidedSegmentEnds[index + 1] - elapsed) / 1000.0
        val warnings = listOf(10 to 20, 3 to 10, 2 to 10, 1 to 10)
        for ((at, minDuration) in warnings) {
            if (remaining <= at && remaining > at - 1 && seg.durationSec > minDuration && announcedWarnings.add(at)) {
                speech += if (at == 10) "10 seconds" else "$at"
            }
        }
        return speech
    }

    private fun segmentAnnouncement(seg: GuidedSegment): String {
        val d = seg.durationSec
        val durStr = if (d >= 60) {
            val mins = d / 60
            val secs = d % 60
            if (secs > 0) "$mins minutes $secs seconds" else "$mins minute${if (mins > 1) "s" else ""}"
        } else "$d seconds"
        return "${segmentName(seg.type)}. ${seg.intensity}. $durStr."
    }

    private fun milestoneMessage(now: Long): String {
        // A gap can cross several kilometres at once; announce only the latest.
        val km = floor(totalDistance / 1000).toInt()
        val splitSec = ((now - lastMilestoneTime) / 1000.0).roundToLong()
        val kmCovered = km - (nextMilestone / 1000).toInt() + 1
        val elapsed = now - startTime
        var msg = if (kmCovered > 1) {
            "$km kilometers. ${formatTime((elapsed / 1000.0).roundToLong())} elapsed."
        } else {
            "You've completed $km kilometer${if (km > 1) "s" else ""} in ${formatTime(splitSec)}."
        }

        val ghost = config.ghost
        if (ghost != null) {
            val ghostTime = ghostTimeAtDistance(ghost.timeSeries, km * 1000.0)
            if (ghostTime != null) {
                val diffStr = formatTime((abs(ghostTime - elapsed) / 1000).roundToLong())
                if (elapsed < ghostTime) msg += " $diffStr ahead of your ghost."
                else if (elapsed > ghostTime) msg += " $diffStr behind your ghost."
            }
        } else {
            val previous = previousTimeAtDistance(config.previousTimeSeries, km * 1000.0)
            if (previous != null) {
                val diff = previous - elapsed
                val diffStr = formatTime((abs(diff) / 1000.0).roundToLong())
                if (diff > 0) msg += " $diffStr faster than your last run."
                else if (diff < 0) msg += " $diffStr slower than your last run."
            }
        }

        nextMilestone = (km + 1) * 1000.0
        lastMilestoneTime = now
        return msg
    }

    private fun checkGhost(now: Long): List<String> {
        val ghost = config.ghost ?: return emptyList()
        if (ghostWon != null) return emptyList()
        val target = ghost.targetMeters
        if (totalDistance < target) return emptyList()
        val ghostTime = ghostTimeAtDistance(ghost.timeSeries, target)
        val won = ghostTime != null && elapsedMs(now) < ghostTime
        ghostWon = won
        return listOf(if (won) "You beat your ghost!" else "Ghost wins. Great effort, keep training!")
    }

    /** A spoken update on the ghost every ~250 m, and at once when the lead changes. */
    private fun ghostCue(now: Long): String? {
        val ghost = config.ghost ?: return null
        val target = ghost.targetMeters
        if (totalDistance >= target) return null
        val ghostDist = ghostDistanceAtTime(ghost.timeSeries, elapsedMs(now))
        if (ghostDist >= target) {
            if (ghostDoneAnnounced) return null
            ghostDoneAnnounced = true
            cueAt = now
            return "Your ghost has finished. ${spokenMetres(target - totalDistance)} to go."
        }
        val gap = totalDistance - ghostDist // > 0: you're ahead
        val leader = when {
            gap > LEAD_HYSTERESIS_M -> "you"
            gap < -LEAD_HYSTERESIS_M -> "ghost"
            else -> cueLeader
        }
        val changed = cueLeader != null && leader != cueLeader && totalDistance > 50
        cueLeader = leader
        if (changed) {
            cueDistance = totalDistance; cueGap = gap; cueAt = now
            return if (leader == "you") "You've overtaken your ghost!" else "Your ghost has overtaken you."
        }
        if (totalDistance - cueDistance < CUE_EVERY_M || now - cueAt < CUE_MIN_INTERVAL_MS) return null
        // The kilometre announcement already compares you with the ghost
        val intoKm = totalDistance % 1000
        if (intoKm < 60 || intoKm > 940) return null

        val msg = if (abs(gap) < LEAD_HYSTERESIS_M) {
            "Level with your ghost."
        } else {
            val change = abs(gap) - abs(cueGap)
            val sameSide = Math.signum(gap) == Math.signum(cueGap)
            val base = if (gap > 0) "Ghost ${spokenMetres(gap)} behind" else "Ghost ${spokenMetres(gap)} ahead"
            base + when {
                sameSide && change >= 5 -> if (gap > 0) ", you're pulling away." else ", and pulling away."
                sameSide && change <= -5 -> if (gap > 0) ", and closing." else ", you're closing in."
                else -> "."
            }
        }
        cueDistance = totalDistance; cueGap = gap; cueAt = now
        return msg
    }

    private fun addTrackPoint(now: Long, point: LatLng, speed: Double?, bearing: Double?) {
        track.add(TrackPoint(now - startTime, totalDistance, point.lat, point.lng, speed, bearing))
    }

    private fun resetKalman(lat: Double, lon: Double) {
        kalmanLat = KalmanFilter(0.0001, lat)
        kalmanLon = KalmanFilter(0.0001, lon)
    }
}
