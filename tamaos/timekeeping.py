"""Time keeping for the century life system."""

from __future__ import annotations

from dataclasses import dataclass

HOURS_PER_YEAR = 24 * 365


@dataclass
class CenturyClock:
    """Map virtual ticks to the 100 year life cycle."""

    century_real_seconds: float
    total_hours: int = 0

    def __post_init__(self) -> None:
        if self.century_real_seconds <= 0:
            raise ValueError("century_real_seconds must be positive")
        self.seconds_per_hour = self.century_real_seconds / (100 * HOURS_PER_YEAR)
        self.elapsed_real_seconds = self.total_hours * self.seconds_per_hour

    def advance_hours(self, hours: int) -> None:
        if hours < 0:
            raise ValueError("hours must be non-negative")
        self.total_hours += hours
        self.elapsed_real_seconds += hours * self.seconds_per_hour

    # ------------------------------------------------------------------
    # Derived metrics
    # ------------------------------------------------------------------
    @property
    def age_years(self) -> float:
        return min(100.0, (self.elapsed_real_seconds / self.century_real_seconds) * 100.0)

    @property
    def age_hours(self) -> int:
        return self.total_hours

    @property
    def century_progress(self) -> float:
        return self.age_years / 100.0

    @property
    def stage(self) -> str:
        years = self.age_years
        if years < 5:
            return "Seed"
        if years < 20:
            return "Sprout"
        if years < 60:
            return "Bloom"
        if years < 90:
            return "Elder"
        return "Legacy"


__all__ = ["CenturyClock", "HOURS_PER_YEAR"]
