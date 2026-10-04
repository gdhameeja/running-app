package com.gdhameeja.runtracker.tracking

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import java.util.Locale
import java.util.concurrent.atomic.AtomicInteger

// Android TextToSpeech wrapper. Unlike the browser's speechSynthesis it keeps
// talking with the screen off, and it ducks music while speaking.
class Speaker(context: Context) {

    private val main = Handler(Looper.getMainLooper())
    private val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private val attributes = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
        .build()
    private val focusRequest: AudioFocusRequest? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                .setAudioAttributes(attributes)
                .build()
        } else null

    private var ready = false
    private val pending = mutableListOf<String>()
    private val inFlight = AtomicInteger(0)
    private val idleCallbacks = mutableListOf<() -> Unit>()
    private var nextId = 0

    private val tts: TextToSpeech

    init {
        tts = TextToSpeech(context.applicationContext) { status -> main.post { onInit(status) } }
        tts.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) {}
            override fun onDone(utteranceId: String?) = finished()
            @Suppress("OVERRIDE_DEPRECATION")
            override fun onError(utteranceId: String?) = finished()
            override fun onError(utteranceId: String?, errorCode: Int) = finished()
        })
    }

    private fun onInit(status: Int) {
        ready = status == TextToSpeech.SUCCESS
        if (ready) {
            tts.language = Locale.US
            tts.setAudioAttributes(attributes)
            pending.forEach(::speak)
        }
        pending.clear()
        if (!ready) notifyIfIdle()
    }

    private fun finished() {
        if (inFlight.decrementAndGet() <= 0) {
            inFlight.set(0)
            main.post {
                abandonFocus()
                notifyIfIdle()
            }
        }
    }

    fun speak(text: String) {
        if (!ready) { pending += text; return }
        if (inFlight.getAndIncrement() == 0) requestFocus()
        tts.speak(text, TextToSpeech.QUEUE_ADD, null, "u${nextId++}")
    }

    /** Runs [callback] once everything queued so far has been spoken. */
    fun whenIdle(callback: () -> Unit) {
        idleCallbacks += callback
        notifyIfIdle()
    }

    private fun notifyIfIdle() {
        if (inFlight.get() > 0 || pending.isNotEmpty()) return
        val callbacks = idleCallbacks.toList()
        idleCallbacks.clear()
        callbacks.forEach { it() }
    }

    fun shutdown() {
        abandonFocus()
        tts.stop()
        tts.shutdown()
    }

    private fun requestFocus() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            audioManager.requestAudioFocus(focusRequest!!)
        } else {
            @Suppress("DEPRECATION")
            audioManager.requestAudioFocus(null, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
        }
    }

    private fun abandonFocus() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            audioManager.abandonAudioFocusRequest(focusRequest!!)
        } else {
            @Suppress("DEPRECATION")
            audioManager.abandonAudioFocus(null)
        }
    }
}
