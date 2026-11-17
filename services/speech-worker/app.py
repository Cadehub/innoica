"""Innoica Speech Worker HTTP microservice (port 4004).

Exposes /health, /api/hardware-audit, and /api/transcribe using local
faster-whisper INT8 inference on CPU with bounded concurrency and zero paid APIs.
"""

from __future__ import annotations

try:
    import bootstrap_env
    bootstrap_env.bootstrap()
except Exception:
    pass

import asyncio
import hmac
import logging
import os
from contextlib import asynccontextmanager
from typing import Optional

import av
import ctranslate2
import faster_whisper
import onnxruntime
import uvicorn
from fastapi import FastAPI, File, Header, HTTPException, Request, UploadFile

from audio_utils import DEFAULT_MAX_AUDIO_BYTES
from transcriber import WhisperTranscriber, get_hardware_snapshot

logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO").upper())
logger = logging.getLogger("innoica-speech-worker")

SPEECH_WORKER_PORT = int(os.environ.get("SPEECH_WORKER_PORT", os.environ.get("PORT", "4004")))
MAX_CONCURRENCY = max(1, int(os.environ.get("VOICE_MAX_CONCURRENCY", "2")))
MAX_QUEUE = max(1, int(os.environ.get("VOICE_MAX_QUEUE", "8")))
TRANSCRIBE_TIMEOUT_SEC = float(os.environ.get("VOICE_TRANSCRIBE_TIMEOUT_SEC", "35"))


class WorkerState:
    def __init__(self, transcriber: Optional[WhisperTranscriber] = None) -> None:
        self.transcriber = transcriber or WhisperTranscriber()
        self.semaphore = asyncio.Semaphore(MAX_CONCURRENCY)
        self.queue_lock = asyncio.Lock()
        self.pending_jobs = 0
        self.active_jobs = 0


def _verify_worker_secret(provided_secret: Optional[str]) -> None:
    expected = (os.environ.get("WORKER_INTERNAL_SECRET") or "").strip()
    if not expected:
        raise HTTPException(status_code=503, detail="WORKER_INTERNAL_SECRET is not configured")
    if not provided_secret or not hmac.compare_digest(provided_secret.encode("utf-8"), expected.encode("utf-8")):
        raise HTTPException(status_code=401, detail="Unauthorized worker secret")


def create_app(transcriber: Optional[WhisperTranscriber] = None) -> FastAPI:
    state = WorkerState(transcriber=transcriber)

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        state.transcriber.load_model()
        yield

    app = FastAPI(title="Innoica Speech Worker", version="1.0.0", lifespan=lifespan)
    app.state.worker = state

    @app.get("/health")
    async def health() -> dict:
        w: WorkerState = app.state.worker
        loaded = w.transcriber.model is not None
        return {
            "ok": True,
            "status": "ok" if loaded else "degraded",
            "service": "innoica-speech-worker",
            "engine": "faster-whisper-ctranslate2",
            "paidApiFallback": False,
            "modelLoaded": loaded,
            "modelError": w.transcriber.load_error,
            "modelSize": w.transcriber.model_size,
            "computeType": w.transcriber.compute_type,
            "device": "cpu",
            "cpuThreads": w.transcriber.cpu_threads,
            "loadTimeMs": w.transcriber.load_time_ms,
            "activeJobs": w.active_jobs,
            "queuedJobs": w.pending_jobs,
            "maxConcurrency": MAX_CONCURRENCY,
            "maxQueue": MAX_QUEUE,
            "hardware": get_hardware_snapshot(),
        }

    @app.get("/api/hardware-audit")
    async def hardware_audit(x_worker_secret: Optional[str] = Header(default=None)) -> dict:
        _verify_worker_secret(x_worker_secret)
        hw = get_hardware_snapshot()
        return {
            "ok": True,
            "hardware": hw,
            "versions": {
                "fasterWhisper": faster_whisper.__version__,
                "ctranslate2": ctranslate2.__version__,
                "pyav": av.__version__,
                "onnxruntime": onnxruntime.__version__,
            },
            "config": {
                "modelSize": app.state.worker.transcriber.model_size,
                "computeType": app.state.worker.transcriber.compute_type,
                "cpuThreads": app.state.worker.transcriber.cpu_threads,
                "beamSize": app.state.worker.transcriber.beam_size,
                "maxConcurrency": MAX_CONCURRENCY,
                "maxQueue": MAX_QUEUE,
            },
        }

    @app.post("/api/transcribe")
    async def transcribe(
        request: Request,
        file: Optional[UploadFile] = File(default=None),
        x_worker_secret: Optional[str] = Header(default=None),
        x_claimed_mime: Optional[str] = Header(default=None),
        x_correlation_id: Optional[str] = Header(default=None),
    ) -> dict:
        _verify_worker_secret(x_worker_secret)
        w: WorkerState = app.state.worker

        async with w.queue_lock:
            if w.pending_jobs >= MAX_QUEUE:
                raise HTTPException(status_code=503, detail="Speech worker queue full")
            w.pending_jobs += 1

        raw_bytes = bytearray()
        claimed_mime = x_claimed_mime
        try:
            if file is not None:
                if not claimed_mime and file.content_type:
                    claimed_mime = file.content_type
                chunk_size = 256 * 1024
                while True:
                    chunk = await file.read(chunk_size)
                    if not chunk:
                        break
                    if len(raw_bytes) + len(chunk) > DEFAULT_MAX_AUDIO_BYTES:
                        return {
                            "ok": False,
                            "qualityCategory": "unsupported",
                            "detectedLanguage": "unknown",
                            "languageProbability": 0.0,
                            "transcript": "",
                            "durationSeconds": 0.0,
                            "processingMs": 0,
                            "errorCode": "audio_too_large",
                        }
                    raw_bytes.extend(chunk)
            else:
                body = await request.body()
                if len(body) > DEFAULT_MAX_AUDIO_BYTES:
                    return {
                        "ok": False,
                        "qualityCategory": "unsupported",
                        "detectedLanguage": "unknown",
                        "languageProbability": 0.0,
                        "transcript": "",
                        "durationSeconds": 0.0,
                        "processingMs": 0,
                        "errorCode": "audio_too_large",
                    }
                raw_bytes.extend(body)

            payload_bytes = bytes(raw_bytes)
            async with w.semaphore:
                w.active_jobs += 1
                try:
                    result = await asyncio.wait_for(
                        asyncio.to_thread(
                            w.transcriber.transcribe_bytes,
                            payload_bytes,
                            claimed_mime,
                            x_correlation_id,
                        ),
                        timeout=TRANSCRIBE_TIMEOUT_SEC,
                    )
                    return result.to_dict()
                except asyncio.TimeoutError:
                    return {
                        "ok": False,
                        "qualityCategory": "processing_error",
                        "detectedLanguage": "unknown",
                        "languageProbability": 0.0,
                        "transcript": "",
                        "durationSeconds": 0.0,
                        "processingMs": int(TRANSCRIBE_TIMEOUT_SEC * 1000),
                        "errorCode": "transcription_timeout",
                    }
                finally:
                    w.active_jobs -= 1
                    del payload_bytes
        finally:
            raw_bytes.clear()
            if file is not None:
                await file.close()
            async with w.queue_lock:
                w.pending_jobs = max(0, w.pending_jobs - 1)

    return app


app = create_app()

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=SPEECH_WORKER_PORT, log_level="info")
