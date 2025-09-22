"""ASCII skin renderer for the agent."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict

from .lattice import LatticeSnapshot


@dataclass
class Aura:
    descriptor: str
    mood: str
    hunger: str
    energy: str


class SkinRenderer:
    """Render stylised ASCII skins based on the dominant lattice channel."""

    BASE_SKINS: Dict[str, str] = {
        "mirror": "\n".join(
            [
                "   ◈   ",
                "  / \\",
                " <   >",
                "  \\ /",
                "   ◈   ",
            ]
        ),
        "shard": "\n".join(
            [
                "  ><  ",
                " <<>> ",
                "><  ><",
                " <<>> ",
                "  ><  ",
            ]
        ),
        "flux": "\n".join(
            [
                "  ⟡⟡  ",
                " ⟡  ⟡ ",
                "⟡    ⟡",
                " ⟡  ⟡ ",
                "  ⟡⟡  ",
            ]
        ),
    }

    def render(self, snapshot: LatticeSnapshot, aura: Aura) -> str:
        base = self.BASE_SKINS.get(snapshot.dominant, self.BASE_SKINS["mirror"])
        overlay = (
            f"Aura: {aura.descriptor}\n"
            f"Mood: {aura.mood} | Hunger: {aura.hunger} | Energy: {aura.energy}"
        )
        return f"{base}\n{overlay}"


__all__ = ["Aura", "SkinRenderer"]
