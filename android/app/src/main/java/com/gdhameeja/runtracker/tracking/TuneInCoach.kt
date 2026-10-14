package com.gdhameeja.runtracker.tracking

import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * The "Tune-In" coach: asks how hard the run feels (1-5, anchored to the talk
 * test) and adapts. Same logic, timings and phrases as coach.js; see there for
 * the reasoning. All times are moving time in ms since the start of the run.
 */
class TuneInCoach(private val segments: List<GuidedSegment>) {

    companion object {
        const val FIRST_CHECK_MS = 90_000L
        const val CHECK_EVERY_MS = 75_000L
        const val AFTER_NUDGE_MS = 60_000L
        const val RECOVER_MS = 60_000L
        const val ASK_TIMEOUT_MS = 30_000L
        const val QUIET_END_MS = 30_000L
        const val SURGE_GAP_MS = 150_000L
        const val SURGE_START_S = 30
        const val SURGE_MIN_S = 20
        const val SURGE_MAX_S = 60

        val ANCHORS = mapOf(
            1 to "you could sing",
            2 to "you could chat in full sentences",
            3 to "you can talk in short sentences",
            4 to "just a few words at a time",
            5 to "you can't talk",
        )

        fun isCoached(segments: List<GuidedSegment>?) = segments.orEmpty().any { it.target != null }
    }

    enum class Mode { STEADY, SURGE, RECOVER }

    private data class Ask(val kind: String, val at: Long)

    private var seg = -1
    private var segEnd = 0L
    private var offset = 0
    var mode = Mode.STEADY
        private set
    private var modeEnd = 0L
    private var nextCheckAt = 0L
    private var asking: Ask? = null
    private var lowStreak = 0
    private var highStreak = 0
    private var surgeSec = SURGE_START_S
    private var lastSurgeEnd = 0L
    private var skipSurges = 0
    var lastRating: Int? = null
        private set
    private var coachedBefore = false
    private var praiseIndex = 0
    private var askIndex = 0

    /** `[moving ms, rating]` for every rating given. */
    val ratings = mutableListOf<Pair<Long, Int>>()

    val active get() = seg >= 0
    val isAsking get() = asking != null

    fun target(): Int? = if (seg < 0) null else (segments[seg].target!! + offset).coerceIn(1, 4)

    private fun anchor(t: Int) = ANCHORS.getValue(t)

    /** A guided segment just started. */
    fun startSegment(index: Int, t: Long): List<String> {
        val s = segments.getOrNull(index)
        asking = null
        mode = Mode.STEADY
        if (s?.target == null) {
            seg = -1
            return emptyList()
        }
        seg = index
        segEnd = t + s.durationSec * 1000L
        nextCheckAt = t + if (coachedBefore) CHECK_EVERY_MS else FIRST_CHECK_MS
        if (!coachedBefore) lastSurgeEnd = t
        coachedBefore = true
        return emptyList()
    }

    fun tick(t: Long): List<String> {
        if (seg < 0) return emptyList()
        if (mode == Mode.SURGE && t >= modeEnd) {
            mode = Mode.STEADY
            lastSurgeEnd = t
            ask("surge", t)
            return listOf("And ease back. Nice work. How was that surge, 1 to 5?")
        }
        if (mode == Mode.RECOVER && t >= modeEnd) {
            mode = Mode.STEADY
            nextCheckAt = t + 45_000
            val tgt = target()!!
            return listOf("When you're ready, settle back in. Aim for a $tgt: ${anchor(tgt)}.")
        }
        asking?.let { if (t - it.at > ASK_TIMEOUT_MS) asking = null }
        if (mode != Mode.STEADY || asking != null) return emptyList()
        if (t < nextCheckAt || segEnd - t <= QUIET_END_MS) return emptyList()

        if (surgeReady(t)) {
            mode = Mode.SURGE
            modeEnd = t + surgeSec * 1000L
            return listOf("Surge! $surgeSec seconds, fast but relaxed. Go!")
        }
        ask("check", t)
        val asks = listOf("Check in: how hard does it feel, 1 to 5?", "How's it feeling right now, 1 to 5?", "Quick check: 1 to 5?")
        return listOf(asks[askIndex++ % asks.size])
    }

