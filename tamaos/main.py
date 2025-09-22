"""Minimal entry point for TamaOS."""
from __future__ import annotations

from textwrap import dedent

from .skins import SkinManager

from .config import settings


def _format_century(seconds: int) -> str:
    years = seconds / (365 * 24 * 60 * 60)
    return f"{seconds:,} seconds (~{years:.2f} years)"


skin_manager = SkinManager(
    default_skin=settings.ui_skin,
    animate=settings.animate_ui,
)


def _banner_content() -> str:
    return dedent(
        f"""
        ===============================
        {settings.tamaos_name} bootstrap
        ===============================
        Century duration : {_format_century(settings.century_real_seconds)}
        Virtual FS path  : {settings.vfs_path}
        Logs path        : {settings.log_path}
        Log level        : {settings.log_level}
        Active skin      : {skin_manager.current_name}
        -------------------------------
        Type 'status' for settings, 'skin help' for styling, 'exit' to quit.
        """
    ).strip()


def _print_banner() -> None:
    print(skin_manager.render_banner(_banner_content()))


def _handle_skin_command(parts: list[str]) -> None:
    if not parts or parts[0].lower() in {"help", "?"}:
        print("Usage: skin list | skin use <name> | skin show | skin animate <on|off>")
        return

    action = parts[0].lower()
    if action == "list":
        for skin in skin_manager.list_skins():
            marker = "*" if skin.name == skin_manager.current_name else "-"
            print(f"{marker} {skin.name:<10} : {skin.display_name} — {skin.description}")
        return

    if action in {"use", "set"}:
        if len(parts) < 2:
            print("Usage: skin use <name>")
            return
        target = parts[1]
        if skin_manager.set_skin(target):
            print(f"Skin set to '{skin_manager.current_name}'.")
            _print_banner()
        else:
            available = ", ".join(sorted(s.name for s in skin_manager.list_skins()))
            print(f"Unknown skin '{target}'. Available skins: {available}")
        return

    if action == "show":
        _print_banner()
        return

    if action == "animate":
        if len(parts) < 2:
            status = "on" if skin_manager.animation_enabled() else "off"
            print(f"Animation is currently {status}. Use 'skin animate on' or 'skin animate off'.")
            return
        toggle = parts[1].lower()
        if toggle not in {"on", "off"}:
            print("Usage: skin animate <on|off>")
            return
        skin_manager.set_animation(toggle == "on")
        print(f"Animation {'enabled' if toggle == 'on' else 'disabled'}.")
        return

    print("Usage: skin list | skin use <name> | skin show | skin animate <on|off>")


def repl() -> None:
    """A stub REPL for future TamaOS commands."""

    if skin_manager.animation_enabled():
        skin_manager.play_intro(_banner_content())
    else:
        _print_banner()
    while True:
        try:
            command = input("tamaos> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break

        if not command:
            continue
        parts = command.split()
        lowered = parts[0].lower()
        if lowered in {"exit", "quit"}:
            break
        if lowered == "status":
            print(settings.summary())
            continue
        if lowered == "skin":
            _handle_skin_command(parts[1:])
            continue
        print(f"Unknown command: {command}")

    print("Exiting TamaOS shell. Goodbye!")


def main() -> int:
    settings.ensure_runtime_paths()
    repl()
    return 0


if __name__ == "__main__":  # pragma: no cover - CLI entrypoint
    raise SystemExit(main())
