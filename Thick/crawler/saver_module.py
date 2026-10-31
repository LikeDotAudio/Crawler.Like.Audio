# Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
# MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
"""Writes a crawl's output folder: Crawl.log as it goes, then MAP.txt and
EVERYTHING.LOG (crawler-corpus version 1, corpus_format.py) once the walk is
done. EVERYTHING.LOG already starts with the map; until 2026-10-30 the saver
prepended it afterwards (prepend_map_to_everything), reading files it still
held open, and named the corpus EVERYTHING.py.LOG."""

import datetime
import inspect
import os

from . import corpus_format
from .utils_module import debug_log, current_version

MAP_NAME = "MAP.txt"
EVERYTHING_NAME = "EVERYTHING.LOG"


class DataSaver:
    def __init__(self, output_dir, log_callback=None):
        self.output_dir = output_dir
        self.log_callback = log_callback
        self.current_file = os.path.basename(__file__)
        self.log_file = None

    def open_files(self):
        stamp = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        log_file_path = os.path.join(self.output_dir, "Crawl.log")
        try:
            self.log_file = open(log_file_path, "w", encoding="utf-8")
            self.log_file.write(f"--- Crawl Log Started: {stamp} ---\n\n")
            if self.log_callback:
                self.log_callback(f"--- Crawl Log Started: {stamp} ---", "header")
            debug_log(message=f"Crawl.log opened at {log_file_path}", file=self.current_file,
                      version=current_version, function=inspect.currentframe().f_code.co_name)
        except Exception as e:
            if self.log_callback:
                self.log_callback(f"❌ Error opening Crawl.log: {e}", "header")
            self.log_file = None

    def write_log(self, message):
        if self.log_file:
            try:
                self.log_file.write(message + "\n")
            except Exception:
                pass

    def write_corpus(self, map_text, everything_text):
        for name, text in ((MAP_NAME, map_text), (EVERYTHING_NAME, everything_text)):
            try:
                with open(os.path.join(self.output_dir, name), "w", encoding="utf-8") as f:
                    f.write(text)
            except Exception as e:
                if self.log_callback:
                    self.log_callback(f"❌ Error writing {name}: {e}", "header")
        if self.log_callback:
            self.log_callback(f"Wrote {MAP_NAME} and {EVERYTHING_NAME} ({corpus_format.CORPUS_HEADER[2:]})", "header")

    def close_files(self):
        if self.log_file:
            self.log_file.close()
            self.log_file = None