    private fun surgeReady(t: Long): Boolean {
        val last = lastRating ?: return false
        return segments[seg].surges && skipSurges == 0 &&
            t - lastSurgeEnd >= SURGE_GAP_MS &&
            last <= target()!! &&
            segEnd - t >= surgeSec * 1000L + 60_000
    }

    private fun ask(kind: String, t: Long) {
        asking = Ask(kind, t)
        nextCheckAt = t + CHECK_EVERY_MS
    }

    /** A rating relative to the current target: -1 too easy, 0 right, +1 too hard. */
    fun rateRelative(delta: Int, t: Long): List<String> {
        val tgt = target() ?: return emptyList()
        return rate((tgt + delta).coerceIn(1, 5), t)
    }

    /** The runner rated their effort (1-5), asked or not. */
    fun rate(rating: Int, t: Long): List<String> {
        val r = rating.coerceIn(1, 5)
        ratings += t to r
        lastRating = r
        if (seg < 0) return emptyList()
        val kind = asking?.kind ?: if (mode == Mode.SURGE) "surge" else "check"
        asking = null
        val tgt = target()!!

        if (kind == "surge") {
            nextCheckAt = t + CHECK_EVERY_MS
            if (mode == Mode.SURGE) {
                mode = Mode.STEADY
                lastSurgeEnd = t
            }
            if (r >= 5) {
                surgeSec = max(SURGE_MIN_S, surgeSec - 10)
                skipSurges = 1
                recover(t)
                return listOf("Thanks for telling me. Take a minute really easy. The next surge will be shorter.")
            }
            if (r == 4) return listOf("Good, that's just right for a surge.")
            surgeSec = min(SURGE_MAX_S, surgeSec + 15)
            return listOf("Great. The next one will be $surgeSec seconds.")
        }

        if (r >= 5) {
            lowStreak = 0
            highStreak = 0
            offset = max(offset - 1, -1)
            skipSurges = 2
            recover(t)
            return listOf("Thanks for telling me. Let's back right off. Walk or jog very gently for a minute. Breathe out long and shake out your arms.")
        }
        if (r > tgt) {
            highStreak++
            lowStreak = 0
            nextCheckAt = t + AFTER_NUDGE_MS
            if (highStreak >= 2 && tgt > 1 && offset > -1) {
                offset--
                highStreak = 0
                val n = target()!!
                return listOf("Let's make today a gentler one. New aim: a $n, ${anchor(n)}.")
            }
            return listOf("Ease off a touch. Aim for a $tgt: ${anchor(tgt)}.")
        }
        if (r < tgt) {
            lowStreak++
            highStreak = 0
            nextCheckAt = t + AFTER_NUDGE_MS
            if (lowStreak >= 2 && tgt < 4 && offset < 1) {
                offset++
                lowStreak = 0
                val n = target()!!
                return listOf("You're flying today! New aim: a $n, ${anchor(n)}.")
            }
            return listOf(
                if (r <= tgt - 2) "That's too comfortable for this part. Pick up the pace. Aim for a $tgt: ${anchor(tgt)}."
                else "You've got a bit more in you. Pick it up a little. Aim for a $tgt: ${anchor(tgt)}."
            )
        }
        lowStreak = 0
        highStreak = 0
        skipSurges = max(0, skipSurges - 1)
        nextCheckAt = t + CHECK_EVERY_MS
        val praise = listOf("Perfect, that's the sweet spot. Hold it there.", "Spot on. Keep doing exactly this.", "Lovely. That's the one.")
        return listOf(praise[praiseIndex++ % praise.size])
    }

    private fun recover(t: Long) {
        mode = Mode.RECOVER
        modeEnd = t + RECOVER_MS
    }

    /** What to do right now, for the run screen and the notification. */
    fun instruction(t: Long): String? {
        val tgt = target() ?: return null
        val left = ceil(max(0L, modeEnd - t) / 1000.0).roundToInt()
        return when (mode) {
            Mode.SURGE -> "Surge! Fast but relaxed · $left s"
            Mode.RECOVER -> "Back off: walk or jog gently · $left s"
            Mode.STEADY -> "Aim for a $tgt: ${anchor(tgt)}"
        }
    }
}
