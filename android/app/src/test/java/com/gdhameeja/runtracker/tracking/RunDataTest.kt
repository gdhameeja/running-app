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

    // ─── Carrying on after the app was killed ────────────────────────────────

    /** Saves to JSON text and back, as the snapshot file does. */
    private fun reload(e: RunEngine, savedAt: Long): RunEngine =
        RunJson.restore(org.json.JSONObject(RunJson.snapshot(e, savedAt).toString()), e.config)

    private fun runFor(e: RunEngine, from: Int, to: Int, step: Double = 3.0) {
        for (s in from until to) {
            e.onLocation(52.0 + s * step / metresPerDegLat, 4.0, 5.0, t0 + s * 1000L, speed = step, bearing = 0.0, altitude = 10.0)
            e.onSteps(50_000L + s * 3, t0 + s * 1000L)
            e.tick(t0 + s * 1000L)
        }
    }

    @Test
    fun aRestoredRunHasEverythingItHadAndComesBackPaused() {
        val e = RunEngine(RunConfig(runId = 7), t0)
        runFor(e, 0, 400)
        val saved = t0 + 400_000
        val r = reload(e, saved)
        assertEquals(RunEngine.Status.PAUSED, r.status)
        assertEquals(7L, r.config.runId)
        assertEquals(e.totalDistance, r.totalDistance, 0.0)
        assertEquals(e.elapsedMs(saved), r.elapsedMs(saved + 600_000))
        assertEquals(e.track.size, r.track.size)
        assertEquals(e.raw.size, r.raw.size)
        assertEquals(e.timeSeries.size, r.timeSeries.size)
        assertEquals(e.steps, r.steps)
        assertEquals(e.pointCount, r.pointCount)
        assertEquals(e.coachLog, r.coachLog)
        assertEquals(e.track.last().altitude!!, r.track.last().altitude!!, 0.0)
    }

    @Test
    fun timeAwayCountsAsAPauseAndNoDistanceIsInvented() {
        val e = RunEngine(RunConfig(runId = 7), t0)
        runFor(e, 0, 400)
        val saved = t0 + 400_000
        val r = reload(e, saved)
        val before = r.totalDistance
        val back = saved + 600_000 // ten minutes later, 2 km away
        r.resume(back)
        assertEquals(1, r.pauses.size)
        assertEquals(400_000L, r.pauses[0].first)
        assertEquals(600_000L, r.pauses[0].second)
        assertEquals(400_000L, r.elapsedMs(back))
        r.onLocation(52.0 + 2000 / metresPerDegLat, 4.0, 5.0, back + 1000, 3.0, 0.0)
        assertEquals(before, r.totalDistance, 0.0)
        assertEquals(2, r.pathSegments.size)
        r.onLocation(52.0 + 2003 / metresPerDegLat, 4.0, 5.0, back + 2000, 3.0, 0.0)
        r.onLocation(52.0 + 2006 / metresPerDegLat, 4.0, 5.0, back + 3000, 3.0, 0.0)
        assertTrue(r.totalDistance > before && r.totalDistance < before + 10)
    }

    @Test
    fun theNextKilometreAndStepsCarryOnFromWhereTheyWere() {
        val e = RunEngine(RunConfig(runId = 7), t0)
        runFor(e, 0, 300) // ~900 m
        val saved = t0 + 300_000
        val r = reload(e, saved)
        val back = saved + 60_000
        r.resume(back)
        val said = mutableListOf<String>()
        for (s in 1..50) said += r.onLocation(52.0 + (900 + s * 3.0) / metresPerDegLat, 4.0, 5.0, back + s * 1000L, 3.0, 0.0)
        assertEquals(said.toString(), 1, said.count { it.contains("completed 1 kilometer") })
        assertTrue(said.toString(), said.none { it.contains("completed 2") })
        val stepsBefore = e.state().stepCount // ahead of the last 5-second sample
        r.onSteps(900_000, back + 60_000) // new baseline after the restart
        r.onSteps(900_030, back + 70_000)
        assertEquals(stepsBefore + 30, r.steps.last().second)
    }

    @Test
    fun aRunPausedBeforeTheKillKeepsItsOwnPauseStart() {
        val e = RunEngine(RunConfig(runId = 7), t0)
        runFor(e, 0, 100)
        val pausedAt = t0 + 100_000
        e.pause(pausedAt)
        val r = reload(e, pausedAt + 300_000)
        r.resume(pausedAt + 500_000)
        assertEquals(500_000L, r.pauses[0].second)
        assertEquals(100_000L, r.elapsedMs(pausedAt + 500_000))
    }

    @Test
    fun aGuidedRunCarriesOnInTheSameSegmentWithItsCoach() {
        val segs = listOf(
            GuidedSegment("run", 120, "x", role = "cruise", pace = 300.0),
            GuidedSegment("run", 120, "x", role = "push", pace = 280.0),
            GuidedSegment("run", 120, "x", role = "cruise", pace = 300.0),
        )
        val e = RunEngine(RunConfig(runId = 7, guided = segs), t0)
        runFor(e, 0, 200) // into the second segment
        assertEquals(1, e.guidedIndex)
        val saved = t0 + 200_000
        val r = reload(e, saved)
        assertEquals(1, r.guidedIndex)
        assertEquals(1, r.coach!!.seg)
        assertEquals(e.coach!!.results.size, r.coach!!.results.size)
        assertEquals(e.guidedRemainingMs(saved), r.guidedRemainingMs(saved + 100_000))
        val back = saved + 100_000
        r.resume(back)
        r.tick(back + 1000)
        assertEquals("Doesn't restart the workout", 1, r.guidedIndex)
        val spoken = mutableListOf<String>()
        var t = back + 1000
        while (r.status != RunEngine.Status.FINISHED && t < back + 400_000) { t += 500; spoken += r.tick(t) }
        assertTrue(spoken.toString(), spoken.contains("Workout complete! Great job!"))
        assertTrue(r.guidedCompleted)
    }

    @Test
    fun aGhostRaceCarriesOnAndCanStillBeWon() {
        val ghost = GhostConfig(1000.0, listOf(TimePoint(0.0, 0), TimePoint(1000.0, 500_000)))
        val e = RunEngine(RunConfig(runId = 7, ghost = ghost), t0)
        runFor(e, 0, 100)
        val r = reload(e, t0 + 100_000)
        assertEquals(1000.0, r.config.ghost!!.targetMeters, 0.0)
        assertNull(r.ghostWon)
    }

    @Test
    fun finishingARestoredRunGivesTheWholeRun() {
        val e = RunEngine(RunConfig(runId = 7), t0)
        runFor(e, 0, 100)
        val saved = t0 + 100_000
        val r = reload(e, saved)
        r.finish(saved + 50_000)
        assertEquals(RunEngine.Status.FINISHED, r.status)
        assertEquals(100_000L, r.elapsedMs(saved + 50_000))
        assertEquals(50_000L, r.pauses[0].second)
        assertEquals(e.track.size, r.track.size)
    }
}
