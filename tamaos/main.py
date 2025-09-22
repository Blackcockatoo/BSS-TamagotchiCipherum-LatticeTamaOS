"""Minimal entry point for TamaOS."""
from __future__ import annotations

from textwrap import dedent

from .config import settings


def _format_century(seconds: int) -> str:
    years = seconds / (365 * 24 * 60 * 60)
    return f"{seconds:,} seconds (~{years:.2f} years)"


def _banner() -> str:
    return dedent(
        f"""
        ===============================
        {settings.tamaos_name} bootstrap
        ===============================
        Century duration : {_format_century(settings.century_real_seconds)}
        Virtual FS path  : {settings.vfs_path}
        Logs path        : {settings.log_path}
        Log level        : {settings.log_level}
        -------------------------------
        Type 'status' for settings, 'exit' to quit.
        """
    ).strip()


def repl() -> None:
    """A stub REPL for future TamaOS commands."""

    print(_banner())
    while True:
        try:
            command = input("tamaos> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break

        if not command:
            continue
        lowered = command.lower()
        if lowered in {"exit", "quit"}:
            break
        if lowered == "status":
            print(settings.summary())
            continue
        print(f"Unknown command: {command}")

    print("Exiting TamaOS shell. Goodbye!")


def main() -> int:
    settings.ensure_runtime_paths()
    repl()
    return 0


if __name__ == "__main__":  # pragma: no cover - CLI entrypoint
    raise SystemExit(main())
