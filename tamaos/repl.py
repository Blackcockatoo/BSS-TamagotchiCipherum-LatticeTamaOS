"""Interactive shell for TamaOS."""

from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path
from typing import Optional

from config import CENTURY_REAL_SEC, LOG_PATH, VFS_PATH

from .agent import Agent
from .kernel import Kernel
from .lattice import Lattice
from .timekeeping import CenturyClock
from .vfs import VirtualFileSystem

PROMPT = "tamaos> "


def _setup_logger() -> logging.Logger:
    log_path = Path(LOG_PATH)
    log_path.mkdir(parents=True, exist_ok=True)
    logger = logging.getLogger("tamaos")
    if not logger.handlers:
        handler = logging.FileHandler(log_path / "tamaos.log", encoding="utf-8")
        formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")
        handler.setFormatter(formatter)
        logger.setLevel(logging.INFO)
        logger.addHandler(handler)
    return logger


def create_kernel() -> Kernel:
    vfs = VirtualFileSystem(VFS_PATH)
    logger = _setup_logger()
    state = vfs.load_state()
    if state:
        agent = Agent.from_dict(state)
    else:
        clock = CenturyClock(century_real_seconds=CENTURY_REAL_SEC)
        lattice = Lattice()
        agent = Agent(clock=clock, lattice=lattice)
    kernel = Kernel(agent=agent, vfs=vfs, logger=logger)
    kernel.persist()
    return kernel


def run_repl(*, once: Optional[str] = None) -> None:
    kernel = create_kernel()
    if once:
        _execute(kernel, once)
        return
    print("TamaOS shell — type 'help' for guidance.")
    while True:
        try:
            line = input(PROMPT)
        except EOFError:
            print()
            break
        if not line.strip():
            continue
        if line.strip().lower() in {"quit", "exit"}:
            break
        if line.strip().lower() == "help":
            _print_help()
            continue
        try:
            _execute(kernel, line)
        except Exception as exc:  # noqa: BLE001 - surface exceptions to user
            print(f"! {exc}")


def _execute(kernel: Kernel, line: str) -> None:
    parts = line.strip().split(maxsplit=2)
    if not parts:
        raise ValueError("empty command")
    command = parts[0].lower()
    if command == "tick":
        hours = int(parts[1]) if len(parts) > 1 else 1
        summary = kernel.tick(hours)
        print(json.dumps(summary, indent=2))
    elif command == "post":
        if len(parts) < 2:
            raise ValueError("post requires an address")
        address = parts[1]
        payload_text = parts[2] if len(parts) > 2 else "{}"
        payload = json.loads(payload_text) if payload_text else {}
        response = kernel.post(address, payload)
        print(json.dumps(response.payload, indent=2))
    elif command == "observe":
        observation = kernel.observe()
        print(json.dumps(observation.summary, indent=2))
        print(observation.skin)
    elif command == "stream":
        limit = int(parts[1]) if len(parts) > 1 else 10
        for entry in kernel.vfs.tail_stream(limit):
            print(json.dumps(entry, ensure_ascii=False))
    else:
        raise ValueError(f"unknown command: {command}")


def _print_help() -> None:
    print(
        """Commands:\n"
        "  post <device.endpoint> {json}  — dispatch to a device\n"
        "  tick [hours]                    — advance time\n"
        "  observe                         — show state and skin\n"
        "  stream [limit]                  — tail knowledge stream\n"
        "  exit | quit                     — leave the shell\n"
        """
    )


def main(argv: Optional[list[str]] = None) -> None:
    parser = argparse.ArgumentParser(description="Run the TamaOS interactive shell")
    parser.add_argument("--once", help="execute a single command and exit")
    args = parser.parse_args(argv)
    run_repl(once=args.once)


if __name__ == "__main__":
    main()
