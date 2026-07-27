@echo off
:: Navigate to the directory where this batch file is located
cd /d "%~dp0"

:: Run with the system Python (no virtual environment)
python main.py
if %errorlevel% neq 0 (
    python3 main.py
)

:: Keep the window open if there is an error
if %errorlevel% neq 0 (
    pause
)
