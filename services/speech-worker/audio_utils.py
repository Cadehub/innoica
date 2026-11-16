"""Audio validation and in-memory decoding utilities using PyAV.

Decodes incoming WhatsApp audio (OGG/Opus, MP4/M4A, MP3, WAV, FLAC, WebM)
directly from memory into 16 kHz mono float32 PCM without shelling out to ffmpeg.
"""

from __future__ import annotations

import io
import math
import os
from dataclasses import dataclass
from typing import Optional

import av
import numpy as np

TARGET_SAMPLE_RATE = 16000
DEFAULT_MAX_AUDIO_BYTES = int(os.environ.get("VOICE_MAX_AUDIO_BYTES", str(10 * 1024 * 1024)))
DEFAULT_MAX_DURATION_SEC = float(os.environ.get("VOICE_MAX_DURATION_SEC", "300"))
MIN_DURATION_SEC = 0.25

# Magic-byte signatures -> normalized container family + allowed MIME prefixes
AUDIO_MAGIC_MAP = {
    "ogg": ("audio/ogg", "application/ogg"),
    "wav": ("audio/wav", "audio/x-wav", "audio/wave"),
    "mp3": ("audio/mpeg", "audio/mp3"),
    "mp4": ("audio/mp4", "audio/m4a", "audio/x-m4a", "audio/aac"),
    "flac": ("audio/flac", "audio/x-flac"),
    "webm": ("audio/webm", "video/webm"),
}


class AudioValidationError(ValueError):
    """Raised when incoming binary audio fails security, size, format, or duration checks."""

    def __init__(self, code: str, message: str, category: str = "unsupported") -> None:
        super().__init__(message)
        self.code = code
        self.category = category


@dataclass
class DecodedAudio:
    """In-memory normalized PCM representation ready for Whisper inference."""

    samples: np.ndarray
    sample_rate: int
    duration_seconds: float
    detected_format: str
    overall_rms: float
    speech_ratio: float
    is_silent: bool


def sniff_audio_container(data: bytes) -> Optional[str]:
    """Identify the real audio container from leading magic bytes."""
    if len(data) < 12:
        return None
    if data[:4] == b"OggS":
        return "ogg"
    if data[:4] == b"RIFF" and data[8:12] == b"WAVE":
        return "wav"
    if data[:4] == b"fLaC":
        return "flac"
    if data[:4] == b"\x1a\x45\xdf\xa3":
        return "webm"
    if data[4:8] == b"ftyp":
        return "mp4"
    if data[:3] == b"ID3" or (data[0] == 0xFF and (data[1] & 0xE0) == 0xE0):
        return "mp3"
    return None


def validate_claimed_mime(detected_container: str, claimed_mime: Optional[str]) -> None:
    """Reject spoofed/contradictory MIME headers when a claimed MIME is supplied."""
    if not claimed_mime:
        return
    base_mime = claimed_mime.split(";")[0].strip().lower()
    if not base_mime or base_mime == "application/octet-stream":
        return
    allowed = AUDIO_MAGIC_MAP.get(detected_container, ())
    if base_mime in allowed:
        return
    # WhatsApp occasionally labels m4a or mp3 generically under audio/* variants
    if base_mime.startswith("audio/") and detected_container == "mp4" and "m4a" in base_mime:
        return
    raise AudioValidationError(
        code="mime_mismatch",
        message=f"Claimed MIME {base_mime} does not match detected container {detected_container}.",
        category="unsupported",
    )


