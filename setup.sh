#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$ROOT_DIR/.venv"
PYTHON_BIN="${PYTHON_BIN:-python3}"

bold="\033[1m"
normal="\033[0m"
log() {
  printf "%b[setup]%b %s\n" "$bold" "$normal" "$1"
}

log "Project root: $ROOT_DIR"

if [ -f "$ROOT_DIR/.env" ]; then
  log "Loading .env for local overrides"
  # Export variables from .env without clobbering existing ones
  while IFS='=' read -r key value; do
    # Skip comments and empty lines
    if [[ -z "$key" ]] || [[ "$key" =~ ^[[:space:]]*# ]]; then
      continue
    fi

    key="${key##[[:space:]]*}"
    key="${key%%[[:space:]]*}"
    if [[ ! "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
      continue
    fi

    value="${value%%$'\r'}"
    value="${value%%#*}"
    value="${value%%|*}"
    value="${value##[[:space:]]*}"
    value="${value%%[[:space:]]*}"
    value="${value%\"}"
    value="${value#\"}"
    value="${value%\'}"
    value="${value#\'}"

    if [ -z "${!key:-}" ]; then
      export "$key=$value"
    fi
  done < "$ROOT_DIR/.env"
else
  log "No .env found. Using environment / defaults."
fi

if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  printf 'Error: %s is required but was not found on PATH.\n' "$PYTHON_BIN" >&2
  exit 1
fi

log "Using Python interpreter: $(command -v "$PYTHON_BIN")"

if [ ! -d "$VENV_DIR" ]; then
  log "Creating virtual environment"
  "$PYTHON_BIN" -m venv "$VENV_DIR"
else
  log "Virtual environment already exists"
fi

PIP_BIN="$VENV_DIR/bin/pip"
PY_BIN="$VENV_DIR/bin/python"

log "Upgrading pip"
"$PY_BIN" -m pip install --upgrade pip >/dev/null

log "Installing Python requirements"
"$PIP_BIN" install --requirement "$ROOT_DIR/requirements.txt"

log "Ensuring runtime directories and validating configuration"
"$PY_BIN" <<'PY'
from tamaos.config import settings

settings.ensure_runtime_paths()
print(settings.summary())
PY

log "Running smoke test"
"$PY_BIN" <<'PY'
from tamaos.config import settings
from pathlib import Path

missing = [str(path) for path in settings.runtime_paths if not Path(path).exists()]
if missing:
    raise SystemExit(f"Runtime paths missing: {', '.join(missing)}")

print("Smoke test passed: configuration and runtime paths are ready.")
PY

log "Setup complete. Next steps:"
echo "  source \"$VENV_DIR/bin/activate\""
echo "  python -m tamaos.main"
