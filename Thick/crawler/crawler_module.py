# Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
# MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
"""Walks a folder into a corpus (crawler-corpus version 1, corpus_format.py).

Which folders are skipped, which files are text and what the AST metrics are
come from corpus_format -- the same rules Thin's crawlerEngine.ts uses, held
together by Contract/fixtures/v1. The walk only reads: it used to delete every
__pycache__ it met; it now just skips them.
"""

import datetime
import inspect
import os

from . import corpus_format
from .utils_module import debug_log, current_version, GitIgnoreMatcher


class Crawler:
    def __init__(self, target_directory, saver, allowed_extensions=None, log_callback=None, extractor=None):
        self.target_directory = target_directory
        self.saver = saver
        self.allowed_extensions = allowed_extensions
        self.log_callback = log_callback
        self.extractor = extractor
        self.current_file = os.path.basename(__file__)
        self.gitignore_matcher = GitIgnoreMatcher(target_directory)
        self.respect_gitignore = True

    def _log(self, message, tag="file"):
        if self.log_callback:
            self.log_callback(message, tag)
        if self.saver:
            self.saver.write_log(message)

    def _ignored(self, rel, is_dir):
        return self.respect_gitignore and self.gitignore_matcher.ignores(rel, is_dir)

    def collect_entries(self):
        """The corpus entries of the target folder (see corpus_format)."""
        entries = []
        for root, dirs, files in os.walk(self.target_directory, topdown=True):
            rel_root = os.path.relpath(root, self.target_directory).replace(os.sep, "/")
            rel_root = "" if rel_root == "." else rel_root + "/"
            dirs[:] = sorted(d for d in dirs
                             if not corpus_format.is_skipped_dir(d) and not self._ignored(rel_root + d, True))
            for d in dirs:
                entries.append({"path": rel_root + d, "kind": "dir"})
                self._log(f"└── {rel_root}{d}/", "dir")
            for name in sorted(files):
                rel = rel_root + name
                if self._ignored(rel, False):
                    continue
                if self.allowed_extensions is not None and corpus_format.ext_of(name) not in self.allowed_extensions:
                    continue
                file_path = os.path.join(root, name)
                entry = {"path": rel, "kind": "file", "content": None, "metrics": None}
                if corpus_format.is_text_file(name):
                    try:
                        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                            entry["content"] = f.read()
                    except OSError as e:
                        self._log(f"    ❌ Error reading {rel}: {e}", "header")
                    if entry["content"] is not None and self.extractor:
                        self.extractor.extract_from_file(file_path, rel)
                if entry["content"] is not None and corpus_format.wants_ast(name, os.path.getsize(file_path)):
                    entry["metrics"] = corpus_format.python_metrics(entry["content"])
                    m = entry["metrics"]
                    if m and (m["classCount"] or m["functionCount"]):
                        self._log(f"[AST] {rel} -> {m['classCount']} classes, {m['functionCount']} functions", "python_file")
                self._log(f"    {rel}", "file")
                entries.append(entry)
        return entries

    def crawl(self, created=None):
        """Writes MAP.txt and EVERYTHING.LOG through the saver; returns
        (map_text, everything_text), or None when the target is not a folder."""
        debug_log(message=f"Starting crawl of {self.target_directory}", file=self.current_file,
                  version=current_version, function=inspect.currentframe().f_code.co_name)
        if not os.path.isdir(self.target_directory):
            self._log(f"❌ Error: '{self.target_directory}' is not a valid directory.", "header")
            return None
        self._log(f"Crawling directory: {self.target_directory}", "header")
        created = created or datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        entries = self.collect_entries()
        root_name = os.path.basename(os.path.abspath(self.target_directory))
        map_text, everything_text = corpus_format.build_corpus(root_name, entries, created)
        if self.saver:
            self.saver.write_corpus(map_text, everything_text)
        return map_text, everything_text
