#!/bin/bash

# Navigate to the script's directory
cd "$(dirname "$0")"

# Run the application with the system Python (no virtual environment).
# VIRTUAL_ENV is cleared so an editor-activated venv cannot hijack the run.
unset VIRTUAL_ENV
exec /usr/bin/python3 main.py
