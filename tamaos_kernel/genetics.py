"""Utilities for generating and serialising creature genomes."""
from __future__ import annotations

import base64
import random
import secrets
from dataclasses import dataclass
from typing import Any, Mapping

DEFAULT_GENOME_LENGTH = 32

# Serialization helpers -----------------------------------------------------

BASE60_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwx"
_BASE60_LOOKUP = {ch: idx for idx, ch in enumerate(BASE60_ALPHABET)}


@dataclass(frozen=True, slots=True)
class Genome:
    """Container for deterministic genome bytes."""

    bytes_: bytes
    seed: int | None = None

    def __post_init__(self) -> None:
        object.__setattr__(self, "bytes_", bytes(self.bytes_))
        if self.seed is not None and not isinstance(self.seed, int):  # pragma: no cover - defensive
            raise TypeError("seed must be an integer or None")

    @classmethod
    def from_seed(cls, seed: int, *, length: int = DEFAULT_GENOME_LENGTH) -> "Genome":
        rng = random.Random(seed)
        data = bytes(rng.randrange(0, 256) for _ in range(length))
        return cls(bytes_=data, seed=seed)

    @classmethod
    def random(cls, *, length: int = DEFAULT_GENOME_LENGTH) -> "Genome":  # pragma: no cover - helper
        return cls(bytes_=secrets.token_bytes(length))


# ----------------------------------------------------------------------------


def to_base64(g: Genome) -> str:
    """Encode genome bytes into base64 for transport."""

    return base64.b64encode(g.bytes_).decode("ascii")


def from_base64(text: str, *, seed: int | None = None) -> Genome:
    """Reconstruct a genome from a base64 payload."""

    return Genome(bytes_=base64.b64decode(text.encode("ascii")), seed=seed)


def to_dict(g: Genome) -> dict[str, Any]:
    """Serialise the genome into a JSON-friendly dictionary."""

    payload: dict[str, Any] = {"bytes": to_base64(g)}
    if g.seed is not None:
        payload["seed"] = g.seed
    return payload


def _base60_length(byte_len: int) -> int:
    if byte_len == 0:
        return 1
    max_value = (1 << (byte_len * 8)) - 1
    digits = 1
    threshold = 60
    while max_value >= threshold:
        digits += 1
        threshold *= 60
    return digits


def to_base60(g: Genome) -> str:
    """Encode genome bytes into a base-60 string with deterministic padding."""

    width = _base60_length(len(g.bytes_))
    if not g.bytes_:
        return BASE60_ALPHABET[0] * width

    value = int.from_bytes(g.bytes_, byteorder="big")
    digits: list[str] = []
    while value:
        value, remainder = divmod(value, 60)
        digits.append(BASE60_ALPHABET[remainder])
    encoded = "".join(reversed(digits or [BASE60_ALPHABET[0]]))
    return encoded.rjust(width, BASE60_ALPHABET[0])


def _byte_length_for_base60_length(length: int) -> int:
    if length < 1:
        raise ValueError("base-60 text must contain at least one character")
    if length == 1:
        return 0
    byte_len = 1
    while True:
        candidate = _base60_length(byte_len)
        if candidate == length:
            return byte_len
        if candidate > length:
            raise ValueError("invalid base-60 length for genome encoding")
        byte_len += 1


def from_base60(text: str, *, seed: int | None = None) -> Genome:
    """Decode a base-60 genome string produced by :func:`to_base60`."""

    if not text:
        raise ValueError("base-60 text must not be empty")
    value = 0
    for char in text:
        try:
            digit = _BASE60_LOOKUP[char]
        except KeyError as exc:  # pragma: no cover - defensive
            raise ValueError(f"invalid base-60 digit: {char!r}") from exc
        value = value * 60 + digit
    byte_len = _byte_length_for_base60_length(len(text))
    if byte_len == 0:
        return Genome(bytes_=b"", seed=seed)
    return Genome(bytes_=value.to_bytes(byte_len, byteorder="big"), seed=seed)


def from_dict(data: Mapping[str, Any]) -> Genome:
    """Deserialise a genome from the dictionary produced by :func:`to_dict`."""

    seed_value = data.get("seed")
    if seed_value is not None and not isinstance(seed_value, int):  # pragma: no cover - defensive
        raise TypeError("seed must be an integer when provided")
    encoded = data["bytes"]
    if not isinstance(encoded, str):  # pragma: no cover - defensive
        raise TypeError("bytes entry must be a base64-encoded string")
    genome = from_base64(encoded, seed=seed_value)
    return genome


__all__ = [
    "BASE60_ALPHABET",
    "DEFAULT_GENOME_LENGTH",
    "Genome",
    "from_base60",
    "from_base64",
    "from_dict",
    "to_base60",
    "to_base64",
    "to_dict",
]
