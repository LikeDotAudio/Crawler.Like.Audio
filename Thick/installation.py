#!/usr/bin/env python3
import os
import shutil
import subprocess
import sys

# Determine the absolute path of the project directory
PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
DESKTOP_FILE_SOURCE = os.path.join(PROJECT_DIR, "Crawler.desktop")
DESKTOP_FILE_DEST = os.path.expanduser("~/.local/share/applications/Crawler.desktop")
ICON_PATH = os.path.join(PROJECT_DIR, "crawler_icon.svg")
EXEC_PATH = os.path.join(PROJECT_DIR, "run_crawler.sh")
REQUIREMENTS = os.path.join(PROJECT_DIR, "requirements.txt")
# CAPTURE.WebScraper -- the polite crawler the Web Crawler tab drives -- as a
# package: the monorepo checkout when this repo sits inside APK.audio
# (Thick -> Crawler.Like.Audio -> SCANALYZER.Like.audio -> SCANALYZER_SUITE ->
# Softapps), else its own repository. Without it only that tab is inert.
WEBSCRAPER_CHECKOUT = os.path.normpath(os.path.join(PROJECT_DIR, "..", "..", "..", "..", "CAPTURE", "CAPTURE.WebScraper"))
WEBSCRAPER_REMOTE = "git+https://github.com/LikeDotAudio/APK.softapp.CAPTURE.WebScraper.git"

def install_dependencies():
    """Installs dependencies for the system Python (no virtual environment)."""
    python = "/usr/bin/python3" if os.name != "nt" and os.path.exists("/usr/bin/python3") else sys.executable
    print(f"Installing dependencies for {python}...")

    base_cmd = [python, "-m", "pip", "install", "--user", "-r", REQUIREMENTS]

    try:
        subprocess.check_call(base_cmd)
    except subprocess.CalledProcessError:
        # Debian/Ubuntu mark the system Python as externally managed (PEP 668).
        # --user still installs into ~/.local only, leaving distro packages alone.
        print("Retrying with --break-system-packages (PEP 668 externally-managed environment)...")
        subprocess.check_call(base_cmd + ["--break-system-packages"])

    source = WEBSCRAPER_CHECKOUT if os.path.isfile(os.path.join(WEBSCRAPER_CHECKOUT, "pyproject.toml")) else WEBSCRAPER_REMOTE
    print(f"Installing CAPTURE.WebScraper from {source}...")
    scraper_cmd = [python, "-m", "pip", "install", "--user", source]
    try:
        subprocess.check_call(scraper_cmd)
    except subprocess.CalledProcessError:
        try:
            subprocess.check_call(scraper_cmd + ["--break-system-packages"])
        except subprocess.CalledProcessError:
            print("CAPTURE.WebScraper did not install; the Web Crawler tab will say so and stay inert.")

def update_desktop_file():
    """Updates the paths in the Crawler.desktop file to match the current directory."""
    print(f"Updating {DESKTOP_FILE_SOURCE} with correct paths...")
    
    with open(DESKTOP_FILE_SOURCE, "r") as f:
        lines = f.readlines()
    
    with open(DESKTOP_FILE_SOURCE, "w") as f:
        for line in lines:
            if line.startswith("Exec="):
                f.write(f"Exec=\"{EXEC_PATH}\"\n")
            elif line.startswith("Icon="):
                f.write(f"Icon={ICON_PATH}\n")
            else:
                f.write(line)

def install_desktop_shortcut():
    """Copies the desktop shortcut to the user's applications folder."""
    print(f"Installing desktop shortcut to {DESKTOP_FILE_DEST}...")
    
    # Ensure the destination directory exists
    os.makedirs(os.path.dirname(DESKTOP_FILE_DEST), exist_ok=True)
    
    # Copy the desktop file
    shutil.copy2(DESKTOP_FILE_SOURCE, DESKTOP_FILE_DEST)
    
    # Ensure the desktop file is executable
    os.chmod(DESKTOP_FILE_DEST, 0o755)
    
    # Ensure run_crawler.sh is executable
    os.chmod(EXEC_PATH, 0o755)
    
    print("Installation complete. You should now find 'Crawler' in your applications menu and can pin it to your taskbar.")

if __name__ == "__main__":
    install_dependencies()
    update_desktop_file()
    install_desktop_shortcut()
