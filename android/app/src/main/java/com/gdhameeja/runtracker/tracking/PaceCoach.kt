package com.gdhameeja.runtracker.tracking

import kotlin.math.roundToInt

/**
 * The live half of a Tune-In run, same logic as PaceCoach in coach.js (the
 * plan itself is made in the web layer before the run). Each segment has a
 * role and a target pace; the coach announces it, checks your pace over the
 * last 20 s every 40 s in steady parts of a minute or more, and after two
 * missed parts in a row makes the rest of the run 4% gentler (at most twice).
 * Times are moving time in ms since the start of the run, distances metres.
 */
class PaceCoach(private val segments: List<GuidedSegment>) {

    companion object {
        const val FIRST_CHECK_MS = 25_000L
        const val CHECK_EVERY_MS = 40_000L
        const val QUIET_END_MS = 15_000L
        const val WINDOW_MS = 20_000L
        const val CHECKED_MIN_MS = 60_000L
        const val JUDGED_MIN_MS = 45_000L
        const val SLOW = 1.05
        const val FAST = 0.94
        const val MISS = 1.07
        const val EASE = 1.04
        const val MAX_EASES = 2
        private val NAG_SLOW = setOf("settle", "cruise", "push")
        private val NAG_FAST = setOf("settle", "cruise", "push", "float")
        private val EASED = setOf("settle", "cruise", "push", "surge", "float")
        private val JUDGED = setOf("settle", "cruise", "push")
        private val LABELS = mapOf(
            "warmup" to "Warm up", "settle" to "Settle in", "cruise" to "Steady", "push" to "Push",
            "surge" to "Surge", "float" to "Float", "recover" to "Recover", "cooldown" to "Cool down",
        )

        fun isCoached(segments: List<GuidedSegment>?) = segments?.any { it.pace != null } == true

        fun formatPace(sec: Double): String {
            val total = sec.roundToInt()
            return "${total / 60}:${(total % 60).toString().padStart(2, '0')}"
        }

        /** 340 -> "5 40 per kilometre", 305 -> "5 oh 5 per kilometre", 360 -> "6 minutes per kilometre" */
        fun spokenPace(sec: Double): String {
            val total = sec.roundToInt()
            val m = total / 60
            val s = total % 60
            if (s == 0) return "$m minutes per kilometre"
            return "$m ${if (s < 10) "oh $s" else "$s"} per kilometre"
        }

        fun spokenSeconds(sec: Int): String {
            if (sec < 60) return "$sec seconds"
            val m = sec / 60
            val r = sec % 60
            val mins = "$m minute${if (m > 1) "s" else ""}"
            return if (r > 0) "$mins $r seconds" else mins
        }
    }

    var scale = 1.0
        private set
    var eases = 0
        private set
    private var misses = 0
    var seg = -1
        private set
    private var segStart = 0L
    private var segStartDist = 0.0
    private var nextCheckAt = 0L
    private var lastStatus: String? = null
    /** "slow", "on", "fast", or null when there's no pace to judge. */
    var status: String? = null
        private set
    /** Your pace (s/km) over the last ~20 s, or null. */
    var now: Double? = null
        private set
    private val samples = ArrayDeque<Pair<Long, Double>>()

    val active get() = seg >= 0

    val role: String? get() = segments.getOrNull(seg)?.role

    /** Target pace (s/km) of a segment after any easing, to the nearest 5 s. */
    fun pace(index: Int = seg): Double? {
        val s = segments.getOrNull(index) ?: return null
        val p = s.pace ?: return null
        return if (s.role in EASED) (p * scale / 5).roundToInt() * 5.0 else p
    }

    /** A segment just started, [dist] metres into the run. Returns phrases to speak. */
    fun startSegment(index: Int, t: Long, dist: Double): List<String> {
        val said = if (seg >= 0) judge(t, dist).toMutableList() else mutableListOf()
        val s = segments.getOrNull(index)
        seg = if (s != null) index else -1
        segStart = t
        segStartDist = dist
        nextCheckAt = t + FIRST_CHECK_MS
        lastStatus = null
        status = null
        if (s != null) said += announcement(s, pace(index))
        return said
    }

