package com.gdhameeja.runtracker.tracking

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// Mirrors the Tune-In tests in tests.js, so coach.js and PaceCoach agree.
class PaceCoachTest {

    private fun part(role: String, seconds: Int, pace: Double?) =
        GuidedSegment("run", seconds, "", role = role, pace = pace)

    private class Leg(val said: List<Pair<Long, String>>, val endT: Long, val endD: Double)

    /** Drives a coach through one segment at a steady pace (s/km), ticking every 500 ms. */
    private fun PaceCoach.leg(index: Int, startT: Long, startD: Double, durationMs: Long, paceSec: Double): Leg {
        val said = startSegment(index, startT, startD).map { startT to it }.toMutableList()
        var t = startT
        while (t < startT + durationMs) {
            tick(t, startD + (t - startT) / paceSec).forEach { said += t to it }
            t += 500
        }
        return Leg(said, startT + durationMs, startD + durationMs / paceSec)
    }

    @Test
    fun spokenPace() {
        assertEquals("5 40 per kilometre", PaceCoach.spokenPace(340.0))
        assertEquals("5 oh 5 per kilometre", PaceCoach.spokenPace(305.0))
        assertEquals("6 minutes per kilometre", PaceCoach.spokenPace(360.0))
    }

    @Test
    fun announcesAndChecks() {
        val c = PaceCoach(listOf(part("warmup", 300, 420.0), part("cruise", 120, 360.0)))
        var r = c.leg(0, 0, 0.0, 300_000, 330.0)
        assertEquals(1, r.said.size)
        assertTrue(r.said[0].second.contains("Warm up easy, around 7 minutes per kilometre"))

        r = c.leg(1, r.endT, r.endD, 120_000, 360.0)
        assertTrue(r.said[0].second.startsWith("Steady. 6 minutes per kilometre, for 2 minutes"))
        assertEquals(2, r.said.size)
        assertTrue(r.said[1].second.contains("On pace"))
        assertEquals(325_000L, r.said[1].first)

        val slow = PaceCoach(listOf(part("cruise", 180, 360.0)))
        val nags = slow.leg(0, 0, 0.0, 180_000, 390.0).said.drop(1).map { it.second }
        assertEquals(4, nags.size)
        assertTrue(nags.all { it.startsWith("A little quicker. Aim for 6 minutes") })

        val fast = PaceCoach(listOf(part("push", 60, 330.0)))
        val f = fast.leg(0, 0, 0.0, 60_000, 290.0).said
        assertEquals(2, f.size)
        assertTrue(f[1].second.startsWith("Strong!"))

        val surge = PaceCoach(listOf(part("surge", 20, 300.0)))
        val s = surge.leg(0, 0, 0.0, 20_000, 400.0).said
        assertEquals(1, s.size)
        assertTrue(s[0].second.startsWith("Surge! 20 seconds at 5 minutes per kilometre"))
    }

    @Test
    fun easesAfterMissesInARow() {
        val parts = (0 until 4).flatMap { listOf(part("push", 60, 330.0), part("float", 60, 380.0)) } +
            part("cooldown", 180, null)
        val c = PaceCoach(parts)
        var r = c.leg(0, 0, 0.0, 60_000, 370.0)
        r = c.leg(1, r.endT, r.endD, 60_000, 380.0)
        assertEquals(1.0, c.scale, 0.0)
        r = c.leg(2, r.endT, r.endD, 60_000, 370.0)
        val next = c.startSegment(3, r.endT, r.endD)
        assertTrue(next[0].contains("a little gentler"))
        assertEquals(1, c.eases)
        assertEquals(345.0, c.pace(4)!!, 0.0)
        assertEquals(395.0, c.pace(5)!!, 0.0)
        assertNull(c.pace(8))
        assertTrue(c.startSegment(8, 1_000_000, 3000.0)[0].startsWith("Cool down"))

        val ok = PaceCoach(parts)
        r = ok.leg(0, 0, 0.0, 60_000, 370.0)
        r = ok.leg(1, r.endT, r.endD, 60_000, 380.0)
        r = ok.leg(2, r.endT, r.endD, 60_000, 335.0)
        r = ok.leg(3, r.endT, r.endD, 60_000, 380.0)
        r = ok.leg(4, r.endT, r.endD, 60_000, 370.0)
        ok.startSegment(5, r.endT, r.endD)
        assertEquals(0, ok.eases)
    }

    @Test
    fun standingStillIsNotNagged() {
        val c = PaceCoach(listOf(part("cruise", 120, 360.0)))
        c.startSegment(0, 0, 50.0)
        val said = mutableListOf<String>()
        var t = 0L
        while (t < 120_000) { said += c.tick(t, 50.0); t += 500 }
        assertTrue(said.isEmpty())
        assertNull(c.status)
    }

    @Test
    fun engineLetsTheCoachAnnounce() {
        val engine = RunEngine(
            RunConfig(runId = 1, guided = listOf(part("warmup", 60, 420.0), GuidedSegment("cooldown", 60, "Easy", role = "cooldown"))),
            now = 0,
        )
        val first = engine.tick(5_000)
        assertTrue(first.any { it.startsWith("Tune-In run. Warm up easy") })
        assertTrue(engine.coachActive)
        assertTrue(engine.tick(65_000).any { it.startsWith("Cool down. That's the work done") })
    }
}
