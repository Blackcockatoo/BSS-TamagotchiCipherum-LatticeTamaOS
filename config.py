import os
from dotenv import load_dotenv

# Load .env if present (Codex also exposes env via container)
load_dotenv()

def _f(key, default, cast=float):
    v = os.getenv(key, None)
    if v is None or v == "":
        return default
    try:
        return cast(v)
    except Exception:
        return default

CENTURY_REAL_SEC   = _f("CENTURY_REAL_SEC",   30*24*3600, float)
BURST_CAP_PER_HOUR = _f("BURST_CAP_PER_HOUR", 1.0, float)
STASIS_FILL_RATE   = _f("STASIS_FILL_RATE",   0.15, float)
STASIS_MAX_HOURS   = _f("STASIS_MAX_HOURS",   72, int)

VFS_PATH = os.getenv("VFS_PATH", "./vfs")
LOG_PATH = os.getenv("LOG_PATH", "./logs")
SKIN_MODE = os.getenv("SKIN_MODE", "BSS")
