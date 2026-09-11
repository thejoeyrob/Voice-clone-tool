#!/bin/bash
set -e
cd "$(dirname "$0")"
echo "JW EDS Audio Engine - first-time local engine setup"
PY=""
for CANDIDATE in python3.11 python3.10 python3; do
  if command -v "$CANDIDATE" >/dev/null 2>&1; then PY="$CANDIDATE"; break; fi
done
if [ -z "$PY" ]; then echo "Python 3.10 or 3.11 is required."; read -r -p "Press Enter to close"; exit 1; fi
"$PY" -m venv .jweds-venv
source .jweds-venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements-local-engine.txt
echo
printf 'Setup complete. Double-click START_ENGINE_MAC.command next.\n'
read -r -p "Press Enter to close"
