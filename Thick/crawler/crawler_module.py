# Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
# MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
"""Walks a folder into a corpus (crawler-corpus version 1, corpus_format.py).

Which folders are skipped, which files are text and what the AST metrics are
come from corpus_format -- the same rules Thin's crawlerEngine.ts uses, held
together by Contract/fixtures/v1. The walk only reads: it used to delete every
__pycache__ it met; it now just skips them.
"""

import datetime
import hashlib
import inspect
import os
from concurrent.futures import ThreadPoolExecutor

from . import corpus_format
from .config_manager import DEFAULT_CRAWL_WORKERS
from .utils_module import debug_log, current_version, GitIgnoreMatcher

HASH_CHUNK_BYTES = 1 << 20  # sha256 is streamed; a sample file is never held whole to hash it


def hash_file(file_path):
    """(sha256 hex, size) of the file, read in chunks; (None, None) when it cannot be read."""
    digest = hashlib.sha256()
    size = 0
    try:
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(HASH_CHUNK_BYTES), b""):
                digest.update(chunk)
                size += len(chunk)
    except OSError:
        return None, None
    return digest.hexdigest(), size


class Crawler:
    """The walk is sequential (listing is cheap and decides the order); hashing,
    reading, AST metrics and comment extraction run on a pool of `workers`
    threads. Results are consumed in corpus order on the calling thread, which
    is the only one that logs or writes, so the corpus, Crawl.log and the
    extractor's log are the same whatever the pool size."""

    def __init__(self, target_directory, saver, allowed_extensions=None, log_callback=None, extractor=None,
                 workers=None):
        self.target_directory = target_directory
        self.saver = saver
        self.allowed_extensions = allowed_extensions
        self.log_callback = log_callback
        self.extractor = extractor
        self.workers = max(1, int(workers or DEFAULT_CRAWL_WORKERS))
        self.current_file = os.path.basename(__file__)
        self.gitignore_matcher = GitIgnoreMatcher(target_directory)
        self.respect_gitignore = True
        self.duplicates = 0

    def _log(self, message, tag="file"):
        if self.log_callback:
            self.log_callback(message, tag)
        if self.saver:
            self.saver.write_log(message)

    def _ignored(self, rel, is_dir):
        return self.respect_gitignore and self.gitignore_matcher.ignores(rel, is_dir)

    def _walk(self):
        """Every kept dir and file entry, in corpus order, and {path: absolute path}."""
        entries, where = [], {}
        for root, dirs, files in os.walk(self.target_directory, topdown=True):
            rel_root = os.path.relpath(root, self.target_directory).replace(os.sep, "/")
            rel_root = "" if rel_root == "." else rel_root + "/"
            dirs[:] = sorted(d for d in dirs
                             if not corpus_format.is_skipped_dir(d) and not self._ignored(rel_root + d, True))
            entries.extend({"path": rel_root + d, "kind": "dir"} for d in dirs)
            for name in sorted(files):
                rel = rel_root + name
                if self._ignored(rel, False):
                    continue
                if self.allowed_extensions is not None and corpus_format.ext_of(name) not in self.allowed_extensions:
                    continue
                entries.append({"path": rel, "kind": "file", "content": None, "metrics": None})
                where[rel] = os.path.join(root, name)
        return corpus_format.order_entries(entries), where

    def _read(self, entry, file_path, size):
        """Worker: (content, metrics, extracted text, error) of one file."""
        name = entry["path"].rsplit("/", 1)[-1]
        if not corpus_format.is_text_file(name):
            return None, None, None, None
        try:
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()
        except OSError as e:
            return None, None, None, f"    ❌ Error reading {entry['path']}: {e}"
        metrics = corpus_format.python_metrics(content) if corpus_format.wants_ast(name, size or 0) else None
        extracted, error = None, None
        if self.extractor:
            try:
                extracted = self.extractor.extract_text(file_path, content)
            except Exception as e:  # one odd file must not stop the crawl
                error = f"❌ Error extracting from {file_path}: {e}"
        return content, metrics, extracted, error

    def collect_entries(self):
        """The corpus entries of the target folder (see corpus_format). A file
        whose sha256 matches an earlier one (corpus order; empty files never
        count) gets "sameAs" and is neither read nor extracted."""
        entries, where = self._walk()
        files = [e for e in entries if e["kind"] == "file"]
        self._log(f"{len(files)} files in {len(entries) - len(files)} folders; "
                  f"hashing and reading on {self.workers} threads", "header")
        self.duplicates = 0
        with ThreadPoolExecutor(max_workers=self.workers, thread_name_prefix="crawl") as pool:
            hashes = list(pool.map(hash_file, [where[e["path"]] for e in files]))
            first_with, unique = {}, []
            for entry, (sha, size) in zip(files, hashes):
                entry["sha256"] = sha
                if sha and size and sha in first_with:
                    entry["sameAs"] = first_with[sha]
                    self.duplicates += 1
                    continue
                if sha and size:
                    first_with[sha] = entry["path"]
                unique.append((entry, size))
            results = iter(pool.map(lambda job: self._read(job[0], where[job[0]["path"]], job[1]), unique))
            for entry in entries:
                if entry["kind"] == "dir":
                    self._log(f"└── {entry['path']}/", "dir")
                    continue
                if entry.get("sameAs"):
                    self._log(f"    {entry['path']}  = {entry['sameAs']} (same content, linked)", "file")
                    continue
                entry["content"], entry["metrics"], extracted, error = next(results)
                if error:
                    self._log(error, "header")
                if self.extractor and extracted is not None:
                    self.extractor.write_extracted(entry["path"], extracted)
                m = entry["metrics"]
                if m and (m["classCount"] or m["functionCount"]):
                    self._log(f"[AST] {entry['path']} -> {m['classCount']} classes, {m['functionCount']} functions",
                              "python_file")
                self._log(f"    {entry['path']}", "file")
        if self.duplicates:
            self._log(f"{self.duplicates} duplicate files linked to their first copy, not saved again", "header")
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
