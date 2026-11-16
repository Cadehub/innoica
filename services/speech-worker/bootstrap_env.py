"""Local environment bootstrapper for Innoica Speech Worker.

Ensures repo .env/.env.local secrets are loaded when launched standalone, and
attaches locally cached wheel archives (Windows uv cache) only if packages are
not already importable in the active Python environment.
"""

from __future__ import annotations

import glob
import os
import sys
from pathlib import Path

REQUIRED_CACHE_MODS = (
    "faster_whisper",
    "ctranslate2",
    "av",
    "onnxruntime",
    "huggingface_hub",
    "numpy",
    "tokenizers",
    "yaml",
    "tqdm",
    "requests",
    "certifi",
    "urllib3",
    "charset_normalizer",
    "idna",
    "filelock",
    "fsspec",
    "packaging",
    "typing_extensions",
    "coloredlogs",
    "humanfriendly",
    "flatbuffers",
    "mpmath",
    "sympy",
    "protobuf",
    "hf_xet",
    "httpx",
    "httpcore",
    "h11",
    "anyio",
)


def load_local_env() -> None:
    """Load root .env.local or .env variables if not already present in os.environ."""
    repo_root = Path(__file__).resolve().parents[2]
    for env_name in (".env.local", ".env"):
        env_path = repo_root / env_name
        if not env_path.is_file():
            continue
        for raw_line in env_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = val


def attach_cached_wheels() -> None:
    """Attach uv archive-v0 package dirs only when faster_whisper or av is absent."""
    try:
        import av  # noqa: F401
        import faster_whisper  # noqa: F401
        return
    except ImportError:
        pass

    local_app_data = os.environ.get("LOCALAPPDATA")
    if not local_app_data:
        return
    archive_base = os.path.join(local_app_data, "uv", "cache", "archive-v0")
    if not os.path.isdir(archive_base):
        return

    extra_paths = [
        p
        for p in glob.glob(os.path.join(archive_base, "*"))
        if any(
            os.path.exists(os.path.join(p, mod)) or os.path.exists(os.path.join(p, f"{mod}.py"))
            for mod in REQUIRED_CACHE_MODS
        )
    ]
    for p in extra_paths:
        if p not in sys.path:
            sys.path.append(p)


def bootstrap() -> None:
    load_local_env()
    attach_cached_wheels()
