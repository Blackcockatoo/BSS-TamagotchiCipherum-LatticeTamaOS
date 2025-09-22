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
| `TAMAOS_UI_SKIN`    | Default UI skin rendered around the shell banner                | `classic`       |
| `TAMAOS_ANIMATE_UI` | Whether to play banner animations on startup (`true`/`false`)   | `true`          |

Create a `.env` file based on `.env.example` to override these locally without exporting
them in your shell.

## What `setup.sh` does

1. Loads environment overrides from `.env` (if present) without overriding existing shell vars.
2. Ensures Python 3 and `venv` are available, then creates `.venv/`.
3. Installs pinned dependencies from `requirements.txt`.
4. Creates runtime directories for the virtual filesystem and logs.
5. Runs a smoke test that imports `tamaos.config` and prints the resolved configuration.

After the script completes, the repository is ready for you to extend the agent kernel.

## Styling the shell

The stub REPL now supports playful banner skins and boot animations. Use the `skin`
command inside the shell to explore the options:

```text
skin list           # Show all available skins and their descriptions
skin use synthwave  # Switch to the "synthwave" skin and redraw the banner
skin show           # Re-render the banner with the currently selected skin
skin animate off    # Disable or re-enable the introductory animation
```

Set the default skin and animation behaviour with the `TAMAOS_UI_SKIN` and
`TAMAOS_ANIMATE_UI` environment variables (see the table above) if you want the
shell to boot directly into a specific vibe.
