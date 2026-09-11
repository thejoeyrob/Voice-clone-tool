#!/bin/bash
set -e
cd "$(dirname "$0")"
if [ ! -x .jweds-venv/bin/python ]; then echo "Create .jweds-venv and install requirements-local-engine.txt first."; exit 1; fi
exec .jweds-venv/bin/python engine_server.py
