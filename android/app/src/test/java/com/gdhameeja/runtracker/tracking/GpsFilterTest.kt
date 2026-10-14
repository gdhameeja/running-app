package com.gdhameeja.runtracker.tracking

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Random
import kotlin.math.abs
import kotlin.math.exp
import kotlin.math.sqrt

class GpsFilterTest {

    private val t0 = 1_700_000_000_000L
    private val lat0 = 52.0
    private val lng0 = 4.0
    private val m = 6371000.0 * Math.PI / 180

    /**
     * Running due north at [speed] m/s, one fix a second, with realistic GPS
     * error: slowly wandering (Gauss-Markov, 3 m, 40 s) plus a little jitter,
     * and Doppler speed/bearing with 0.15 m/s noise. Returns the true distance.
     */
    private fun noisyRun(engine: RunEngine, seconds: Int, speed: Double, seed: Long): Double {
        val rnd = Random(seed)
        val phi = exp(-1 / 40.0)
        val q = 3 * sqrt(1 - phi * phi)
        var ex = 3 * rnd.nextGaussian()
        var ey = 3 * rnd.nextGaussian()
        var y = 0.0
        for (t in 1..seconds) {
            y += speed
            ex = phi * ex + q * rnd.nextGaussian()
            ey = phi * ey + q * rnd.nextGaussian()
            val lat = lat0 + (y + ey + 0.5 * rnd.nextGaussian()) / m
            val lng = lng0 + (ex + 0.5 * rnd.nextGaussian()) / (m * Math.cos(Math.toRadians(lat0)))
            val vx = 0.15 * rnd.nextGaussian()
            val vy = speed + 0.15 * rnd.nextGaussian()
            val bearing = (Math.toDegrees(Math.atan2(vx, vy)) + 360) % 360
            engine.onLocation(lat, lng, 5.0, t0 + t * 1000L, sqrt(vx * vx + vy * vy), bearing)
        }
        return y - speed // the first fix only sets the start
    }

    @Test
    fun noisyRunDistanceIsWithinOnePercent() {
        var worst = 0.0
        for (seed in 1L..5L) {
            val engine = RunEngine(RunConfig(runId = 1), t0)
            val truth = noisyRun(engine, 600, 3.3, seed)
            worst = maxOf(worst, abs(engine.totalDistance - truth) / truth)
        }
        assertTrue("worst error ${worst * 100}%", worst < 0.01)
    }

    @Test
    fun currentSpeedFollowsTheRunner() {
        val engine = RunEngine(RunConfig(runId = 1), t0)
        noisyRun(engine, 120, 3.3, 7)
        assertEquals(3.3, engine.currentSpeed!!, 0.3)
        val json = RunJson.summary(engine, t0 + 121_000)
        assertEquals(3.3, json.getDouble("currentSpeed"), 0.3)
        assertEquals(1000L, json.getLong("currentSpeedAgeMs"))
    }

    @Test
    fun singleGlitchIsIgnoredButThreeInARowRestart() {
        val f = GpsFilter()
        for (t in 1..30) f.update(lat0 + 3.0 * t / m, lng0, 5.0, t * 1000L, 3.0, 0.0)
        assertNull("80 m jump in a second", f.update(lat0 + 173 / m, lng0, 5.0, 31_000, 3.0, 0.0))
        val back = f.update(lat0 + 96 / m, lng0, 5.0, 32_000, 3.0, 0.0)
        assertNotNull(back)
        assertEquals(96.0, (back!!.lat - lat0) * m, 3.0)
        assertNull(f.update(lat0 + 500 / m, lng0, 5.0, 33_000, 0.0, null))
        assertNull(f.update(lat0 + 500 / m, lng0, 5.0, 34_000, 0.0, null))
        val restarted = f.update(lat0 + 500 / m, lng0, 5.0, 35_000, 0.0, null)
        assertEquals(500.0, (restarted!!.lat - lat0) * m, 1.0)
    }

    @Test
    fun standingStillWithJitterAddsNoDistance() {
        val engine = RunEngine(RunConfig(runId = 1), t0)
        val rnd = Random(3)
        for (t in 1..180) {
            engine.onLocation(lat0 + 2 * rnd.nextGaussian() / m, lng0 + 2 * rnd.nextGaussian() / m, 5.0, t0 + t * 1000L, 0.1, null)
        }
        assertTrue("drifted ${engine.totalDistance} m", engine.totalDistance < 10)
        assertTrue(engine.currentSpeed!! < 0.3)
    }
}
