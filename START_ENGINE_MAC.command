#!/bin/bash
set -e
cd "$(dirname "$0")"
if [ ! -x .jweds-venv/bin/python ]; then echo "Run SETUP_ENGINE_MAC.command first."; read -r -p "Press Enter to close"; exit 1; fi
(open http://127.0.0.1:8765 >/dev/null 2>&1 &) || true
exec .jweds-venv/bin/python engine_server.py
