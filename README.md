# TamaOS Bootstrap

TamaOS is a sandboxed Tamagotchi experiment from Blue $nake Studio. This repo contains a
minimal Python skeleton and a setup script that bootstraps both Codex containers and local
development machines.

## Quick start

```bash
# Run once after cloning
bash setup.sh

# Activate the virtual environment
source .venv/bin/activate

# Launch the TamaOS shell
python -m tamaos.main
```

The shell prints a banner showing where the virtual file system and logs live. Type
`status` inside the REPL to inspect the loaded configuration, or `exit` to quit.

## Environment variables

Configuration is provided via environment variables or a local `.env` file. Default
values keep the project self-contained when nothing is specified.

| Variable            | Description                                                    | Default         |
| ------------------- | -------------------------------------------------------------- | --------------- |
| `CENTURY_REAL_SEC`  | Real-world seconds that represent the creature's 100-year life | `3153600000`    |
| `VFS_PATH`          | Directory used as the virtual filesystem root                  | `./vfs`         |
| `LOG_PATH`          | Directory used for runtime logs                                | `./logs`        |
| `TAMAOS_NAME`       | Display name for the boot banner                               | `TamaOS`        |
| `LOG_LEVEL`         | Logging verbosity hint for future services                     | `INFO`          |

Create a `.env` file based on `.env.example` to override these locally without exporting
them in your shell.

## What `setup.sh` does

1. Loads environment overrides from `.env` (if present) without overriding existing shell vars.
2. Ensures Python 3 and `venv` are available, then creates `.venv/`.
3. Installs pinned dependencies from `requirements.txt`.
4. Creates runtime directories for the virtual filesystem and logs.
5. Runs a smoke test that imports `tamaos.config` and prints the resolved configuration.

After the script completes, the repository is ready for you to extend the agent kernel.
