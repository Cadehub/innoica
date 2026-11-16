"""Local faster-whisper INT8 CPU transcriber and hardware auditor."""

from __future__ import annotations

import ctypes
import logging
import os
import platform
import time
from dataclasses import dataclass, field
from typing import Any, Optional

from faster_whisper import WhisperModel

from audio_utils import AudioValidationError, DecodedAudio, decode_audio_to_pcm16k

logger = logging.getLogger("innoica-speech-worker")

SUPPORTED_LANGUAGES = {"fr", "en"}


class SpeechEngineUnavailableError(RuntimeError):
    """Raised when local faster-whisper weights are not loaded or engine fails."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass
class TranscriptionResult:
    """Structured transcription result separating raw signals from quality categories."""

    ok: bool
    quality_category: str  # high | partial | low | no_speech | unsupported | processing_error
    detected_language: str
    language_probability: float
    transcript: str
    duration_seconds: float
    avg_logprob: Optional[float] = None
    no_speech_prob: Optional[float] = None
    speech_ratio: float = 0.0
    processing_ms: int = 0
    error_code: Optional[str] = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "qualityCategory": self.quality_category,
            "detectedLanguage": self.detected_language,
            "languageProbability": round(self.language_probability, 4),
            "transcript": self.transcript,
            "durationSeconds": round(self.duration_seconds, 3),
            "avgLogprob": round(self.avg_logprob, 4) if self.avg_logprob is not None else None,
            "noSpeechProb": round(self.no_speech_prob, 4) if self.no_speech_prob is not None else None,
            "speechRatio": round(self.speech_ratio, 4),
            "processingMs": self.processing_ms,
            "errorCode": self.error_code,
            "metadata": self.metadata,
        }


def get_hardware_snapshot() -> dict[str, Any]:
    """Collect real OS CPU/RAM/GPU facts for capacity planning and /health reporting."""
    logical_cpus = os.cpu_count() or 1
    total_ram_gb: Optional[float] = None
    available_ram_gb: Optional[float] = None

    if platform.system() == "Windows":
        class MEMORYSTATUSEX(ctypes.Structure):
            _fields_ = [
                ("dwLength", ctypes.c_ulong),
                ("dwMemoryLoad", ctypes.c_ulong),
                ("ullTotalPhys", ctypes.c_ulonglong),
                ("ullAvailPhys", ctypes.c_ulonglong),
                ("ullTotalPageFile", ctypes.c_ulonglong),
                ("ullAvailPageFile", ctypes.c_ulonglong),
                ("ullTotalVirtual", ctypes.c_ulonglong),
                ("ullAvailVirtual", ctypes.c_ulonglong),
                ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
            ]

        mem = MEMORYSTATUSEX()
        mem.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
        if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(mem)):
            total_ram_gb = round(mem.ullTotalPhys / (1024 ** 3), 2)
            available_ram_gb = round(mem.ullAvailPhys / (1024 ** 3), 2)
    else:
        try:
            with open("/proc/meminfo", "r", encoding="utf-8") as fh:
                info = {}
                for line in fh:
                    parts = line.split(":")
                    if len(parts) == 2:
                        val = parts[1].strip().split()[0]
                        info[parts[0].strip()] = int(val) * 1024
                if "MemTotal" in info:
                    total_ram_gb = round(info["MemTotal"] / (1024 ** 3), 2)
                if "MemAvailable" in info:
                    available_ram_gb = round(info["MemAvailable"] / (1024 ** 3), 2)
        except OSError:
            pass

    cuda_devices = 0
    try:
        import ctranslate2

        cuda_devices = ctranslate2.get_cuda_device_count()
    except Exception:
        cuda_devices = 0

    return {
        "os": platform.system(),
        "machine": platform.machine(),
        "processor": platform.processor() or "unknown",
        "logicalCpus": logical_cpus,
        "totalRamGb": total_ram_gb,
        "availableRamGb": available_ram_gb,
        "cudaDevices": cuda_devices,
    }


def classify_quality(
    transcript: str,
    detected_language: str,
    language_probability: float,
    avg_logprob: Optional[float],
    no_speech_prob: Optional[float],
    speech_ratio: float,
) -> str:
    """Map raw acoustic/Whisper decoding signals to an internal quality category."""
    clean = transcript.strip()
    if not clean:
        return "no_speech"

    if no_speech_prob is not None and no_speech_prob >= 0.85 and len(clean) < 12:
        return "no_speech"

    if len(clean) < 2:
        return "low"

    lang_ok = detected_language in SUPPORTED_LANGUAGES
    prob = avg_logprob if avg_logprob is not None else -0.6

    if lang_ok and len(clean) >= 4 and prob >= -0.75 and language_probability >= 0.55 and (no_speech_prob or 0.0) < 0.55:
        return "high"

    if prob >= -1.25 and speech_ratio >= 0.02 and (language_probability >= 0.30 or not lang_ok):
        return "partial"

    return "low"


class WhisperTranscriber:
    """Singleton-style local CTranslate2 INT8 transcriber (zero external paid APIs)."""

    def __init__(
        self,
        model_size: Optional[str] = None,
        compute_type: Optional[str] = None,
        cpu_threads: Optional[int] = None,
        model_path: Optional[str] = None,
        injected_model: Any = None,
    ) -> None:
        local_base_dir = os.path.join(os.path.dirname(__file__), "models", "base")
        default_model_path = local_base_dir if os.path.isdir(local_base_dir) else None
        self.model_size = model_size or os.environ.get("WHISPER_MODEL_SIZE", "base")
        self.compute_type = compute_type or os.environ.get("WHISPER_COMPUTE_TYPE", "int8")
        self.cpu_threads = cpu_threads or int(os.environ.get("WHISPER_CPU_THREADS", str(min(4, max(1, os.cpu_count() or 2)))))
        self.beam_size = int(os.environ.get("VOICE_BEAM_SIZE", "1"))
        self.model_path = model_path or os.environ.get("WHISPER_MODEL_PATH") or default_model_path
        self.download_root = os.environ.get("WHISPER_DOWNLOAD_ROOT") or None
        self.allow_download = os.environ.get("WHISPER_ALLOW_DOWNLOAD", "false").lower() == "true"
        self.model: Any = injected_model
        self.load_error: Optional[str] = None
        self.load_time_ms: Optional[int] = None

    def load_model(self) -> bool:
        """Load the local Whisper INT8 model once; remain non-fatal if offline weights are absent."""
        if self.model is not None:
            return True
        started = time.perf_counter()
        target = self.model_path or self.model_size
        try:
            self.model = WhisperModel(
                target,
                device="cpu",
                compute_type=self.compute_type,
                cpu_threads=self.cpu_threads,
                num_workers=1,
                download_root=self.download_root,
                local_files_only=not self.allow_download,
            )
            self.load_error = None
            self.load_time_ms = int((time.perf_counter() - started) * 1000)
            logger.info("Loaded Whisper model=%s compute=%s threads=%s in %sms", target, self.compute_type, self.cpu_threads, self.load_time_ms)
            return True
        except Exception as exc:
            self.model = None
            msg = str(exc)
            if "LocalEntryNotFoundError" in type(exc).__name__ or "cannot find the requested files" in msg.lower():
                self.load_error = "local_model_weights_missing"
            else:
                self.load_error = f"model_load_failed:{type(exc).__name__}"
            logger.warning("Whisper model not loaded (%s)", self.load_error)
            return False

    def transcribe_bytes(
        self,
        audio_bytes: bytes,
        claimed_mime: Optional[str] = None,
        correlation_id: Optional[str] = None,
    ) -> TranscriptionResult:
        """Decode and transcribe audio bytes completely in memory with guaranteed cleanup."""
        started = time.perf_counter()
        decoded: Optional[DecodedAudio] = None
        try:
            decoded = decode_audio_to_pcm16k(audio_bytes, claimed_mime=claimed_mime)
        except AudioValidationError as exc:
            elapsed = int((time.perf_counter() - started) * 1000)
            logger.info("Audio rejected correlation=%s code=%s bytes=%s", correlation_id or "-", exc.code, len(audio_bytes))
            return TranscriptionResult(
                ok=False,
                quality_category=exc.category,
                detected_language="unknown",
                language_probability=0.0,
                transcript="",
                duration_seconds=0.0,
                processing_ms=elapsed,
                error_code=exc.code,
            )

        if decoded.is_silent:
            elapsed = int((time.perf_counter() - started) * 1000)
            logger.info("Silent audio correlation=%s duration=%.2fs", correlation_id or "-", decoded.duration_seconds)
            return TranscriptionResult(
                ok=True,
                quality_category="no_speech",
                detected_language="unknown",
                language_probability=0.0,
                transcript="",
                duration_seconds=decoded.duration_seconds,
                speech_ratio=decoded.speech_ratio,
                processing_ms=elapsed,
                error_code="no_speech_detected",
                metadata={"format": decoded.detected_format, "rms": decoded.overall_rms},
            )

        if self.model is None and not self.load_model():
            elapsed = int((time.perf_counter() - started) * 1000)
            return TranscriptionResult(
                ok=False,
                quality_category="processing_error",
                detected_language="unknown",
                language_probability=0.0,
                transcript="",
                duration_seconds=decoded.duration_seconds,
                speech_ratio=decoded.speech_ratio,
                processing_ms=elapsed,
                error_code=self.load_error or "speech_engine_unavailable",
                metadata={"format": decoded.detected_format},
            )

        try:
            segments_iter, info = self.model.transcribe(
                decoded.samples,
                language=None,
                task="transcribe",
                beam_size=self.beam_size,
                vad_filter=True,
                condition_on_previous_text=False,
            )
            segments = list(segments_iter)
            transcript = " ".join(seg.text.strip() for seg in segments if getattr(seg, "text", "").strip()).strip()
            detected_lang = (getattr(info, "language", None) or "unknown").lower()
            lang_prob = float(getattr(info, "language_probability", 0.0) or 0.0)

            avg_logprob: Optional[float] = None
            no_speech_prob: Optional[float] = None
            if segments:
                logprobs = [float(seg.avg_logprob) for seg in segments if getattr(seg, "avg_logprob", None) is not None]
                nospeech = [float(seg.no_speech_prob) for seg in segments if getattr(seg, "no_speech_prob", None) is not None]
                if logprobs:
                    avg_logprob = sum(logprobs) / len(logprobs)
                if nospeech:
                    no_speech_prob = sum(nospeech) / len(nospeech)

            quality = classify_quality(
                transcript=transcript,
                detected_language=detected_lang,
                language_probability=lang_prob,
                avg_logprob=avg_logprob,
                no_speech_prob=no_speech_prob,
                speech_ratio=decoded.speech_ratio,
            )
            elapsed = int((time.perf_counter() - started) * 1000)
            logger.info(
                "Transcribed correlation=%s format=%s duration=%.2fs lang=%s quality=%s elapsed=%dms",
                correlation_id or "-",
                decoded.detected_format,
                decoded.duration_seconds,
                detected_lang,
                quality,
                elapsed,
            )
            return TranscriptionResult(
                ok=True,
                quality_category=quality,
                detected_language=detected_lang,
                language_probability=lang_prob,
                transcript=transcript,
                duration_seconds=decoded.duration_seconds,
                avg_logprob=avg_logprob,
                no_speech_prob=no_speech_prob,
                speech_ratio=decoded.speech_ratio,
                processing_ms=elapsed,
                error_code="no_speech_detected" if quality == "no_speech" else None,
                metadata={"format": decoded.detected_format, "segmentCount": len(segments)},
            )
        except Exception as exc:
            elapsed = int((time.perf_counter() - started) * 1000)
            logger.error("Transcription exception correlation=%s err=%s", correlation_id or "-", type(exc).__name__)
            return TranscriptionResult(
                ok=False,
                quality_category="processing_error",
                detected_language="unknown",
                language_probability=0.0,
                transcript="",
                duration_seconds=decoded.duration_seconds,
                speech_ratio=decoded.speech_ratio,
                processing_ms=elapsed,
                error_code=f"transcription_failed:{type(exc).__name__}",
                metadata={"format": decoded.detected_format},
            )
        finally:
            if decoded is not None:
                decoded.samples = decoded.samples[:0]
