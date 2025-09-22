from __future__ import annotations

import math

import pytest

from tamaos_kernel.genetics import (
    MARK_BASELINE,
    MARK_MAX,
    MARK_MIN,
    Genome,
    mark_epigenetic,
    new_genome,
)


def test_new_genome_inherits_toward_parent() -> None:
    parent = Genome({"metabolism": 1.3, "resilience": 0.7})
    child = new_genome(parent=parent, heritability=0.5)

    for gene, parent_mark in parent.marks.items():
        child_mark = child.marks[gene]
        expected_mark = 1.0 + (parent_mark - 1.0) * 0.5
        assert math.isclose(child_mark, expected_mark, rel_tol=1e-9)
        assert abs(child_mark - parent_mark) < abs(MARK_BASELINE - parent_mark)


def test_new_genome_clamps_inherited_marks() -> None:
    parent = Genome({"metabolism": 2.0, "resilience": 0.1})
    child = new_genome(parent=parent, heritability=1.0)

    assert child.marks["metabolism"] == MARK_MAX
    assert child.marks["resilience"] == MARK_MIN


@pytest.mark.parametrize(
    "delta, expected",
    [(-0.75, MARK_MIN), (0.75, MARK_MAX)],
)
def test_mark_epigenetic_clamps_after_inheritance(delta: float, expected: float) -> None:
    baseline = new_genome()
    inherited = new_genome(parent=baseline, heritability=0.4)
    adjusted = mark_epigenetic(inherited, "metabolism", delta)

    assert adjusted.marks["metabolism"] == expected
