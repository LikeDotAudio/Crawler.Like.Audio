# Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
# MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
"""Rebuilds a folder from an EVERYTHING.LOG (corpus_format.parse_everything).

Reads crawler-corpus version 1 and the unversioned files both halves wrote
before it (Thin's "# --- File: /x", Thick's 37-hash banner); refuses a newer
version instead of guessing, and never writes outside the destination.
A link line (corpus_format.parse_links: a duplicate the crawl saved once)
is written again under its own name from the file it names."""

import inspect
import os

from . import corpus_format
from .utils_module import debug_log, current_version


class ProjectRegenerator:
    def __init__(self, log_callback=None):
        self.log_callback = log_callback
        self.current_file = os.path.basename(__file__)

    def _log(self, message, tag="header"):
        if self.log_callback:
            self.log_callback(message, tag)

    def regenerate_text(self, text, destination_dir):
        """Writes every file of the corpus `text` under `destination_dir`;
        returns the number written. Raises UnsupportedCorpusVersion."""
        parsed = corpus_format.parse_everything(text)
        for path in parsed["skipped"]:
            self._log(f"⚠️ Skipped unsafe path: {path}")
        written = 0
        contents = {f["path"]: f["content"] for f in parsed["files"]}
        links = [{"path": link["path"], "content": contents[link["sameAs"]]}
                 for link in corpus_format.parse_links(text) if link["sameAs"] in contents]
        for f in parsed["files"] + links:
            new_file_path = os.path.join(destination_dir, *f["path"].split("/"))
            self._log(f"Processing: {new_file_path}", "file")
            try:
                os.makedirs(os.path.dirname(new_file_path), exist_ok=True)
                with open(new_file_path, "w", encoding="utf-8") as outfile:
                    outfile.write(f["content"])
                written += 1
            except OSError as e:
                self._log(f"❌ Error creating {new_file_path}: {e}")
        return written

    def regenerate(self, log_file_path, destination_dir):
        self._log(f"--- Starting regeneration from: {os.path.basename(log_file_path)} ---")
        self._log(f"Restoring to: {destination_dir}")
        debug_log(message=f"Starting regeneration from log: {log_file_path}", file=self.current_file,
                  version=current_version, function=inspect.currentframe().f_code.co_name)
        try:
            with open(log_file_path, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()
            written = self.regenerate_text(content, destination_dir)
            if not written:
                self._log("❌ Error: no files found in this log.")
                return False
            self._log(f"\n--- Regeneration complete: {written} files. 👍 ---")
            return True
        except corpus_format.UnsupportedCorpusVersion as e:
            self._log(f"❌ {e}")
            return False
        except Exception as e:
            self._log(f"❌ Critical error during regeneration: {e}")
            return False
