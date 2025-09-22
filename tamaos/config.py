"""Configuration loader for TamaOS."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from dotenv import load_dotenv

# Root of the repository (the directory containing this file is tamaos/)
ROOT_DIR = Path(__file__).resolve().parents[1]
ENV_FILE = ROOT_DIR / ".env"

# Load .env variables if present. Values injected via the environment take precedence.
load_dotenv(dotenv_path=ENV_FILE, override=False)


def _get_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        return default
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _get_path(name: str, default: Path) -> Path:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        return default
    expanded = Path(value).expanduser()
    try:
        return expanded.resolve()
    except FileNotFoundError:
        return expanded


def _get_str(name: str, default: str) -> str:
    value = os.getenv(name)
    return value if value not in (None, "") else default


def _get_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    normalized = value.strip().lower()
    if normalized == "":
        return default
    return normalized in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    """Resolved configuration values for TamaOS."""

    root_dir: Path
    env_file: Path
    century_real_seconds: int
    vfs_path: Path
    log_path: Path
    tamaos_name: str
    log_level: str
    ui_skin: str
    animate_ui: bool

    def ensure_runtime_paths(self) -> None:
        """Create runtime directories if they do not exist."""

        for path in self.runtime_paths:
            path.mkdir(parents=True, exist_ok=True)

    @property
    def runtime_paths(self) -> Iterable[Path]:
        return (self.vfs_path, self.log_path)

    def summary(self) -> str:
        return (
            f"Settings:\n"
            f"  root_dir: {self.root_dir}\n"
            f"  env_file: {self.env_file}\n"
            f"  century_real_seconds: {self.century_real_seconds}\n"
            f"  vfs_path: {self.vfs_path}\n"
            f"  log_path: {self.log_path}\n"
            f"  tamaos_name: {self.tamaos_name}\n"
            f"  log_level: {self.log_level}\n"
            f"  ui_skin: {self.ui_skin}\n"
            f"  animate_ui: {self.animate_ui}"
        )


_century_default = 100 * 365 * 24 * 60 * 60
_default_vfs = (ROOT_DIR / "vfs").resolve()
_default_logs = (ROOT_DIR / "logs").resolve()

settings = Settings(
    root_dir=ROOT_DIR,
    env_file=ENV_FILE,
    century_real_seconds=_get_int("CENTURY_REAL_SEC", _century_default),
    vfs_path=_get_path("VFS_PATH", _default_vfs),
    log_path=_get_path("LOG_PATH", _default_logs),
    tamaos_name=_get_str("TAMAOS_NAME", "TamaOS"),
    log_level=_get_str("LOG_LEVEL", "INFO"),
    ui_skin=_get_str("TAMAOS_UI_SKIN", "classic").lower(),
    animate_ui=_get_bool("TAMAOS_ANIMATE_UI", True),
)