def compute_speech_activity(samples: np.ndarray, sample_rate: int = TARGET_SAMPLE_RATE) -> tuple[float, float]:
    """Compute overall RMS amplitude and fraction of 30ms frames exceeding speech threshold."""
    if samples.size == 0:
        return 0.0, 0.0
    overall_rms = float(np.sqrt(np.mean(np.square(samples, dtype=np.float64))))
    frame_len = max(1, int(sample_rate * 0.03))
    usable = (samples.size // frame_len) * frame_len
    if usable == 0:
        return overall_rms, 1.0 if overall_rms >= 0.006 else 0.0
    frames = samples[:usable].reshape(-1, frame_len)
    frame_rms = np.sqrt(np.mean(np.square(frames, dtype=np.float64), axis=1))
    active_ratio = float(np.mean(frame_rms >= 0.006))
    return overall_rms, active_ratio


def decode_audio_to_pcm16k(
    audio_bytes: bytes,
    claimed_mime: Optional[str] = None,
    max_bytes: int = DEFAULT_MAX_AUDIO_BYTES,
    max_duration_sec: float = DEFAULT_MAX_DURATION_SEC,
) -> DecodedAudio:
    """Validate and decode raw audio bytes into 16kHz mono float32 PCM completely in memory."""
    if not audio_bytes:
        raise AudioValidationError("empty_audio", "Empty audio buffer.", category="unsupported")
    if len(audio_bytes) > max_bytes:
        raise AudioValidationError(
            "audio_too_large",
            f"Audio exceeds maximum allowed size of {max_bytes} bytes.",
            category="unsupported",
        )

    container_type = sniff_audio_container(audio_bytes)
    if container_type is None:
        raise AudioValidationError(
            "unsupported_container",
            "Unrecognized or unsupported audio magic bytes.",
            category="unsupported",
        )
    validate_claimed_mime(container_type, claimed_mime)

    bio = io.BytesIO(audio_bytes)
    container: Optional[av.container.InputContainer] = None
    chunks: list[np.ndarray] = []

    try:
        container = av.open(bio, mode="r")
        audio_streams = [s for s in container.streams if s.type == "audio"]
        if not audio_streams:
            raise AudioValidationError("no_audio_stream", "Container has no audio stream.", category="unsupported")

        resampler = av.AudioResampler(format="flt", layout="mono", rate=TARGET_SAMPLE_RATE)
        total_samples = 0
        max_samples = int(max_duration_sec * TARGET_SAMPLE_RATE)

        for frame in container.decode(audio_streams[0]):
            resampled_frames = resampler.resample(frame)
            if resampled_frames is None:
                continue
            if not isinstance(resampled_frames, list):
                resampled_frames = [resampled_frames]
            for rframe in resampled_frames:
                arr = rframe.to_ndarray().reshape(-1).astype(np.float32, copy=False)
                if arr.size == 0:
                    continue
                total_samples += arr.size
                if total_samples > max_samples:
                    raise AudioValidationError(
                        "audio_too_long",
                        f"Audio duration exceeds {max_duration_sec} seconds.",
                        category="unsupported",
                    )
                chunks.append(arr)

        # Flush resampler tail
        flushed = resampler.resample(None)
        if flushed:
            flushed_list = flushed if isinstance(flushed, list) else [flushed]
            for rframe in flushed_list:
                arr = rframe.to_ndarray().reshape(-1).astype(np.float32, copy=False)
                if arr.size > 0:
                    chunks.append(arr)
    except AudioValidationError:
        raise
    except av.error.FFmpegError as exc:
        raise AudioValidationError("corrupt_audio", f"Audio decode failed: {type(exc).__name__}", category="unsupported") from exc
    except Exception as exc:
        raise AudioValidationError("decode_failure", f"Unexpected decode failure: {type(exc).__name__}", category="unsupported") from exc
    finally:
        if container is not None:
            try:
                container.close()
            except Exception:
                pass
        bio.close()

    if not chunks:
        return DecodedAudio(
            samples=np.zeros((0,), dtype=np.float32),
            sample_rate=TARGET_SAMPLE_RATE,
            duration_seconds=0.0,
            detected_format=container_type,
            overall_rms=0.0,
            speech_ratio=0.0,
            is_silent=True,
        )

    samples = np.concatenate(chunks) if len(chunks) > 1 else chunks[0]
    if not np.all(np.isfinite(samples)):
        samples = np.nan_to_num(samples, nan=0.0, posinf=1.0, neginf=-1.0)

    duration_seconds = round(float(samples.size) / TARGET_SAMPLE_RATE, 3)
    overall_rms, speech_ratio = compute_speech_activity(samples, TARGET_SAMPLE_RATE)
    is_silent = duration_seconds < MIN_DURATION_SEC or overall_rms < 0.003 or speech_ratio < 0.015

    return DecodedAudio(
        samples=samples,
        sample_rate=TARGET_SAMPLE_RATE,
        duration_seconds=duration_seconds,
        detected_format=container_type,
        overall_rms=round(overall_rms, 6),
        speech_ratio=round(speech_ratio, 4),
        is_silent=is_silent,
    )