    private fun announcement(s: GuidedSegment, pace: Double?): String {
        val d = spokenSeconds(s.durationSec)
        val p = pace?.let(::spokenPace) ?: ""
        return when (s.role) {
            "warmup" -> "Tune-In run. Warm up easy, around $p. $d."
            "settle" -> "Settle in at $p, for $d."
            "cruise" -> "Steady. $p, for $d."
            "push" -> "Push! $p, for $d."
            "surge" -> "Surge! $d at $p. Go!"
            "float" -> "Float. Ease off to $p, for $d."
            "recover" -> "Recover. Easy jog or walk, $d."
            "cooldown" -> "Cool down. That's the work done. Walk or jog, whatever feels good."
            else -> "$d."
        }
    }

    /** How the segment that just ended went; eases the rest of the run after two misses. */
    private fun judge(t: Long, dist: Double): List<String> {
        val s = segments.getOrNull(seg) ?: return emptyList()
        val target = pace() ?: return emptyList()
        if (s.role !in JUDGED || s.durationSec * 1000L < JUDGED_MIN_MS) return emptyList()
        val d = dist - segStartDist
        val ratio = if (d > 5) (t - segStart) / d / target else Double.POSITIVE_INFINITY
        if (ratio > MISS) misses++ else if (ratio <= 1.03) misses = 0
        if (misses < 2 || eases >= MAX_EASES) return emptyList()
        scale *= EASE
        eases++
        misses = 0
        return listOf("Let's adjust. The rest of today's targets are a little gentler. You're still doing the work.")
    }

    /** Pace (s/km) over the last ~20 s, or null if there's too little to go on or you stopped. */
    private fun measured(): Double? {
        val last = samples.lastOrNull() ?: return null
        val from = samples.lastOrNull { it.first <= last.first - WINDOW_MS } ?: samples.first()
        if (last.first - from.first < 15_000) return null
        val d = last.second - from.second
        return if (d >= 15) (last.first - from.first) / d else null
    }

    fun tick(t: Long, dist: Double): List<String> {
        if (seg < 0) return emptyList()
        val last = samples.lastOrNull()
        if (last == null || t - last.first >= 1000) samples.addLast(t to dist)
        while (samples.isNotEmpty() && samples.first().first < t - 30_000) samples.removeFirst()

        val s = segments[seg]
        val target = pace()
        val measured = measured()
        now = measured
        status = when {
            target == null || measured == null -> null
            measured > target * SLOW -> "slow"
            measured < target * FAST -> "fast"
            else -> "on"
        }
        if (target == null || s.durationSec * 1000L < CHECKED_MIN_MS) return emptyList()
        if (t < nextCheckAt || segStart + s.durationSec * 1000L - t <= QUIET_END_MS) return emptyList()
        nextCheckAt = t + CHECK_EVERY_MS
        if (status == null || measured == null) return emptyList()

        val p = spokenPace(target)
        val msg = when {
            status == "slow" && s.role in NAG_SLOW ->
                if (measured > target * 1.15) "Pick it up when you're ready. Aim for $p." else "A little quicker. Aim for $p."
            status == "fast" && s.role in NAG_FAST ->
                if (s.role == "push") "Strong! $p is enough, save a bit." else "Ease back a touch, to $p. Save it for the pushes."
            status == "on" && lastStatus != "on" ->
                if (lastStatus != null) "That's it, right on pace." else "On pace. Hold it there."
            else -> null
        }
        lastStatus = status
        return listOfNotNull(msg)
    }

    /** What to do right now, for the run screen and the notification. */
    fun instruction(): String? {
        val s = segments.getOrNull(seg) ?: return null
        val target = pace()
        val label = LABELS[s.role] ?: "Run"
        return when {
            target == null -> if (s.role == "cooldown") "Walk or jog, whatever feels good" else label
            s.role == "recover" || s.role == "warmup" -> "$label: easy, around ${formatPace(target)} /km"
            else -> "$label at ${formatPace(target)} /km"
        }
    }
}
