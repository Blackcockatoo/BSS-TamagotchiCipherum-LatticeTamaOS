"""Persistence helpers for TamaOS."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Iterable


class VirtualFileSystem:
    """Tiny helper around a directory-backed VFS.

    The VFS acts as a persistence layer for the agent's state and streams of
    events.  It stores JSON blobs and line oriented logs underneath the
    configured root directory.  The intention is not to perfectly emulate a
    Unix filesystem but to provide a convenient, sandboxed location for
    TamaOS-specific data.
    """

    def __init__(self, root: str) -> None:
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)
        self._state_path = self.root / "state.json"
        self._stream_path = self.root / "stream.log"

    # ------------------------------------------------------------------
    # State persistence
    # ------------------------------------------------------------------
    def load_state(self) -> Dict[str, Any]:
        """Return the last persisted state dictionary.

        Missing files are treated as an empty state.  Callers are expected to
        provide sensible defaults when the dictionary is empty.
        """

        if not self._state_path.exists():
            return {}
        try:
            with self._state_path.open("r", encoding="utf-8") as fp:
                return json.load(fp)
        except json.JSONDecodeError:
            # Corrupt state files should not prevent the OS from booting.
            return {}

    def save_state(self, state: Dict[str, Any]) -> None:
        """Persist the given state dictionary."""

        tmp_path = self._state_path.with_suffix(".tmp")
        with tmp_path.open("w", encoding="utf-8") as fp:
            json.dump(state, fp, indent=2, sort_keys=True)
        tmp_path.replace(self._state_path)

    # ------------------------------------------------------------------
    # Event streaming
    # ------------------------------------------------------------------
    def append_stream(self, entry: Dict[str, Any]) -> None:
        """Append a structured entry to the knowledge/event stream."""

        record = json.dumps(entry, ensure_ascii=False)
        with self._stream_path.open("a", encoding="utf-8") as fp:
            fp.write(record + "\n")

    def tail_stream(self, limit: int = 25) -> Iterable[Dict[str, Any]]:
        """Yield up to ``limit`` most recent stream entries."""

        if not self._stream_path.exists():
            return []
        with self._stream_path.open("r", encoding="utf-8") as fp:
            lines = fp.readlines()[-limit:]
        return (json.loads(line) for line in lines if line.strip())


__all__ = ["VirtualFileSystem"]
