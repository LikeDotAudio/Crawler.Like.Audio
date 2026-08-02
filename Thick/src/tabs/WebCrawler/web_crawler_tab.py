# src/tabs/WebCrawler/web_crawler_tab.py
import tkinter as tk
from tkinter import ttk, messagebox
import queue
import os
from urllib.parse import urlparse

from .downloader import Downloader
from .parser import Parser
from .view import ResultsView

class WebCrawlerTab(ttk.Frame):
    def __init__(self, notebook, log_callback, config_manager):
        super().__init__(notebook)
        self.log_callback = log_callback
        self.config_manager = config_manager
        
        # Communication queues
        self.url_queue = queue.Queue()
        self.md_queue = queue.Queue()
        self.visited_urls = set()

        # Instantiate components
        self.results_view = ResultsView(self)
        self.parser = Parser(log_callback, self.md_queue, self.results_view.add_file_to_tree)
        self.downloader = Downloader(log_callback, self.md_queue, self.url_queue, self.visited_urls, self.results_view.add_file_to_tree)

        self._setup_ui()
        self._load_last_url()

    def _setup_ui(self):
        # Configuration Frame
        config_frame = ttk.LabelFrame(self, text="Web Crawler Settings")
        config_frame.pack(fill="x", padx=10, pady=5)

        ttk.Label(config_frame, text="Starting URL:").grid(row=0, column=0, padx=5, pady=5)
        self.url_entry = ttk.Entry(config_frame, width=50)
        self.url_entry.grid(row=0, column=1, padx=5, pady=5, sticky="ew")
        self.url_entry.bind("<KeyRelease>", self._update_folder_preview)
        
        ttk.Label(config_frame, text="Output Folder:").grid(row=1, column=0, padx=5, pady=5)
        self.folder_display = ttk.Label(config_frame, text="[Enter a URL to see output path]", foreground="#E0E0E0")
        self.folder_display.grid(row=1, column=1, padx=5, pady=5, sticky="w")

        self.scrape_media = tk.BooleanVar()
        ttk.Checkbutton(config_frame, text="Scrape Media", variable=self.scrape_media).grid(row=2, column=0, columnspan=2, padx=5, pady=5, sticky="w")

        # Buttons Frame
        btn_frame = ttk.Frame(self)
        btn_frame.pack(fill="x", padx=10, pady=5)
        
        self.btn_start = ttk.Button(btn_frame, text=" 🚀 Start Crawl ", command=self._start_crawl)
        self.btn_start.pack(side="left", padx=5)
        
        self.btn_open = ttk.Button(btn_frame, text=" 📂 Open Output Folder ", command=self._open_output_folder)
        self.btn_open.pack(side="left", padx=5)
        
        # Results View
        self.results_view.pack(fill="both", expand=True)

    def _load_last_url(self):
        last_url = self.config_manager.get_web_url()
        if last_url:
            self.url_entry.insert(0, last_url)
            self._update_folder_preview()
        else:
            self.folder_display.config(text="[Enter a URL to see output path]", foreground="gray")

    def _update_folder_preview(self, event=None):
        url = self.url_entry.get().strip()
        if not url:
            self.folder_display.config(text="[Enter a URL to see output path]", foreground="gray")
            return
        
        try:
            parsed = urlparse(url)
            if parsed.netloc:
                folder_name = "crawl-" + parsed.netloc.replace('.', '-')
                preview_path = os.path.join("scrapes", folder_name)
                self.folder_display.config(text=preview_path, foreground="#E0E0E0")
            else:
                self.folder_display.config(text="[Invalid URL format]", foreground="red")
        except ValueError:
            self.folder_display.config(text="[Error parsing URL]", foreground="red")

    def _start_crawl(self):
        url = self.url_entry.get().strip()
        if not url:
            messagebox.showwarning("Warning", "Please enter a URL")
            return
        
        parsed = urlparse(url)
        if not parsed.scheme or not parsed.netloc:
            messagebox.showerror("Error", "Invalid URL")
            return

        self.config_manager.set_web_url(url)
        
        # Clear previous results
        self.results_view.clear_tree()
        self.visited_urls.clear()
        self.url_queue = queue.Queue() # Re-initialize queues
        self.md_queue = queue.Queue()
        
        # Update components with new queues
        self.parser.md_queue = self.md_queue
        self.downloader.url_queue = self.url_queue
        self.downloader.md_queue = self.md_queue
        
        # Determine output directory for markdown
        folder_name = "crawl-" + parsed.netloc.replace('.', '-')
        project_root = os.getcwd()
        md_dir = os.path.join(project_root, "scrapes", folder_name + "-MD")
        html_dir = os.path.join(project_root, "scrapes", folder_name)

        self.results_view.set_current_output_dir(html_dir)
        self.downloader.current_output_dir = html_dir
        
        # Start workers
        parser_thread = self.parser.start_worker(md_dir)
        self.downloader.start_crawl(url, self.scrape_media.get())
        
        # We might need to handle the parser_thread joining later, maybe in a monitor thread
        
    def _open_output_folder(self):
        if self.downloader.current_output_dir and os.path.exists(self.downloader.current_output_dir):
            import subprocess
            try:
                if os.name == 'nt': os.startfile(self.downloader.current_output_dir)
                elif os.uname().sysname == 'Darwin': subprocess.run(['open', self.downloader.current_output_dir], check=True)
                else: subprocess.run(['xdg-open', self.downloader.current_output_dir], check=True)
            except Exception as e:
                self.log_callback(f"❌ Error opening folder: {e}", "header")
        else:
            self.log_callback("ℹ️ No active output directory found. Start a crawl first.", "header")

