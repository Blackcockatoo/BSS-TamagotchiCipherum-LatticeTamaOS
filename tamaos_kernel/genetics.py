"""Utilities for creating and tweaking TamaOS creature genomes."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable, Mapping

DEFAULT_GENES: tuple[str, ...] = (
    "metabolism",
    "resilience",
    "sociability",
    "curiosity",
)
"""Genes included in a default TamaOS genome."""

MARK_BASELINE = 1.0
"""Neutral epigenetic mark applied when no mutations are present."""

MARK_MIN = 0.5
"""Lower clamp applied to keep marks within a manageable range."""

MARK_MAX = 1.5
"""Upper clamp applied to keep marks within a manageable range."""


def _clamp_mark(value: float) -> float:
    return max(MARK_MIN, min(MARK_MAX, value))


@dataclass(frozen=True, slots=True)
class Genome:
    """Container for a TamaOS genome.

    The class simply wraps a mapping of gene names to epigenetic marks.  Marks
    are stored as floats to keep math around blending and inheritance simple.
    """

    marks: Mapping[str, float] = field(default_factory=dict)

    def __post_init__(self) -> None:
        object.__setattr__(self, "marks", dict(self.marks))

    def get(self, gene: str, default: float | None = None) -> float:
        return self.marks.get(gene, MARK_BASELINE if default is None else default)

    def as_dict(self) -> dict[str, float]:
        return dict(self.marks)


def _inherit_marks(parent_marks: Mapping[str, float], heritability: float) -> dict[str, float]:
    """Blend parent marks toward the neutral baseline.

    Parameters
    ----------
    parent_marks:
        Mapping of genes to the parent's epigenetic marks.
    heritability:
        The factor that determines how strongly a parent's mark influences the
        child.  ``0`` keeps the child at the neutral baseline of ``1.0`` while
        ``1`` fully mirrors the parent before clamping.
    """

    return {
        gene: MARK_BASELINE + (mark - MARK_BASELINE) * heritability
        for gene, mark in parent_marks.items()
    }


def new_genome(
    genes: Iterable[str] | None = None,
    *,
    parent: Genome | None = None,
    heritability: float = 0.2,
) -> Genome:
    """Create a new :class:`Genome` instance.

    When ``parent`` is provided the child's marks inherit toward the parent's
    values using ``heritability`` as a blending factor.  A value of ``0.2`` keeps
    the child mostly neutral, while higher values lean more heavily toward the
    parent's marks.  The resulting marks are always clamped to the
    ``[MARK_MIN, MARK_MAX]`` range.
    """

    if parent is not None and genes is None:
        gene_list = list(parent.marks.keys())
    else:
        gene_list = list(DEFAULT_GENES if genes is None else genes)

    if parent is None:
        marks = {gene: MARK_BASELINE for gene in gene_list}
        return Genome(marks)

    parent_marks = {gene: parent.marks.get(gene, MARK_BASELINE) for gene in gene_list}
    inherited = _inherit_marks(parent_marks, heritability)
    marks = {gene: _clamp_mark(inherited.get(gene, MARK_BASELINE)) for gene in gene_list}
    return Genome(marks)


def mark_epigenetic(genome: Genome, gene: str, delta: float) -> Genome:
    """Apply a delta to an epigenetic mark and return a new genome.

    The neutral mark is ``1.0``.  Since :func:`new_genome` now supports inheriting
    marks from a parent genome, adjustments made here build on top of those
    inherited values.  This keeps child genomes recognisably related while still
    allowing targeted mutations via positive or negative deltas.
    """

    marks = genome.as_dict()
    base = marks.get(gene, MARK_BASELINE)
    marks[gene] = _clamp_mark(base + delta)
    return Genome(marks)
