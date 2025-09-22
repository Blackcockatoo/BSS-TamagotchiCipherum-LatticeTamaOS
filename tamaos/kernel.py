"""Kernel, message bus and observation utilities."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Dict, Tuple

from .agent import Agent
from .devices import BaseDevice, DeviceError, DeviceResponse, NetDevice, TabletDevice
from .skin import SkinRenderer
from .vfs import VirtualFileSystem


@dataclass
class Observation:
    summary: Dict[str, object]
    skin: str


class Kernel:
    """Central orchestrator that wires devices, agent and persistence."""

    def __init__(self, agent: Agent, vfs: VirtualFileSystem, logger: logging.Logger) -> None:
        self.agent = agent
        self.vfs = vfs
        self.logger = logger
        self.renderer = SkinRenderer()
        self.devices: Dict[str, BaseDevice] = {}
        self._install_default_devices()

    def _install_default_devices(self) -> None:
        for device_cls in (TabletDevice, NetDevice):
            device = device_cls(self.agent)
            self.devices[device.name] = device

    # ------------------------------------------------------------------
    # Dispatch
    # ------------------------------------------------------------------
    def post(self, address: str, payload: Dict[str, object]) -> DeviceResponse:
        try:
            device_name, endpoint = self._parse_address(address)
        except ValueError as exc:
            raise DeviceError(str(exc)) from exc
        if device_name not in self.devices:
            raise DeviceError(f"unknown device: {device_name}")
        response = self.devices[device_name].handle(endpoint, payload)
        self.persist()
        self.logger.info("post %s -> %s", address, json.dumps(response.payload))
        self.vfs.append_stream(
            {
                "address": address,
                "payload": payload,
                "response": response.payload,
            }
        )
        return response

    def tick(self, hours: int = 1) -> Dict[str, object]:
        self.agent.advance_time(hours)
        self.persist()
        snapshot = self.agent.summary()
        self.logger.info("tick %s", hours)
        return snapshot

    def observe(self) -> Observation:
        summary = self.agent.summary()
        aura = self.agent.build_aura()
        skin = self.renderer.render(self.agent.lattice_snapshot(), aura=aura)
        self.logger.debug("observe -> %s", json.dumps(summary))
        return Observation(summary=summary, skin=skin)

    def persist(self) -> None:
        self.vfs.save_state(self.agent.to_dict())

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    @staticmethod
    def _parse_address(address: str) -> Tuple[str, str]:
        if "." not in address:
            raise ValueError("address must have the form <device>.<endpoint>")
        device, endpoint = address.split(".", 1)
        if not device or not endpoint:
            raise ValueError("invalid address")
        return device, endpoint


__all__ = ["Kernel", "Observation"]
