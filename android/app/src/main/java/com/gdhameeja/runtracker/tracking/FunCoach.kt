package com.gdhameeja.runtracker.tracking

import kotlin.math.roundToInt

/** From your earlier Fun Runs, to compare against (paces in s/km). */
data class FunRef(
    val easyPace: Double? = null,
    val bestBurst: Double? = null,
    val lastBurst: Double? = null,
    val bestFinish: Double? = null,
    val bestSteps: Int? = null,
)

/**
 * Makes the Fun Run react to what you actually do: segments with a `game` get
 * measured, and it speaks the result. Same rules as FunCoach in coach.js; keep
 * the two in step (FunCoachTest.kt and tests.js test the same cases).
 *  - burst / finish: your pace over it, against your best this month and your last one
 *  - chase: something starts 50 m behind you, a little quicker than your easy pace,
 *    and the gap is called out until you get away (or it catches you, cheerfully)
 *  - steps: how many steps you took in it, from the step counter
 * [buzz] collects "start" / "end" / "close" for the service to vibrate.
 */
class FunCoach(private val segments: List<GuidedSegment>, ref: FunRef = FunRef()) {

    companion object {
        const val CHASE_GAP_M = 50.0
        const val CHASE_SPEEDUP = 1.25
        const val CHASE_SAY_EVERY_MS = 10_000L
        const val DEFAULT_EASY_PACE = 400.0
        private val CHASERS = mapOf("zombie" to "The zombie", "dog" to "The dog", "bus" to "The bus")

        fun isFun(segments: List<GuidedSegment>?) = segments?.any { it.game != null } == true
    }

    data class Start(val t: Long, val dist: Double, val steps: Long?)
    data class Chase(val speed: Double, var saidAt: Long, var close: Boolean, var caught: Boolean)
    class Results {
        val bursts = mutableListOf<Pair<Int, Double>>()
        var finish: Double? = null
        var escaped = 0
        var caught = 0
        val steps = mutableListOf<Pair<Int, Int>>()
    }

    var easyPace = ref.easyPace
    var bestBurst = ref.bestBurst
    var lastBurst = ref.lastBurst
    var bestFinish = ref.bestFinish
    var bestSteps = ref.bestSteps

    var seg = -1
    var start: Start? = null
    var chase: Chase? = null
    val results = Results()
    val buzz = mutableListOf<String>()

    val active get() = seg >= 0

    /** Segment [index] just started: (what to say about the last one, what to say after this one's announcement). */
    fun startSegment(index: Int, t: Long, dist: Double, steps: Long? = null): Pair<List<String>, List<String>> {
        val ended = end(t, dist, steps)
        val s = segments.getOrNull(index)
        seg = if (s != null) index else -1
        start = Start(t, dist, steps)
        chase = null
        if (s?.game != null) {
            if (s.game != "steps") buzz += "start"
            if (s.game == "chase") {
                val easy = 1000.0 / (easyPace ?: DEFAULT_EASY_PACE)
                chase = Chase(easy * CHASE_SPEEDUP, t, close = false, caught = false)
            }
        }
        return ended to emptyList()
    }

    fun gap(t: Long, dist: Double): Double? {
        val c = chase ?: return null
        val st = start ?: return null
        return dist - (st.dist - CHASE_GAP_M + c.speed * (t - st.t) / 1000.0)
    }

    fun tick(t: Long, dist: Double): List<String> {
        val s = segments.getOrNull(seg) ?: return emptyList()
        val c = chase ?: return emptyList()
        if (c.caught) return emptyList()
        val who = CHASERS[s.chaser] ?: "It"
        val gap = gap(t, dist) ?: return emptyList()
        if (gap <= 0) {
            c.caught = true
            buzz += "end"
            return listOf("$who caught you! Shake it off. You'll get away next time.")
        }
        if (gap < 15 && !c.close) {
            c.close = true
            c.saidAt = t
            buzz += "close"
            return listOf("$who is right behind you! Go, go!")
        }
        if (t - c.saidAt >= CHASE_SAY_EVERY_MS) {
            c.saidAt = t
            if (gap >= 15) c.close = false
            return listOf("${(gap / 5).roundToInt() * 5} metres.")
        }
        return emptyList()
    }

    /** The run ended: how the last part went. */
    fun finish(t: Long, dist: Double, steps: Long? = null): List<String> {
        val said = end(t, dist, steps)
        seg = -1
        return said
    }

    private fun end(t: Long, dist: Double, steps: Long?): List<String> {
        val s = segments.getOrNull(seg) ?: return emptyList()
        val game = s.game ?: return emptyList()
        val st = start ?: return emptyList()
        val dt = t - st.t
        val dd = dist - st.dist
        if (game == "steps") {
            if (steps == null || st.steps == null || dt < 5000) return emptyList()
            val n = (steps - st.steps).toInt()
            val best = bestSteps
            results.steps += seg to n
            val perMin = (n * 60_000.0 / dt).roundToInt()
            val line = if (best != null && n > best) " Your most yet!" else ""
            if (best == null || n > best) bestSteps = n
            return listOf("$n steps. That's $perMin a minute!$line")
        }
        if (game == "chase") {
            if (chase?.caught == true) {
                results.caught++
                return emptyList()
            }
            buzz += "end"
            results.escaped++
            return listOf("You got away! Back to easy.")
        }
        buzz += "end"
        if (dd < 20 || dt < 5000) return emptyList()
        val pace = dt / dd
        val p = PaceCoach.spokenPace(pace)
        if (game == "finish") {
            results.finish = (pace * 10).roundToInt() / 10.0
            val best = bestFinish
            if (best == null || pace < best) {
                bestFinish = pace
                return listOf("Photo finish: $p." + if (best == null) "" else " Your best finish yet!")
            }
            return listOf("Photo finish: $p.")
        }
        results.bursts += seg to (pace * 10).roundToInt() / 10.0
        val best = bestBurst
        val last = lastBurst
        lastBurst = pace
        if (best != null && pace < best) {
            bestBurst = pace
            return listOf("$p. Your quickest burst this month!")
        }
        if (best == null) bestBurst = pace
        if (last != null && last - pace >= 1) return listOf("$p. ${(last - pace).roundToInt()} seconds quicker than the last one!")
        return listOf("$p. Nice.")
    }

    /** For the notification and run screen: (who, gap m, caught) while a chase is on. */
    fun chaseState(t: Long, dist: Double): Triple<String, Int, Boolean>? {
        val s = segments.getOrNull(seg) ?: return null
        val c = chase ?: return null
        return Triple(CHASERS[s.chaser] ?: "It", (gap(t, dist) ?: 0.0).roundToInt(), c.caught)
    }

    fun takeBuzz(): List<String> = buzz.toList().also { buzz.clear() }
}
