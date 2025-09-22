"""Lattice memory model for the TamaOS agent."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable, List

Channel = str


@dataclass
class LatticeSnapshot:
    """Human friendly view of the lattice state."""

    averages: Dict[Channel, float]
    dominant: Channel


class Lattice:
    """Simple geometric memory sheet with Mirror/Shard/Flux channels.

    The implementation intentionally favours clarity over physical accuracy. A
    lattice is represented as three square grids (one for each channel).  Each
    imprint spreads its influence from the centre, while every tick introduces a
    small decay.  The grid values stay in the ``[-10, 10]`` range.
    """

    CHANNELS: Iterable[Channel] = ("mirror", "shard", "flux")

    def __init__(self, size: int = 5) -> None:
        if size < 3 or size % 2 == 0:
            raise ValueError("lattice size must be an odd integer >= 3")
        self.size = size
        self._grids: Dict[Channel, List[List[float]]] = {
            channel: [[0.0 for _ in range(size)] for _ in range(size)]
            for channel in self.CHANNELS
        }

    # ------------------------------------------------------------------
    # Core operations
    # ------------------------------------------------------------------
    def imprint(self, channel: Channel, intensity: float, focus: float = 0.0) -> None:
        """Spread ``intensity`` across ``channel`` with a soft radial falloff."""

        if channel not in self._grids:
            raise KeyError(f"unknown lattice channel: {channel}")
        grid = self._grids[channel]
        centre = self.size // 2
        falloff = max(0.1, 0.65 - focus * 0.05)
        weight = max(0.05, min(abs(intensity), 5.0))
        polarity = 1 if intensity >= 0 else -1

        for y in range(self.size):
            for x in range(self.size):
                distance = abs(x - centre) + abs(y - centre)
                influence = max(0.0, weight - falloff * distance)
                if influence:
                    grid[y][x] = _clamp(grid[y][x] + polarity * influence * 0.6, -10.0, 10.0)

        # Whenever one channel strengthens, the others relax slightly.
        for other, other_grid in self._grids.items():
            if other == channel:
                continue
            for y in range(self.size):
                for x in range(self.size):
                    other_grid[y][x] *= 0.985

    def decay(self, factor: float = 0.01) -> None:
        for grid in self._grids.values():
            for y in range(self.size):
                for x in range(self.size):
                    grid[y][x] *= 1.0 - factor

    # ------------------------------------------------------------------
    # Inspection helpers
    # ------------------------------------------------------------------
    def snapshot(self) -> LatticeSnapshot:
        averages: Dict[Channel, float] = {}
        dominant_channel: Channel = "mirror"
        dominant_value = float("-inf")
        for channel, grid in self._grids.items():
            total = sum(sum(row) for row in grid)
            avg = total / (self.size * self.size)
            averages[channel] = avg
            if avg > dominant_value:
                dominant_channel = channel
                dominant_value = avg
        return LatticeSnapshot(averages=averages, dominant=dominant_channel)

    def as_dict(self) -> Dict[str, List[List[float]]]:
        return {channel: [row[:] for row in grid] for channel, grid in self._grids.items()}

    @classmethod
    def from_dict(cls, payload: Dict[str, List[List[float]]]) -> "Lattice":
        size_candidates = {len(rows) for rows in payload.values()}
        if not size_candidates:
            raise ValueError("payload does not contain any channel data")
        (size,) = size_candidates
        inst = cls(size=size)
        for channel in cls.CHANNELS:
            if channel in payload:
                grid = payload[channel]
                if any(len(row) != size for row in grid):
                    raise ValueError("grid dimensions mismatch")
                inst._grids[channel] = [row[:] for row in grid]
        return inst


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(value, hi))


__all__ = ["Channel", "Lattice", "LatticeSnapshot"]
