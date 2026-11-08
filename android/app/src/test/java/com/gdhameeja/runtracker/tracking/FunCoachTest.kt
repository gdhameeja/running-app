package com.gdhameeja.runtracker.tracking

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

// Mirrors the Fun Run game tests in tests.js, so coach.js and FunCoach agree.
class FunCoachTest {

    private fun game(kind: String, seconds: Int, chaser: String? = null) =
        GuidedSegment(if (kind == "chase") "stride" else "run", seconds, "", game = kind, chaser = chaser)

    private val easy = GuidedSegment("run", 60, "")

    /** Runs one segment at a steady pace (s/km, null = standing still), ticking every 500 ms. */
    private fun FunCoach.leg(index: Int, t0: Long, d0: Double, ms: Long, pace: Double?, steps0: Long? = null, spm: Int = 0): Triple<List<String>, Long, Double> {
        val (ended, after) = startSegment(index, t0, d0, steps0)
        val said = (ended + after).toMutableList()
        var t = t0
        while (t < t0 + ms) {
            said += tick(t, d0 + if (pace == null) 0.0 else (t - t0) / pace)
            t += 500
        }
        val d = d0 + if (pace == null) 0.0 else ms / pace
        return Triple(said, t0 + ms, d)
    }

    @Test
    fun burstsAnswerBack() {
        val c = FunCoach(listOf(game("burst", 20), easy, game("burst", 20), easy, game("burst", 20), easy), FunRef(bestBurst = 240.0))
        var r = c.leg(0, 0, 0.0, 20_000, 250.0)
        r = c.leg(1, r.second, r.third, 60_000, 400.0)
        assertEquals("4 10 per kilometre. Nice.", r.first[0])
        r = c.leg(2, r.second, r.third, 20_000, 245.0)
        r = c.leg(3, r.second, r.third, 60_000, 400.0)
        assertEquals("4 oh 5 per kilometre. 5 seconds quicker than the last one!", r.first[0])
        r = c.leg(4, r.second, r.third, 20_000, 235.0)
        val end = c.finish(r.second, r.third)
        assertEquals("3 55 per kilometre. Your quickest burst this month!", end[0])
        assertEquals(3, c.results.bursts.size)
    }

    @Test
    fun chaseEscapedAndClose() {
        // Easy pace 6:00, so the zombie runs 25% quicker; you hold 6:00
        val c = FunCoach(listOf(game("chase", 60, "zombie"), easy), FunRef(easyPace = 360.0))
        val r = c.leg(0, 0, 0.0, 60_000, 360.0)
        assertTrue(r.first.contains("The zombie is right behind you! Go, go!"))
        assertTrue(r.first.contains("45 metres."))
        assertEquals(listOf("start", "close"), c.takeBuzz())
        val end = c.finish(r.second, r.third)
        assertEquals("You got away! Back to easy.", end[0])
        assertEquals(1, c.results.escaped)
        assertEquals(listOf("end"), c.takeBuzz())
    }

    @Test
    fun chaseCaught() {
        val c = FunCoach(listOf(game("chase", 60, "dog"), easy), FunRef(easyPace = 360.0))
        val r = c.leg(0, 0, 0.0, 60_000, null)
        assertTrue(r.first.contains("The dog caught you! Shake it off. You'll get away next time."))
        assertTrue(c.finish(r.second, r.third).isEmpty())
        assertEquals(1, c.results.caught)
        assertEquals(listOf("start", "close", "end"), c.takeBuzz())
    }

    @Test
    fun stepsCounted() {
        val c = FunCoach(listOf(game("steps", 10), easy), FunRef(bestSteps = 25))
        c.startSegment(0, 0, 0.0, 100)
        val said = c.finish(10_000, 30.0, 130)
        assertEquals("30 steps. That's 180 a minute! Your most yet!", said[0])
        assertTrue(c.takeBuzz().isEmpty())
    }

    @Test
    fun photoFinish() {
        val c = FunCoach(listOf(game("finish", 20)))
        c.startSegment(0, 0, 0.0)
        assertEquals("Photo finish: 4 minutes per kilometre.", c.finish(20_000, 83.333333)[0])
        val again = FunCoach(listOf(game("finish", 20)), FunRef(bestFinish = 250.0))
        again.startSegment(0, 0, 0.0)
        assertEquals("Photo finish: 4 minutes per kilometre. Your best finish yet!", again.finish(20_000, 83.333333)[0])
    }

    @Test
    fun tooShortForGps() {
        val c = FunCoach(listOf(game("burst", 20)))
        c.startSegment(0, 0, 0.0)
        assertTrue(c.finish(20_000, 10.0).isEmpty())
    }
}
