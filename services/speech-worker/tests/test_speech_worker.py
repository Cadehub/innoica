"""Unit and integration tests for Innoica Speech Worker (PyAV OGG/Opus + FastAPI)."""

from __future__ import annotations

import io
import math
import os
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import bootstrap_env

bootstrap_env.bootstrap()

import av
import numpy as np
from fastapi.testclient import TestClient

from app import create_app
from audio_utils import AudioValidationError, decode_audio_to_pcm16k, sniff_audio_container
from transcriber import WhisperTranscriber, classify_quality


def synthesize_ogg_opus(duration_sec: float = 1.2, amplitude: float = 0.25, freq_hz: float = 220.0) -> bytes:
    """Synthesize a valid in-memory OGG/Opus voice-like buffer using PyAV."""
    sample_rate = 48000
    num_samples = int(duration_sec * sample_rate)
    t = np.linspace(0, duration_sec, num_samples, endpoint=False, dtype=np.float32)
    # Speech-like amplitude modulation on tone
    envelope = 0.5 + 0.5 * np.sin(2.0 * math.pi * 3.0 * t)
    waveform = (amplitude * envelope * np.sin(2.0 * math.pi * freq_hz * t)).astype(np.float32)

    out_buf = io.BytesIO()
    container = av.open(out_buf, mode="w", format="ogg")
    stream = container.add_stream("libopus", rate=sample_rate, layout="mono")
    chunk_size = 960
    for idx in range(0, num_samples, chunk_size):
        chunk = waveform[idx : idx + chunk_size]
        if chunk.size < chunk_size:
            chunk = np.pad(chunk, (0, chunk_size - chunk.size))
        frame = av.AudioFrame.from_ndarray(chunk.reshape(1, -1), format="flt", layout="mono")
        frame.sample_rate = sample_rate
        for packet in stream.encode(frame):
            container.mux(packet)
    for packet in stream.encode(None):
        container.mux(packet)
    container.close()
    return out_buf.getvalue()


class FakeWhisperModel:
    """Deterministic fake model matching faster-whisper WhisperModel.transcribe contract."""

    def __init__(self, text: str, language: str, lang_prob: float, avg_logprob: float, no_speech_prob: float) -> None:
        self._text = text
        self._language = language
        self._lang_prob = lang_prob
        self._avg_logprob = avg_logprob
        self._no_speech_prob = no_speech_prob

    def transcribe(self, samples, **_kwargs):
        assert samples.dtype == np.float32
        seg = SimpleNamespace(
            text=self._text,
            avg_logprob=self._avg_logprob,
            no_speech_prob=self._no_speech_prob,
        )
        info = SimpleNamespace(language=self._language, language_probability=self._lang_prob)
        return iter([seg]), info


class SpeechWorkerTests(unittest.TestCase):
    def setUp(self) -> None:
        os.environ["WORKER_INTERNAL_SECRET"] = "test-voice-secret-123456"

    def test_ogg_opus_decode_and_speech_detection(self) -> None:
        ogg_bytes = synthesize_ogg_opus(duration_sec=1.0, amplitude=0.3)
        self.assertEqual(sniff_audio_container(ogg_bytes), "ogg")
        decoded = decode_audio_to_pcm16k(ogg_bytes, claimed_mime="audio/ogg; codecs=opus")
        self.assertEqual(decoded.sample_rate, 16000)
        self.assertEqual(decoded.detected_format, "ogg")
        self.assertFalse(decoded.is_silent)
        self.assertGreater(decoded.duration_seconds, 0.85)

    def test_pure_silence_detected_without_model(self) -> None:
        silent_ogg = synthesize_ogg_opus(duration_sec=1.0, amplitude=0.0)
        transcriber = WhisperTranscriber(injected_model=FakeWhisperModel("bonjour", "fr", 0.99, -0.2, 0.01))
        result = transcriber.transcribe_bytes(silent_ogg, claimed_mime="audio/ogg; codecs=opus")
        self.assertTrue(result.ok)
        self.assertEqual(result.quality_category, "no_speech")
        self.assertEqual(result.transcript, "")

    def test_corrupted_and_spoofed_audio_rejected(self) -> None:
        with self.assertRaises(AudioValidationError) as ctx1:
            decode_audio_to_pcm16k(b"#!/bin/bash\nrm -rf /\n", claimed_mime="audio/ogg")
        self.assertEqual(ctx1.exception.code, "unsupported_container")

        valid_ogg = synthesize_ogg_opus(duration_sec=0.5, amplitude=0.2)
        with self.assertRaises(AudioValidationError) as ctx2:
            decode_audio_to_pcm16k(valid_ogg, claimed_mime="audio/wav")
        self.assertEqual(ctx2.exception.code, "mime_mismatch")

    def test_oversized_audio_rejected(self) -> None:
        with self.assertRaises(AudioValidationError) as ctx:
            decode_audio_to_pcm16k(b"OggS" + b"\x00" * 500, max_bytes=128)
        self.assertEqual(ctx.exception.code, "audio_too_large")

    def test_quality_classification_categories(self) -> None:
        self.assertEqual(classify_quality("Bonjour je veux commander deux boites", "fr", 0.96, -0.25, 0.04, 0.7), "high")
        self.assertEqual(classify_quality("Hello please send the price", "en", 0.93, -0.35, 0.08, 0.6), "high")
        self.assertEqual(classify_quality("oui ... livraison demain", "fr", 0.50, -0.95, 0.25, 0.4), "partial")
        self.assertEqual(classify_quality("mh", "unknown", 0.12, -1.8, 0.7, 0.05), "low")
        self.assertEqual(classify_quality("", "fr", 0.9, -0.5, 0.9, 0.0), "no_speech")

    def test_fastapi_endpoints_secret_and_french_english_transcription(self) -> None:
        ogg_fr = synthesize_ogg_opus(duration_sec=0.8, amplitude=0.25)
        fake = FakeWhisperModel("Bonjour, quels sont vos tarifs a Douala ?", "fr", 0.97, -0.22, 0.03)
        app = create_app(transcriber=WhisperTranscriber(injected_model=fake))
        with TestClient(app) as client:
            health = client.get("/health")
            self.assertEqual(health.status_code, 200)
            self.assertFalse(health.json()["paidApiFallback"])
            self.assertTrue(health.json()["modelLoaded"])

            unauth = client.post("/api/transcribe", content=ogg_fr, headers={"x-worker-secret": "wrong"})
            self.assertEqual(unauth.status_code, 401)

            ok = client.post(
                "/api/transcribe",
                files={"file": ("voice.ogg", ogg_fr, "audio/ogg; codecs=opus")},
                headers={"x-worker-secret": "test-voice-secret-123456"},
            )
            self.assertEqual(ok.status_code, 200)
            body = ok.json()
            self.assertTrue(body["ok"])
            self.assertEqual(body["detectedLanguage"], "fr")
            self.assertEqual(body["qualityCategory"], "high")
            self.assertIn("Douala", body["transcript"])

    def test_missing_local_model_returns_processing_error_without_paid_fallback(self) -> None:
        ogg_en = synthesize_ogg_opus(duration_sec=0.8, amplitude=0.25)
        transcriber = WhisperTranscriber(model_size="nonexistent-local-only-model")
        result = transcriber.transcribe_bytes(ogg_en, claimed_mime="audio/ogg")
        self.assertFalse(result.ok)
        self.assertEqual(result.quality_category, "processing_error")
        self.assertEqual(result.transcript, "")


if __name__ == "__main__":
    unittest.main(verbosity=2)
