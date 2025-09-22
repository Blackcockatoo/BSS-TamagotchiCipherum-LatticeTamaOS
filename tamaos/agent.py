"""Core agent model for TamaOS."""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from config import BURST_CAP_PER_HOUR, STASIS_FILL_RATE, STASIS_MAX_HOURS

from .lattice import Lattice, LatticeSnapshot
from .skin import Aura
from .timekeeping import CenturyClock, HOURS_PER_YEAR


@dataclass
class KnowledgeEntry:
    """Structured record of an interaction."""

    source: str
    payload: Dict[str, Any]


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(value, hi))


@dataclass
class Agent:
    """Stateful Tamagotchi-like agent."""

    clock: CenturyClock
    lattice: Lattice
    hunger: float = 35.0
    energy: float = 65.0
    mood: float = 50.0
    stasis: float = 0.0
    feed_window: Dict[int, float] = field(default_factory=dict)
    knowledge: List[KnowledgeEntry] = field(default_factory=list)

    # ------------------------------------------------------------------
    # Serialisation helpers
    # ------------------------------------------------------------------
    def to_dict(self) -> Dict[str, Any]:
        return {
            "clock": {
                "century_real_seconds": self.clock.century_real_seconds,
                "total_hours": self.clock.total_hours,
            },
            "lattice": self.lattice.as_dict(),
            "hunger": self.hunger,
            "energy": self.energy,
            "mood": self.mood,
            "stasis": self.stasis,
            "feed_window": self.feed_window,
            "knowledge": [
                {"source": entry.source, "payload": entry.payload} for entry in self.knowledge
            ],
        }

    @classmethod
    def from_dict(cls, payload: Dict[str, Any]) -> "Agent":
        clock_payload = payload.get("clock", {})
        clock = CenturyClock(
            century_real_seconds=clock_payload.get("century_real_seconds", 30 * 24 * 3600),
            total_hours=clock_payload.get("total_hours", 0),
        )
        lattice_payload = payload.get("lattice") or {}
        lattice = Lattice.from_dict(lattice_payload) if lattice_payload else Lattice()
        agent = cls(clock=clock, lattice=lattice)
        agent.hunger = float(payload.get("hunger", agent.hunger))
        agent.energy = float(payload.get("energy", agent.energy))
        agent.mood = float(payload.get("mood", agent.mood))
        agent.stasis = float(payload.get("stasis", agent.stasis))
        agent.feed_window = {int(k): float(v) for k, v in payload.get("feed_window", {}).items()}
        agent.knowledge = [
            KnowledgeEntry(source=item.get("source", "unknown"), payload=item.get("payload", {}))
            for item in payload.get("knowledge", [])
        ]
        return agent

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------
    def advance_time(self, hours: int = 1) -> None:
        if hours < 0:
            raise ValueError("hours must be non-negative")
        for _ in range(hours):
            self.clock.advance_hours(1)
            self._advance_hour()

    def _advance_hour(self) -> None:
        hour_index = self.clock.total_hours
        self.hunger = _clamp(self.hunger + 1.1, 0.0, 100.0)
        self.energy = _clamp(self.energy - 0.9, 0.0, 100.0)
        mood_shift = -0.4 + 0.2 * math.sin(hour_index / 12.0)
        self.mood = _clamp(self.mood + mood_shift, 0.0, 100.0)
        self.stasis = _clamp(self.stasis + STASIS_FILL_RATE, 0.0, STASIS_MAX_HOURS)
        self.lattice.decay(0.012)
        cutoff = hour_index - 24
        self.feed_window = {hour: amt for hour, amt in self.feed_window.items() if hour >= cutoff}

    # ------------------------------------------------------------------
    # Interactions
    # ------------------------------------------------------------------
    def feed(self, channel: str, amount: float, descriptor: str) -> Dict[str, Any]:
        hour = self.clock.total_hours
        window_amount = self.feed_window.get(hour, 0.0)
        available = max(0.0, BURST_CAP_PER_HOUR - window_amount)
        if available <= 0:
            raise ValueError("burst cap reached for the current hour")
        effective = min(amount, available)
        self.feed_window[hour] = window_amount + effective
        self.hunger = _clamp(self.hunger - effective * 6.0, 0.0, 100.0)
        self.energy = _clamp(self.energy + effective * 2.5, 0.0, 100.0)
        self.mood = _clamp(self.mood + effective * 1.2, 0.0, 100.0)
        focus = 0.1 if descriptor == "palindrome" else 0.0
        self.lattice.imprint(channel, effective * 1.5, focus=focus)
        self.knowledge.append(
            KnowledgeEntry(
                source="tablet.feed",
                payload={
                    "channel": channel,
                    "descriptor": descriptor,
                    "requested": amount,
                    "delivered": effective,
                },
            )
        )
        return {
            "message": f"Tablet nourishes through {descriptor} channel {channel}",
            "channel": channel,
            "descriptor": descriptor,
            "requested": amount,
            "delivered": effective,
        }

    def teach(self, token: str, channel: str) -> Dict[str, Any]:
        impact = 0.8 + 0.2 * min(len(token), 12)
        self.mood = _clamp(self.mood + impact, 0.0, 100.0)
        self.energy = _clamp(self.energy - 0.2 * impact, 0.0, 100.0)
        self.lattice.imprint(channel, impact * 0.6, focus=0.2)
        entry = KnowledgeEntry(
            source="tablet.teach",
            payload={"token": token, "channel": channel},
        )
        self.knowledge.append(entry)
        return {"message": f"Knowledge etched via {channel}", "token": token, "channel": channel}

    def add_concept(self, text: str, tags: Optional[List[str]]) -> Dict[str, Any]:
        tags = tags or []
        channel = _tags_to_channel(tags)
        richness = min(5.0, 1.0 + len(text.split()) / 4.0)
        self.mood = _clamp(self.mood + richness * 0.6, 0.0, 100.0)
        self.energy = _clamp(self.energy - 0.3 * richness, 0.0, 100.0)
        self.hunger = _clamp(self.hunger + 0.2 * richness, 0.0, 100.0)
        self.lattice.imprint(channel, richness, focus=0.3)
        entry = KnowledgeEntry(
            source="net.add",
            payload={"text": text, "tags": tags, "channel": channel},
        )
        self.knowledge.append(entry)
        return {
            "message": "Concept integrated",
            "channel": channel,
            "richness": richness,
            "knowledge_size": len(self.knowledge),
        }

    # ------------------------------------------------------------------
    # Views
    # ------------------------------------------------------------------
    def lattice_snapshot(self) -> LatticeSnapshot:
        return self.lattice.snapshot()

    def build_aura(self) -> Aura:
        snapshot = self.lattice_snapshot()
        descriptor = {
            "mirror": "Mirror ◈",
            "shard": "Shard ><",
            "flux": "Flux ⟡",
        }.get(snapshot.dominant, "Unknown")
        return Aura(
            descriptor=f"{descriptor} — {self.clock.stage}",
            mood=_scale_descriptor(self.mood, ("Dormant", "Calm", "Lively", "Wild")),
            hunger=_scale_descriptor(100.0 - self.hunger, ("Starving", "Peckish", "Content", "Sated")),
            energy=_scale_descriptor(self.energy, ("Fading", "Steady", "Charged", "Radiant")),
        )

    def summary(self) -> Dict[str, Any]:
        snapshot = self.lattice_snapshot()
        return {
            "age_years": round(self.clock.age_years, 2),
            "age_hours": self.clock.age_hours,
            "stage": self.clock.stage,
            "century_progress": round(self.clock.century_progress, 4),
            "hunger": round(self.hunger, 2),
            "energy": round(self.energy, 2),
            "mood": round(self.mood, 2),
            "stasis": round(self.stasis, 2),
            "knowledge_entries": len(self.knowledge),
            "lattice": snapshot.averages,
            "dominant_channel": snapshot.dominant,
        }


def _tags_to_channel(tags: List[str]) -> str:
    lowered = {tag.lower() for tag in tags}
    if {"mirror", "symmetry", "palindrome"} & lowered:
        return "mirror"
    if {"shard", "entropy", "wild"} & lowered:
        return "shard"
    if {"flux", "flow", "dream"} & lowered:
        return "flux"
    if len(lowered) % 3 == 0:
        return "mirror"
    if len(lowered) % 3 == 1:
        return "shard"
    return "flux"


def _scale_descriptor(value: float, steps: tuple[str, str, str, str]) -> str:
    bucket = min(3, max(0, int((value / 101.0) * 4)))
    return steps[bucket]


__all__ = ["Agent", "KnowledgeEntry"]
