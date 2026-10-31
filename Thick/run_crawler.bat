@echo off
:: Navigate to the directory where this batch file is located
cd /d "%~dp0"

:: Run with the system Python (no virtual environment)
python -m crawler
if %errorlevel% neq 0 (
    python3 -m crawler
)

:: Keep the window open if there is an error
if %errorlevel% neq 0 (
    pause
)
