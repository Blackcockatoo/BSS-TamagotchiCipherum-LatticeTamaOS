"""Core genetics primitives for TamaOS creatures."""
from .genetics import (
    DEFAULT_GENES,
    Genome,
    MARK_BASELINE,
    MARK_MAX,
    MARK_MIN,
    mark_epigenetic,
    new_genome,
)

__all__ = [
    "DEFAULT_GENES",
    "Genome",
    "MARK_BASELINE",
    "MARK_MAX",
    "MARK_MIN",
    "mark_epigenetic",
    "new_genome",
]
