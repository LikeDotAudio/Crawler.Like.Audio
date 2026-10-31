# Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
# MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
"""Kept so `python3 main.py` still works; the app is the `crawler` package
(`python3 -m crawler` from Thick/). Python puts this file's folder on sys.path
itself, so nothing is appended to it."""

from crawler.__main__ import main

if __name__ == "__main__":
    main()
