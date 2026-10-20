package com.gdhameeja.runtracker.tracking

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// The extra data a run records for learning: raw fixes, altitude, steps,
// pauses, what was said, and how each Tune-In part went.
class RunDataTest {

    private val t0 = 1_700_000_000_000L
    private val metresPerDegLat = 6371000.0 * Math.PI / 180

    @Test
    fun rawFixesKeepEverythingIncludingRejected() {
        val e = RunEngine(RunConfig(runId = 1), t0)
        e.onLocation(52.0, 4.0, 5.0, t0 + 1000, speed = 0.0, bearing = null, altitude = 12.3)
        e.onLocation(52.0 + 5 / metresPerDegLat, 4.0, 5.0, t0 + 2000, speed = 3.0, bearing = 0.0, altitude = 12.8)
        e.onLocation(52.1, 4.0, 60.0, t0 + 3000, altitude = 40.0) // too inaccurate: not in the track
        assertEquals(3, e.raw.size)
        assertEquals(60.0, e.raw[2].accuracy!!, 0.0)
        assertEquals(2, e.track.size)
        assertEquals(12.8, e.track[1].altitude!!, 0.0)
        val json = RunJson.snapshot(e, t0 + 3000)
        assertEquals(7, json.getJSONArray("track").getJSONArray(0).length())
        assertEquals(40.0, json.getJSONArray("raw").getJSONArray(2).getDouble(4), 0.0)
    }

    @Test
    fun stepsGiveCadenceAndIgnorePauses() {
        val e = RunEngine(RunConfig(runId = 1), t0)
        assertNull(e.cadence(t0))
        var boot = 50_000L
        for (s in 0..60) e.onSteps(boot + s * 3L, t0 + s * 1000L) // 3 steps/s = 180 spm
        assertEquals(180.0, e.cadence(t0 + 60_000)!!, 1.0)
        e.pause(t0 + 60_000)
        e.onSteps(boot + 180 + 500, t0 + 90_000) // walking about while paused
        e.resume(t0 + 120_000)
        boot += 500
        for (s in 61..90) e.onSteps(boot + s * 3L, t0 + 60_000 + s * 1000L)
        // Every sample is 3 steps a second of running: the 500 taken while paused aren't in it
        val last = e.steps.last()
        assertEquals(0L, last.second % 3)
        assertEquals(last.second, last.first / 1000 * 3)
        assertEquals(listOf(60_000L to 60_000L), e.pauses)
    }

    @Test
    fun coachLogAndPartResults() {
        val segs = listOf(
            GuidedSegment("run", 60, "", role = "cruise", pace = 360.0),
            GuidedSegment("cooldown", 60, "", role = "cooldown"),
        )
        val e = RunEngine(RunConfig(runId = 1, guided = segs), t0)
        var lat = 52.0
        // Run the cruise at 6:00/km (2.78 m/s)
        for (s in 1..70) {
            lat += 1000.0 / 360 / metresPerDegLat
            e.onLocation(lat, 4.0, 5.0, t0 + s * 1000L)
            e.tick(t0 + s * 1000L)
        }
        assertTrue(e.coachLog.any { it.second.startsWith("Steady. 6 minutes per kilometre") })
        assertTrue(e.coachLog.any { it.second.startsWith("Cool down") })
        val part = e.coach!!.results.single()
        assertEquals(0, part.index)
        assertEquals(360.0, part.actual!!, 15.0)
        val json = RunJson.snapshot(e, t0 + 70_000)
        assertEquals(1, json.getJSONObject("coachResults").getJSONArray("parts").length())
    }

    @Test
    fun shortStepsTurnSlowCueIntoStrideCue() {
        val c = PaceCoach(listOf(GuidedSegment("run", 120, "", role = "cruise", pace = 360.0)))
        c.startSegment(0, 0, 0.0)
        val said = mutableListOf<String>()
        var t = 0L
        while (t <= 30_000) { said += c.tick(t, t / 400.0, cadence = 150.0); t += 500 }
        assertTrue(said.single().startsWith("Quicker, lighter steps"))
    }
}
