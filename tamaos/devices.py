"""Device implementations for TamaOS."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Dict, Optional

from .agent import Agent


class DeviceError(RuntimeError):
    """Raised when a device cannot process a command."""


@dataclass
class DeviceResponse:
    payload: Dict[str, Any]


class BaseDevice:
    name: str

    def __init__(self, agent: Agent) -> None:
        self.agent = agent

    def handle(self, endpoint: str, payload: Dict[str, Any]) -> DeviceResponse:
        raise NotImplementedError


class TabletDevice(BaseDevice):
    name = "tablet"

    def handle(self, endpoint: str, payload: Dict[str, Any]) -> DeviceResponse:
        if endpoint == "feed":
            number = str(payload.get("number", "")).strip()
            if not number:
                raise DeviceError("tablet.feed requires a number")
            descriptor, channel, amount = _analyse_feed_number(number)
            response = self.agent.feed(channel=channel, amount=amount, descriptor=descriptor)
            response.update({"number": number})
            return DeviceResponse(payload=response)
        if endpoint == "teach":
            token = str(payload.get("token", "")).strip()
            if not token:
                raise DeviceError("tablet.teach requires a token")
            channel = _channel_from_token(token)
            response = self.agent.teach(token=token, channel=channel)
            return DeviceResponse(payload=response)
        raise DeviceError(f"unknown tablet endpoint: {endpoint}")


class NetDevice(BaseDevice):
    name = "net"

    def handle(self, endpoint: str, payload: Dict[str, Any]) -> DeviceResponse:
        if endpoint != "add":
            raise DeviceError(f"unknown net endpoint: {endpoint}")
        text = str(payload.get("text", "")).strip()
        if not text:
            raise DeviceError("net.add requires text")
        tags_raw = payload.get("tags")
        tags = list(tags_raw) if isinstance(tags_raw, (list, tuple)) else None
        response = self.agent.add_concept(text=text, tags=tags)
        response.update({"text": text, "tags": tags})
        return DeviceResponse(payload=response)


def _analyse_feed_number(number: str) -> tuple[str, str, float]:
    cleaned = number.replace("_", "")
    try:
        numeric = int(cleaned)
    except ValueError as exc:
        raise DeviceError("feed number must be an integer") from exc

    descriptor = "palindrome" if cleaned == cleaned[::-1] else "sequence"
    if descriptor == "palindrome":
        channel = "mirror"
    elif numeric == 0:
        channel = "flux"
    elif numeric % 2 == 0:
        channel = "mirror"
    elif numeric % 5 == 0 or numeric % 3 == 0:
        channel = "flux"
    else:
        channel = "shard"

    amount = max(0.2, min(3.0, len(cleaned) / 2.5))
    if descriptor == "palindrome":
        amount *= 1.2
    return descriptor, channel, amount


def _channel_from_token(token: str) -> str:
    token_lower = token.lower()
    if token_lower == token_lower[::-1]:
        return "mirror"
    if any(ch in token_lower for ch in {"x", "z", "k"}):
        return "shard"
    if any(ch in token_lower for ch in {"s", "w", "~"}):
        return "flux"
    # fallback on vowel/consonant balance
    vowels = sum(1 for ch in token_lower if ch in "aeiou")
    consonants = sum(1 for ch in token_lower if ch.isalpha()) - vowels
    if vowels >= consonants:
        return "mirror"
    return "shard"


__all__ = [
    "BaseDevice",
    "DeviceError",
    "DeviceResponse",
    "NetDevice",
    "TabletDevice",
]
