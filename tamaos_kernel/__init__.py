"""Core kernel primitives for TamaOS."""
from .genetics import (
    BASE60_ALPHABET,
    Genome,
    from_base60,
    from_base64,
    from_dict,
    to_base60,
    to_base64,
    to_dict,
)

__all__ = [
    "BASE60_ALPHABET",
    "Genome",
    "from_base60",
    "from_base64",
    "from_dict",
    "to_base60",
    "to_base64",
    "to_dict",
]
