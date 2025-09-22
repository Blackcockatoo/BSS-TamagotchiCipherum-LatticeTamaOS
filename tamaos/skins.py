"""UI skins and playful animations for the TamaOS shell."""
from __future__ import annotations

import sys
import time
from dataclasses import dataclass
from typing import Dict, Iterable, Sequence

DEFAULT_SKIN_NAME = "classic"


@dataclass(frozen=True)
class Skin:
    """Represents a banner skin with optional title art and animation frames."""

    name: str
    display_name: str
    description: str
    top_left: str
    top_right: str
    bottom_left: str
    bottom_right: str
    horizontal: str
    vertical: str
    padding: int = 2
    title_lines: Sequence[str] = ()
    animation_frames: Sequence[str] = ()

    def render(self, content: str) -> str:
        """Render the provided content inside the skin's decorative frame."""

        lines = content.splitlines() or [""]
        width = max(len(line) for line in lines)
        inner_width = width + self.padding * 2
        horizontal_line = self.horizontal * inner_width
        top = f"{self.top_left}{horizontal_line}{self.top_right}"
        bottom = f"{self.bottom_left}{horizontal_line}{self.bottom_right}"

        padded_lines = [
            f"{self.vertical}{' ' * self.padding}{line.ljust(width)}{' ' * self.padding}{self.vertical}"
            for line in lines
        ]

        banner_lines = []
        if self.title_lines:
            context = {
                "bar": horizontal_line,
                "name": self.display_name,
                "width": inner_width,
            }
            banner_lines.extend(line.format(**context) for line in self.title_lines)

        banner_lines.append(top)
        banner_lines.extend(padded_lines)
        banner_lines.append(bottom)
        return "\n".join(banner_lines)

    def animate(self, stream, repeat: int = 2, delay: float = 0.12) -> None:
        """Play the skin's animation frames on the provided stream."""

        if not self.animation_frames:
            return
        frames = list(self.animation_frames)
        width = max(len(frame) for frame in frames)
        for _ in range(repeat):
            for frame in frames:
                stream.write("\r" + frame.ljust(width))
                stream.flush()
                time.sleep(delay)
        stream.write("\r" + " " * width + "\r")
        stream.flush()


class SkinManager:
    """Utility for working with the available UI skins."""

    def __init__(self, default_skin: str = DEFAULT_SKIN_NAME, animate: bool = True, stream=None) -> None:
        self._skins: Dict[str, Skin] = {skin.name: skin for skin in _BUILTIN_SKINS}
        normalized = default_skin.lower()
        self._current_name = normalized if normalized in self._skins else DEFAULT_SKIN_NAME
        self._animate = animate
        self._stream = stream if stream is not None else sys.stdout

    @property
    def current_skin(self) -> Skin:
        return self._skins[self._current_name]

    @property
    def current_name(self) -> str:
        return self._current_name

    def list_skins(self) -> Iterable[Skin]:
        return self._skins.values()

    def set_skin(self, name: str) -> bool:
        key = name.lower()
        if key in self._skins:
            self._current_name = key
            return True
        return False

    def render_banner(self, content: str) -> str:
        return self.current_skin.render(content)

    def play_intro(self, content: str) -> None:
        if self._should_animate():
            self.current_skin.animate(self._stream)
        print(self.render_banner(content), file=self._stream)

    def animation_enabled(self) -> bool:
        return self._animate

    def set_animation(self, enabled: bool) -> None:
        self._animate = enabled

    def _should_animate(self) -> bool:
        if not self._animate:
            return False
        stream = self._stream
        is_tty = getattr(stream, "isatty", lambda: False)()
        return bool(is_tty)


_BUILTIN_SKINS = (
    Skin(
        name="classic",
        display_name="TamaOS Classic",
        description="Balanced lattice frame inspired by the original bootstrap banner.",
        top_left="╔",
        top_right="╗",
        bottom_left="╚",
        bottom_right="╝",
        horizontal="═",
        vertical="║",
        padding=2,
        title_lines=(
            "   ╔{bar}╗",
            "   ║{name:^{width}}║",
            "   ╚{bar}╝",
        ),
        animation_frames=("◇◇◇◇◇", "◆◇◆◇◆", "◇◆◇◆◇"),
    ),
    Skin(
        name="synthwave",
        display_name="Synthwave Bloom",
        description="Prismatic slashes and neon accents for an eccentric boot ritual.",
        top_left="╭",
        top_right="╮",
        bottom_left="╰",
        bottom_right="╯",
        horizontal="╼",
        vertical="┃",
        padding=3,
        title_lines=(
            "  ╭✶{bar}✶╮",
            "  │{name:^{width}}│",
            "  ╰✶{bar}✶╯",
        ),
        animation_frames=("⌁⌁✦⌁⌁", "✦⌁⌁✦⌁", "⌁✦⌁⌁✦"),
    ),
    Skin(
        name="aurora",
        display_name="Aurora Cascade",
        description="Curved edges with cascading sparkles for a cosmic greeting.",
        top_left="╭",
        top_right="╮",
        bottom_left="╰",
        bottom_right="╯",
        horizontal="─",
        vertical="│",
        padding=4,
        title_lines=(
            "    ✺{bar}✺",
            "    ✶ {name:^{width}} ✶",
            "    ✺{bar}✺",
        ),
        animation_frames=("· · · ✺", " · · ✺ ·", "  · ✺ · ·", "   ✺ · · ·"),
    ),
)


__all__ = ["Skin", "SkinManager", "DEFAULT_SKIN_NAME"]
