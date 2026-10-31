# Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
# MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
"""Tk front end for CAPTURE.WebScraper -- the monorepo's one polite crawler.

Until 2026-10-30 this tab carried its own requests + markdownify scraper
(downloader.py / parser.py) with a spoofed Chrome User-Agent, no delay, no
robots.txt and no provenance -- a copy of the one CAPTURE.crawler dropped the
same day; this file follows CAPTURE.crawler's tab. It now calls
`apk_webscraper.crawl()`, so every crawl started here obeys the target's robots.txt, the per-host rate limit and
size cap in CAPTURE.WebScraper's config.ini, writes `.provenance.json` beside
each fetched file and records the corpus in `<out>/INDEX.json`.

`apk_webscraper` is a pip package (CAPTURE.WebScraper's pyproject.toml);
installation.py installs it (from the monorepo checkout when there is one).
Without it the tab says so and stays inert -- it does not fall back to a second scraper.

Output goes to `scrapes/` under the folder the app was started from, laid out
as CAPTURE.WebScraper lays it out (`<host>-<path>`, `-MD`, `-MEDIA/<host>/`).
"""

import os
import subprocess
import threading
import tkinter as tk
from tkinter import messagebox, ttk
from urllib.parse import urlparse

from .view import ResultsView

try:
    import apk_webscraper
    from apk_webscraper import engine as webscraper_engine
except ImportError:              # the tab degrades, the app does not
    apk_webscraper = None
    webscraper_engine = None

MISSING = ("CAPTURE.WebScraper (package apk_webscraper) is not installed. "
           "Run installation.py, or: pip install <monorepo>/PODS/POD.THIN/Softapps/CAPTURE/CAPTURE.WebScraper")


def output_paths(url, out_root):
    """(html folder, markdown folder) CAPTURE.WebScraper will write for `url`."""
    _, folder = webscraper_engine.plan(url)
    return os.path.join(out_root, folder), os.path.join(out_root, folder + "-MD")


class WebCrawlerTab(ttk.Frame):
    def __init__(self, notebook, log_callback, config_manager, out_root=None):
        super().__init__(notebook)
        self.log_callback = log_callback
        self.config_manager = config_manager
        self.out_root = out_root or os.path.join(os.getcwd(), "scrapes")
        self.current_output_directory = None
        self.running = False
        self.results_view = ResultsView(self)
        self._setup_ui()
        self._load_last_url()

    def _setup_ui(self):
        config_frame = ttk.LabelFrame(self, text="Web Crawler (CAPTURE.WebScraper)")
        config_frame.pack(fill="x", padx=10, pady=5)

        ttk.Label(config_frame, text="Starting URL:").grid(row=0, column=0, padx=5, pady=5)
        self.url_entry = ttk.Entry(config_frame, width=50)
        self.url_entry.grid(row=0, column=1, padx=5, pady=5, sticky="ew")
        self.url_entry.bind("<KeyRelease>", self._update_folder_preview)

        ttk.Label(config_frame, text="Output Folder:").grid(row=1, column=0, padx=5, pady=5)
        self.folder_display = ttk.Label(config_frame, text="[Enter a URL to see output path]")
        self.folder_display.grid(row=1, column=1, padx=5, pady=5, sticky="w")

        self.scrape_media = tk.BooleanVar()
        ttk.Checkbutton(config_frame, text="Scrape Media (target host only)", variable=self.scrape_media
                        ).grid(row=2, column=0, columnspan=2, padx=5, pady=5, sticky="w")

        btn_frame = ttk.Frame(self)
        btn_frame.pack(fill="x", padx=10, pady=5)
        self.btn_start = ttk.Button(btn_frame, text=" 🚀 Start Crawl ", command=self._start_crawl)
        self.btn_start.pack(side="left", padx=5)
        ttk.Button(btn_frame, text=" 📂 Open Output Folder ", command=self._open_output_folder).pack(side="left", padx=5)
        if apk_webscraper is None:
            self.btn_start.state(["disabled"])
            ttk.Label(self, text=MISSING, wraplength=700).pack(fill="x", padx=10)
        self.results_view.pack(fill="both", expand=True)

    def _load_last_url(self):
        last_url = self.config_manager.get_web_url()
        if last_url:
            self.url_entry.insert(0, last_url)
        self._update_folder_preview()

    def _update_folder_preview(self, event=None):
        url = self.url_entry.get().strip()
        parsed = urlparse(url)
        if not url:
            self.folder_display.config(text="[Enter a URL to see output path]")
        elif not parsed.scheme or not parsed.netloc:
            self.folder_display.config(text="[Invalid URL format]")
        elif webscraper_engine is None:
            self.folder_display.config(text="[CAPTURE.WebScraper not installed]")
        else:
            self.folder_display.config(text=output_paths(url, self.out_root)[0])

    def _start_crawl(self):
        if apk_webscraper is None:
            messagebox.showerror("Web Crawler", MISSING)
            return
        if self.running:
            messagebox.showinfo("Web Crawler", "A crawl is already running.")
            return
        url = self.url_entry.get().strip()
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https") or not parsed.netloc:
            messagebox.showerror("Error", "Invalid URL")
            return
        self.config_manager.set_web_url(url)
        self.results_view.clear_tree()
        html_dir, _ = output_paths(url, self.out_root)
        self.current_output_directory = html_dir
        self.results_view.set_current_output_dir(html_dir)
        self.running = True
        self.btn_start.state(["disabled"])
        threading.Thread(target=self._run, args=(url, self.scrape_media.get()), daemon=True).start()

    def _run(self, url, media):
        """Worker thread: no Tk calls except through after() (log_callback and
        add_file_to_tree are thread-safe the way the rest of the app uses them)."""
        self.log_callback(f"Starting crawl for: {url}", "header")
        try:
            stats = apk_webscraper.crawl(url, out=self.out_root, media=media,
                                         logger=lambda line: self.log_callback(line, "file"),
                                         on_file=self.results_view.add_file_to_tree)
            self.log_callback(f"Crawl finished: {stats}", "header")
        except Exception as error:     # a crawl that dies says so in the log
            self.log_callback(f"❌ Crawl failed: {error}", "header")
        finally:
            self.running = False
            self.after(0, lambda: self.btn_start.state(["!disabled"]))

    def _open_output_folder(self):
        directory = self.current_output_directory
        if directory and os.path.exists(directory):
            try:
                if os.name == "nt":
                    os.startfile(directory)
                elif os.uname().sysname == "Darwin":
                    subprocess.run(["open", directory], check=True)
                else:
                    subprocess.run(["xdg-open", directory], check=True)
            except Exception as error:
                self.log_callback(f"❌ Error opening folder: {error}", "header")
        else:
            self.log_callback("ℹ️ No active output directory found. Start a crawl first.", "header")
