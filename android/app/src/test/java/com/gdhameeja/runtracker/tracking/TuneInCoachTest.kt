package com.gdhameeja.runtracker.tracking

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// Mirrors the Tune-In tests in tests.js, so coach.js and TuneInCoach agree.
class TuneInCoachTest {

    private val min = 60_000L

    private fun coached(target: Int, minutes: Int, surges: Boolean = false) =
        GuidedSegment("run", minutes * 60, "", target = target, surges = surges)

    private fun TuneInCoach.ticks(from: Long, to: Long): List<Pair<Long, String>> {
        val out = mutableListOf<Pair<Long, String>>()
        var t = from
        while (t <= to) { tick(t).forEach { out += t to it }; t += 500 }
        return out
    }

    @Test
    fun checksInAndNudges() {
        val c = TuneInCoach(listOf(GuidedSegment("warmup", 300, ""), coached(3, 20)))
        c.startSegment(0, 0)
        assertTrue(c.ticks(0, 5 * min - 500).isEmpty())
        c.startSegment(1, 5 * min)
        assertTrue(c.ticks(5 * min, 5 * min + 89_000).isEmpty())
        val ask = c.ticks(5 * min + 90_000, 5 * min + 90_000)
        assertEquals(1, ask.size)
        assertTrue(c.isAsking)

        assertTrue(c.rate(4, 5 * min + 95_000)[0].startsWith("Ease off"))
        assertTrue(c.rate(4, 5 * min + 160_000)[0].contains("gentler"))
        assertEquals(2, c.target())

        assertTrue(c.rate(5, 6 * min)[0].contains("back right off"))
        assertEquals(TuneInCoach.Mode.RECOVER, c.mode)
        assertTrue(c.tick(6 * min + 30_000).isEmpty())
        assertTrue(c.tick(7 * min)[0].contains("settle back in"))
        assertEquals(2, c.target())
    }

    @Test
    fun raisesTargetWhenTooEasyButNeverAboveFour() {
        val c = TuneInCoach(listOf(coached(3, 30)))
        c.startSegment(0, 0)
        c.rate(2, 100_000)
        assertTrue(c.rate(1, 170_000)[0].contains("flying"))
        assertEquals(4, c.target())
        c.rate(1, 240_000)
        c.rate(1, 300_000)
        assertEquals(4, c.target())
        assertEquals(4, c.ratings.size)
        assertEquals(2, c.ratings[0].second)
        // Too easy / just right / too hard from the notification
        assertTrue(c.rateRelative(0, 360_000)[0].let { it.startsWith("Perfect") || it.startsWith("Spot on") || it.startsWith("Lovely") })
    }

    @Test
    fun surgesAdaptToRatings() {
        val c = TuneInCoach(listOf(coached(3, 20, surges = true)))
        c.startSegment(0, 0)
        c.ticks(0, 90_000)
        c.rate(3, 92_000)
        val surge = c.ticks(92_000, 170_000).first { it.second.startsWith("Surge! 30 seconds") }
        assertEquals(167_000L, surge.first)
        assertTrue(c.ticks(170_000, 200_000).any { it.second.contains("How was that surge") })
        assertTrue(c.rate(2, 200_000)[0].contains("45 seconds"))
        c.rate(3, 300_000)
        val said = c.ticks(300_000, 430_000)
        assertTrue(said.any { it.second.startsWith("Surge! 45 seconds") })
        assertTrue(c.rate(5, 431_000)[0].contains("shorter"))
        assertEquals(TuneInCoach.Mode.RECOVER, c.mode)

        val noSurges = TuneInCoach(listOf(coached(3, 20)))
        noSurges.startSegment(0, 0)
        noSurges.rate(3, 92_000)
        assertFalse(noSurges.ticks(92_000, 15 * min).any { it.second.startsWith("Surge") })
    }

    @Test
    fun engineSpeaksScriptedSegmentsAndRecordsRatings() {
        val segments = listOf(
            GuidedSegment("play", 10, "By feel", label = "Hands up!", say = "Hands up! Throw both arms up."),
            coached(3, 5),
        )
        val t0 = 1_700_000_000_000L
        val e = RunEngine(RunConfig(runId = 1, guided = segments), t0)
        val spoken = mutableListOf<String>()
        var now = t0
        while (now < t0 + 6_000) { now += 500; spoken += e.tick(now) }
        assertTrue(spoken.contains("Hands up! Throw both arms up."))
        assertEquals("Hands up!", RunEngine.segmentName(segments[0]))
        assertFalse(e.coachActive)
        while (now < t0 + 16_000) { now += 500; spoken += e.tick(now) }
        assertTrue(e.coachActive)
        assertTrue(e.rate(5, now)[0].contains("back right off"))
        val json = RunJson.summary(e, now).getJSONObject("coach")
        assertEquals("recover", json.getString("mode"))
        assertTrue(json.getString("instruction").startsWith("Back off"))
        assertEquals(1, RunJson.snapshot(e, now).getJSONArray("ratings").length())
    }
}
