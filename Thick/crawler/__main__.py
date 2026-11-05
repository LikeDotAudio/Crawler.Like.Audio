# Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
# MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
"""`python3 -m crawler` from Thick/ opens the desktop app.

A common mistake (no tkinter, a module from requirements.txt not installed, no
desktop to open on) prints apkaudio_contracts.problems' problem_text with its
fix and exits 1, via cli_problems.guarded — not a traceback (ROAD-3522)."""

import os
import sys

from .cli_problems import guarded


def _open():
    import tkinter as tk
    from .gui_module import FolderCrawlerApp
    root = tk.Tk()
    start_directory = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    FolderCrawlerApp(root, start_directory)
    root.mainloop()


def main():
    return guarded(_open)


if __name__ == "__main__":
    sys.exit(main())
