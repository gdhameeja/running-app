package com.gdhameeja.runtracker.tracking

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class RunEngineTest {

    private val t0 = 1_700_000_000_000L
    private val metresPerDegLat = 6371000.0 * Math.PI / 180

    /** Simulates running due north at [speed] m/s with one fix per second. */
    private class Runner(val engine: RunEngine, var now: Long, var lat: Double = 52.0, val lng: Double = 4.0) {
        val spoken = mutableListOf<String>()

        fun run(seconds: Int, speed: Double, accuracy: Double = 5.0) {
            repeat(seconds) {
                now += 1000
                lat += speed / (6371000.0 * Math.PI / 180)
                spoken += engine.onLocation(lat, lng, accuracy, now)
                spoken += engine.tick(now)
            }
        }

        fun idle(ms: Long) {
            var left = ms
            while (left > 0) {
                val step = minOf(500L, left)
                now += step
                left -= step
                spoken += engine.tick(now)
            }
        }
    }

    private fun runner(config: RunConfig = RunConfig(runId = 1)) = Runner(RunEngine(config, t0), t0)

    @Test
    fun steadyRunAccumulatesDistanceAndAnnouncesKilometre() {
        val r = runner()
        r.run(300, 3.5) // 1050 m
        assertEquals(1047.0, r.engine.totalDistance, 5.0)
        assertTrue(r.spoken.any { it.startsWith("You've completed 1 kilometer in ") })
        assertEquals(1, r.engine.pathSegments.size)
        assertTrue(r.engine.timeSeries.any { it.distance == 1000.0 })
    }

    @Test
    fun trackRecordsEveryAcceptedFixWithGpsMotion() {
        val r = runner()
        r.engine.onLocation(52.0, 4.0, 5.0, t0 + 1000, speed = 0.0, bearing = null)
        var lat = 52.0
        for (i in 2..61) {
            lat += 3.5 / metresPerDegLat
            r.engine.onLocation(lat, 4.0, 5.0, t0 + i * 1000L, speed = 3.5, bearing = 0.0)
        }
        r.engine.onLocation(lat, 4.0, 50.0, t0 + 62_000, speed = 9.0, bearing = 90.0) // too inaccurate: ignored
        val track = r.engine.track
        assertEquals(r.engine.pointCount, track.size)
        assertEquals(1000L, track.first().time)
        assertEquals(0.0, track.first().distance, 0.0)
        assertEquals(r.engine.totalDistance, track.last().distance, 1e-9)
        assertTrue(track.zipWithNext().all { (a, b) -> b.time > a.time && b.distance >= a.distance })
        assertEquals(3.5, track.last().speed!!, 0.0)
        assertEquals(0.0, track.last().bearing!!, 0.0)
        assertEquals(3.5, r.engine.lastSpeed!!, 0.0)
        val json = RunJson.trackPoint(track.last())
        assertEquals(7, json.length()) // ..., speed, bearing, altitude
        assertEquals(61_000L, json.getLong(0))
    }

    @Test
    fun inaccurateFixesAreIgnored() {
        val r = runner()
        r.run(60, 3.5, accuracy = 50.0)
        assertEquals(0.0, r.engine.totalDistance, 0.0)
        assertEquals(50.0, r.engine.lastAccuracy!!, 0.0)
    }

    @Test
    fun teleportingFixIsRejected() {
        val r = runner()
        r.run(10, 3.5)
        val before = r.engine.totalDistance
        r.now += 1000
        r.engine.onLocation(r.lat + 500 / metresPerDegLat, r.lng, 5.0, r.now) // 500 m in 1 s
        assertEquals(before, r.engine.totalDistance, 0.0)
    }

    @Test
    fun gpsGapIsBridgedAsEstimatedDistance() {
        val r = runner()
        r.run(30, 3.5)
        // 60 s without fixes while running 210 m
        r.now += 60_000
        r.lat += 210 / metresPerDegLat
        r.run(10, 3.5)
        assertEquals(30 * 3.5 + 210 + 10 * 3.5, r.engine.totalDistance, 10.0)
        assertEquals(213.5, r.engine.estimatedDistance, 5.0)
        assertEquals(1, r.engine.gapCoords.size)
        assertEquals(2, r.engine.pathSegments.size)
    }

    @Test
    fun pausedTimeAndMovementAreNotCounted() {
        val r = runner()
        r.run(60, 3.5)
        val distance = r.engine.totalDistance
        r.engine.pause(r.now)
        r.now += 120_000
        r.lat += 400 / metresPerDegLat // walked somewhere while paused
        r.engine.resume(r.now)
        assertEquals(60_000, r.engine.elapsedMs(r.now))
        r.run(10, 3.5)
        assertEquals(distance + 9 * 3.5, r.engine.totalDistance, 3.0)
        assertEquals(2, r.engine.pathSegments.size)
        assertEquals(70_000, r.engine.elapsedMs(r.now))
    }

    @Test
    fun guidedRunAnnouncesSegmentsCountdownsAndFinishes() {
        val segments = listOf(GuidedSegment("warmup", 30, "Easy jog"), GuidedSegment("sprint", 15, "All-out effort"))
        val r = runner(RunConfig(runId = 1, guided = segments))
        r.idle(500)
        assertEquals("Get ready. Starting in 5 seconds.", r.spoken.first())
        assertEquals(-1, r.engine.guidedIndex)

        r.idle(5_000)
        assertEquals(0, r.engine.guidedIndex)
        assertTrue(r.spoken.contains("Warm up. Easy jog. 30 seconds."))

        r.idle(30_000)
        assertEquals(1, r.engine.guidedIndex)
        assertTrue(r.spoken.containsAll(listOf("10 seconds", "3", "2", "1", "Sprint. All-out effort. 15 seconds.")))

        r.idle(15_000)
        assertTrue(r.engine.guidedCompleted)
        assertEquals(RunEngine.Status.FINISHED, r.engine.status)
        assertEquals("Workout complete! Great job!", r.spoken.last())
        assertEquals(1, r.spoken.count { it == "10 seconds" }) // 15 s sprint is too short for a 10 s warning
    }

    @Test
    fun guidedClockStopsWhilePaused() {
        val r = runner(RunConfig(runId = 1, guided = listOf(GuidedSegment("run", 60, "Easy"))))
        r.idle(10_000)
        val remaining = r.engine.guidedRemainingMs(r.now)
        r.engine.pause(r.now)
        r.idle(30_000)
        r.engine.resume(r.now)
        assertEquals(remaining, r.engine.guidedRemainingMs(r.now))
    }

    @Test
    fun ghostRaceComparesAtMilestoneAndCallsTheFinish() {
        // Ghost ran 1 km in 5:00 at an even pace
        val ghost = GhostConfig(1000.0, (1..10).map { TimePoint(it * 100.0, it * 30_000L) })
        val r = runner(RunConfig(runId = 1, ghost = ghost))
        r.run(290, 3.5) // ~1015 m in 4:50
        assertTrue(r.spoken.any { it.contains("ahead of your ghost.") })
        assertEquals(true, r.engine.ghostWon)
        assertTrue(r.spoken.contains("You beat your ghost!"))
    }

    @Test
    fun ghostCuesEveryFewHundredMetresAndOnOvertakes() {
        // Ghost at an even 3.0 m/s over 3 km; you start at 2.6 m/s, then surge at 3.6 m/s
        val ghost = GhostConfig(3000.0, (1..30).map { TimePoint(it * 100.0, (it * 100 / 3.0 * 1000).toLong()) })
        val r = runner(RunConfig(runId = 1, ghost = ghost))
        r.run(200, 2.6)
        val behind = r.spoken.filter { it.startsWith("Ghost ") && it.contains("ahead") }
        assertTrue("got ${r.spoken}", behind.isNotEmpty())
        assertTrue(behind.any { it.endsWith(", and pulling away.") })
        r.run(300, 3.6)
        assertTrue("got ${r.spoken}", r.spoken.contains("You've overtaken your ghost!"))
        assertEquals(1, r.spoken.count { it == "You've overtaken your ghost!" })
        assertEquals("15 metres", RunEngine.spokenMetres(14.0))
        assertEquals("1.2 kilometres", RunEngine.spokenMetres(1234.0))
        assertEquals("1 kilometre", RunEngine.spokenMetres(1000.0))
    }

    @Test
    fun ghostConfigAcceptsMetresOrLegacyKilometres() {
        val ts = org.json.JSONArray().put(org.json.JSONObject().put("distance", 100).put("time", 30000))
        val metres = RunJson.parseConfig(org.json.JSONObject().put("runId", 1)
            .put("ghost", org.json.JSONObject().put("targetM", 5230.0).put("timeSeries", ts)))
        assertEquals(5230.0, metres.ghost!!.targetMeters, 0.0)
        val legacy = RunJson.parseConfig(org.json.JSONObject().put("runId", 1)
            .put("ghost", org.json.JSONObject().put("targetKm", 5).put("timeSeries", ts)))
        assertEquals(5000.0, legacy.ghost!!.targetMeters, 0.0)
    }

    @Test
    fun milestoneComparesWithPreviousRun() {
        val previous = listOf(TimePoint(1000.0, 400_000L))
        val r = runner(RunConfig(runId = 1, previousTimeSeries = previous))
        r.run(290, 3.5)
        assertTrue(r.spoken.any { it.endsWith("faster than your last run.") })
    }

    @Test
    fun finishFreezesTheClock() {
        val r = runner()
        r.run(30, 3.5)
        r.engine.finish(r.now)
        r.now += 60_000
        assertEquals(30_000, r.engine.elapsedMs(r.now))
        assertFalse(r.engine.onLocation(r.lat, r.lng, 5.0, r.now).isNotEmpty())
        assertNull(r.engine.ghostWon)
    }

    @Test
    fun formatsTimeLikeTheWebApp() {
        assertEquals("0:05", RunEngine.formatTime(5))
        assertEquals("12:00", RunEngine.formatTime(720))
    }

    // ─── GPS warnings (same cases as GpsWatch in tests.js) ───────────────────

    @Test
    fun warnsWhenThereIsNoFirstFix() {
        val e = RunEngine(RunConfig(runId = 1), t0)
        assertTrue(e.tick(t0 + 59_000).isEmpty())
        assertEquals(listOf("Still no GPS. Distance isn't counting yet."), e.tick(t0 + 60_000))
        assertTrue(e.gpsLost)
        assertTrue(e.tick(t0 + 61_000).isEmpty())
    }

    @Test
    fun warnsWhenGpsGoesQuietAndSaysWhenItIsBack() {
        val r = runner()
        r.run(10, 3.0)
        val quiet = r.now
        assertTrue(r.engine.tick(quiet + 29_000).isEmpty())
        assertEquals(listOf("GPS signal lost. Distance isn't counting."), r.engine.tick(quiet + 30_500))
        assertTrue(RunJson.summary(r.engine, quiet + 31_000).getBoolean("gpsLost"))
        assertTrue(r.engine.tick(quiet + 300_000).isEmpty())
        assertEquals(listOf("GPS signal lost. Distance isn't counting."), r.engine.tick(quiet + 331_000))
        r.engine.onLocation(52.1, 4.0, 5.0, quiet + 332_000)
        assertFalse(r.engine.gpsLost)
        assertEquals(listOf("GPS is back."), r.engine.tick(quiet + 332_500))
        assertTrue(r.engine.tick(quiet + 333_000).isEmpty())
    }

    @Test
    fun weakFixesDoNotCountAsGps() {
        val r = runner()
        r.run(10, 3.0)
        val quiet = r.now
        r.engine.onLocation(52.0, 4.0, 60.0, quiet + 20_000)
        assertEquals(listOf("GPS signal lost. Distance isn't counting."), r.engine.tick(quiet + 30_500))
    }

    @Test
    fun noGpsWarningsWhilePausedAndTheWaitStartsOverOnResume() {
        val r = runner()
        r.run(10, 3.0)
        val at = r.now
        r.engine.pause(at)
        assertTrue(r.engine.tick(at + 120_000).isEmpty())
        r.engine.resume(at + 120_000)
        assertTrue(r.engine.tick(at + 121_000).isEmpty())
        assertTrue(r.engine.tick(at + 149_000).isEmpty())
    }

    @Test
    fun switchingLocationOffWarnsAtOnce() {
        val r = runner()
        r.run(10, 3.0)
        val said = r.engine.onGpsOff(r.now + 1000)
        assertEquals(1, said.size)
        assertTrue(said[0].contains("switched off"))
        assertTrue(r.engine.gpsLost)
        assertTrue(r.engine.coachLog.any { it.second == said[0] })
    }

    @Test
    fun summaryStaysSmallButSnapshotCarriesTheMeta() {
        val e = RunEngine(RunConfig(runId = 1, meta = "{\"a\":1}"), t0)
        assertFalse(RunJson.summary(e, t0).has("meta"))
        assertEquals("{\"a\":1}", RunJson.snapshot(e, t0).getString("meta"))
    }
}
