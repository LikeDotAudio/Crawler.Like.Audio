# Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
# MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
"""`python3 -m crawler` from Thick/ opens the desktop app."""

import os
import tkinter as tk


def main():
    from .gui_module import FolderCrawlerApp
    root = tk.Tk()
    start_directory = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    FolderCrawlerApp(root, start_directory)
    root.mainloop()


if __name__ == "__main__":
    main()
