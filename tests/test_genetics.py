"""Tests for the genome encoding helpers."""

from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from tamaos_kernel.genetics import Genome, from_base60, to_base60


def test_base60_round_trip_deterministic() -> None:
    genomes = [Genome.from_seed(seed, length=16) for seed in range(5)]
    encoded = [to_base60(g) for g in genomes]

    decoded = from_base60(encoded[0])
    assert decoded.bytes_ == genomes[0].bytes_
    assert to_base60(decoded) == encoded[0]

    lengths = {len(text) for text in encoded}
    assert len(lengths) == 1, "all encodings should have the same width for fixed genome size"

    assert len(set(encoded)) == len(encoded), "different seeds should yield unique encodings"
