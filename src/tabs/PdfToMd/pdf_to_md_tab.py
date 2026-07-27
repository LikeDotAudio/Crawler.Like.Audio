# src/tabs/PdfToMd/pdf_to_md_tab.py

import os
import subprocess
import threading
import tkinter as tk
from tkinter import ttk, filedialog, messagebox

from ...styles import *
from . import converter
from .converter import (
    STATUS_CONVERTED, STATUS_NO_TEXT, STATUS_EXISTS,
    STATUS_ENCRYPTED, STATUS_ERROR,
)

STATUS_COLORS = {
    STATUS_CONVERTED: COLOR_IMPORT,
    STATUS_NO_TEXT: COLOR_PRIMARY,
    STATUS_EXISTS: COLOR_TEXT_MUTED,
    STATUS_ENCRYPTED: COLOR_PRIMARY,
    STATUS_ERROR: "#ff5555",
}


class PdfToMdTab(ttk.Frame):
    def __init__(self, notebook, log_callback=None, config_manager=None):
        super().__init__(notebook)
        self.log_callback = log_callback
        self.config_manager = config_manager

        self.source_dir = ""
        self.last_output_root = None
        self.all_pdf_paths = []   # everything the scan found
        self.pdf_paths = []       # the subset currently passing the filter
        self.row_state = {}       # pdf path -> (status, detail), survives re-filtering
        self.busy = False
        self.cancel_event = threading.Event()
        self.worker = None

        self._setup_ui()
        self._load_saved_paths()

    # -- UI --

    def _setup_ui(self):
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(2, weight=1)

        # --- Settings ---
        settings = ttk.LabelFrame(self, text=" 📄 PDF TO MARKDOWN (OFFLINE) ")
        settings.grid(row=0, column=0, sticky="ew", padx=10, pady=(10, 5))
        settings.grid_columnconfigure(1, weight=1)

        ttk.Label(settings, text="PDF Folder:").grid(row=0, column=0, padx=5, pady=5, sticky="w")
        self.source_entry = ttk.Entry(settings)
        self.source_entry.grid(row=0, column=1, padx=5, pady=5, sticky="ew")
        ttk.Button(settings, text=" 📁 Browse ", command=self._browse_source).grid(row=0, column=2, padx=5, pady=5)

        ttk.Label(settings, text="File Filter:").grid(row=1, column=0, padx=5, pady=5, sticky="w")
        filter_frame = ttk.Frame(settings)
        filter_frame.grid(row=1, column=1, columnspan=2, padx=5, pady=5, sticky="ew")
        self.filter_entry = ttk.Entry(filter_frame)
        self.filter_entry.pack(side="left", fill="x", expand=True)
        self.filter_entry.bind("<KeyRelease>", self._on_filter_change)
        ttk.Label(filter_frame,
                  text=" e.g.  invoice,  *2024*.pdf,  reports/",
                  font=("Segoe UI", 8, "italic"), foreground=COLOR_TEXT_MUTED).pack(side="left", padx=5)

        self.output_mode = tk.StringVar(value="beside")
        mode_frame = ttk.Frame(settings)
        mode_frame.grid(row=2, column=0, columnspan=3, padx=5, pady=(5, 0), sticky="w")
        ttk.Label(mode_frame, text="Write .md files:").pack(side="left", padx=(0, 10))
        ttk.Radiobutton(mode_frame, text="Next to each PDF", variable=self.output_mode,
                        value="beside", command=self._on_mode_change).pack(side="left", padx=5)
        ttk.Radiobutton(mode_frame, text="Into a separate folder (mirrors sub-folders)",
                        variable=self.output_mode, value="mirror",
                        command=self._on_mode_change).pack(side="left", padx=5)

        ttk.Label(settings, text="Output Folder:").grid(row=3, column=0, padx=5, pady=5, sticky="w")
        self.output_entry = ttk.Entry(settings, state="disabled")
        self.output_entry.grid(row=3, column=1, padx=5, pady=5, sticky="ew")
        self.output_browse_btn = ttk.Button(settings, text=" 📁 Browse ", command=self._browse_output, state="disabled")
        self.output_browse_btn.grid(row=3, column=2, padx=5, pady=5)

        options = ttk.Frame(settings)
        options.grid(row=4, column=0, columnspan=3, padx=5, pady=5, sticky="w")

        self.overwrite_var = tk.BooleanVar(value=False)
        ttk.Checkbutton(options, text="Overwrite existing .md",
                        variable=self.overwrite_var).pack(side="left", padx=(0, 15))

        self.images_var = tk.BooleanVar(value=False)
        ttk.Checkbutton(options, text="Extract images",
                        variable=self.images_var).pack(side="left", padx=(0, 15))

        ttk.Label(options, text="Min text chars per page:").pack(side="left", padx=(0, 5))
        self.min_chars_var = tk.IntVar(value=20)
        ttk.Spinbox(options, from_=1, to=500, increment=5, width=6,
                    textvariable=self.min_chars_var).pack(side="left")

        ttk.Label(settings,
                  text="💡 Runs fully offline (PyMuPDF). Scanned PDFs with no text layer are skipped - OCR them first.",
                  font=("Segoe UI", 8, "italic"), foreground=COLOR_TEXT_MUTED
                  ).grid(row=5, column=0, columnspan=3, padx=5, pady=(0, 5), sticky="w")

        # --- Actions ---
        actions = ttk.Frame(self)
        actions.grid(row=1, column=0, sticky="ew", padx=10, pady=5)

        self.scan_btn = ttk.Button(actions, text=" 🔍 SCAN FOR PDFs ", command=self._start_scan)
        self.scan_btn.pack(side="left", padx=5)

        self.convert_btn = ttk.Button(actions, text=" ⚡ CONVERT ALL ", command=self._convert_all, state="disabled")
        self.convert_btn.pack(side="left", padx=5)

        self.convert_sel_btn = ttk.Button(actions, text=" ✅ CONVERT SELECTED ", command=self._convert_selected, state="disabled")
        self.convert_sel_btn.pack(side="left", padx=5)

        self.stop_btn = ttk.Button(actions, text=" ⏹ STOP ", command=self._stop, state="disabled")
        self.stop_btn.pack(side="left", padx=5)

        self.open_btn = ttk.Button(actions, text=" 📂 OPEN OUTPUT ", command=self._open_output, state="disabled")
        self.open_btn.pack(side="left", padx=5)

        self.status_label = ttk.Label(actions, text="Select a folder to begin.", foreground=COLOR_TEXT_MUTED)
        self.status_label.pack(side="left", padx=20)

        # --- Results ---
        results = ttk.LabelFrame(self, text=" 📋 FILES ")
        results.grid(row=2, column=0, sticky="nsew", padx=10, pady=5)
        results.grid_columnconfigure(0, weight=1)
        results.grid_rowconfigure(0, weight=1)

        columns = ("Status", "Details")
        self.tree = ttk.Treeview(results, columns=columns, show="tree headings")
        self.tree.heading("#0", text=" PDF (relative path) ", anchor="w")
        self.tree.heading("Status", text=" Status ", anchor="w")
        self.tree.heading("Details", text=" Details ", anchor="w")
        self.tree.column("#0", width=420)
        self.tree.column("Status", width=180, stretch=False)
        self.tree.column("Details", width=340)
        self.tree.grid(row=0, column=0, sticky="nsew", padx=(5, 0), pady=5)

        vsb = ttk.Scrollbar(results, orient="vertical", command=self.tree.yview)
        vsb.grid(row=0, column=1, sticky="ns", pady=5)
        hsb = ttk.Scrollbar(results, orient="horizontal", command=self.tree.xview)
        hsb.grid(row=1, column=0, sticky="ew", padx=(5, 0))
        self.tree.configure(yscrollcommand=vsb.set, xscrollcommand=hsb.set)

        for status, color in STATUS_COLORS.items():
            self.tree.tag_configure(status, foreground=color)

        self.tree.bind("<Double-1>", self._on_tree_double_click)
        self.tree.bind("<<TreeviewSelect>>", self._on_tree_select)

        # --- Progress ---
        ttk.Style().configure("PdfToMd.Horizontal.TProgressbar",
                              background=COLOR_PRIMARY,
                              troughcolor=COLOR_BG_SURFACE,
                              bordercolor=COLOR_BORDER,
                              lightcolor=COLOR_PRIMARY,
                              darkcolor=COLOR_PRIMARY)
        self.progress = ttk.Progressbar(self, mode="determinate",
                                        style="PdfToMd.Horizontal.TProgressbar")
        self.progress.grid(row=3, column=0, sticky="ew", padx=10, pady=(0, 10))

        if not converter.LIBS_AVAILABLE:
            self.status_label.config(text=converter.MISSING_LIBS_MESSAGE, foreground="#ff5555")
            self.scan_btn.config(state="disabled")

    def _load_saved_paths(self):
        if not self.config_manager:
            return
        source = self.config_manager.get_pdf_folder()
        if source:
            self.source_entry.insert(0, source)
        output = self.config_manager.get_pdf_output_folder()
        if output:
            self.output_entry.config(state="normal")
            self.output_entry.insert(0, output)
            if self.output_mode.get() != "mirror":
                self.output_entry.config(state="disabled")
        saved_filter = self.config_manager.get_pdf_filter()
        if saved_filter:
            self.filter_entry.insert(0, saved_filter)

    # -- Helpers --

    def _log(self, message, tag=None):
        if self.log_callback:
            self.log_callback(message, tag)

    def _on_mode_change(self):
        enabled = self.output_mode.get() == "mirror"
        self.output_entry.config(state="normal" if enabled else "disabled")
        self.output_browse_btn.config(state="normal" if enabled else "disabled")

    def _browse_source(self):
        initial = self.source_entry.get().strip() or os.getcwd()
        path = filedialog.askdirectory(title="Select folder containing PDFs", initialdir=initial)
        if path:
            self.source_entry.delete(0, "end")
            self.source_entry.insert(0, path)

    def _browse_output(self):
        initial = self.output_entry.get().strip() or self.source_entry.get().strip() or os.getcwd()
        path = filedialog.askdirectory(title="Select markdown output folder", initialdir=initial)
        if path:
            self.output_entry.delete(0, "end")
            self.output_entry.insert(0, path)

    def _resolve_output_root(self):
        """Returns the mirror output root, or None when writing beside each PDF."""
        if self.output_mode.get() != "mirror":
            return None
        path = self.output_entry.get().strip()
        return path or None

    def _set_busy(self, busy):
        self.busy = busy
        self.scan_btn.config(state="disabled" if busy else "normal")
        self.convert_btn.config(state="normal" if (not busy and self.pdf_paths) else "disabled")
        self.stop_btn.config(state="normal" if busy else "disabled")
        self._refresh_selection_state()

    def _refresh_selection_state(self):
        """Convert Selected is live only when idle with rows highlighted."""
        has_selection = bool(self.tree.selection())
        self.convert_sel_btn.config(state="normal" if (has_selection and not self.busy) else "disabled")

    def _on_tree_select(self, event=None):
        self._refresh_selection_state()

    # -- Filter --

    def _on_filter_change(self, event=None):
        """Re-filters the already-scanned list live, without touching the disk."""
        if self.config_manager:
            self.config_manager.set_pdf_filter(self.filter_entry.get().strip())
        if self.all_pdf_paths:
            self._apply_filter()

    def _apply_filter(self):
        """Rebuilds the tree from the cached scan, keeping only matching PDFs."""
        patterns = converter.parse_filter(self.filter_entry.get().strip())

        self.tree.delete(*self.tree.get_children())
        self.pdf_paths = [
            path for path in self.all_pdf_paths
            if converter.matches_filter(path, self.source_dir, patterns)
        ]

        for path in self.pdf_paths:
            rel = os.path.relpath(path, self.source_dir)
            status, detail = self.row_state.get(path, ("Pending", ""))
            tags = (status,) if status in STATUS_COLORS else ()
            self.tree.insert("", "end", iid=path, text=rel, values=(status, detail), tags=tags)

        self.progress.config(maximum=max(len(self.pdf_paths), 1), value=0)
        self._set_busy(False)

        total, shown = len(self.all_pdf_paths), len(self.pdf_paths)
        if not total:
            self.status_label.config(text="No PDF files found in that folder.", foreground=COLOR_TEXT_MUTED)
        elif shown == total:
            self.status_label.config(text=f"{shown} PDF file(s). Ready to convert.", foreground=COLOR_PRIMARY)
        else:
            self.status_label.config(text=f"{shown} of {total} PDF(s) match the filter.", foreground=COLOR_PRIMARY)

    # -- Scan --

    def _start_scan(self):
        source = self.source_entry.get().strip()
        if not source or not os.path.isdir(source):
            messagebox.showwarning("No Folder", "Please choose an existing folder that contains PDF files.")
            return

        self.source_dir = source
        if self.config_manager:
            self.config_manager.set_pdf_folder(source)

        self.tree.delete(*self.tree.get_children())
        self.pdf_paths = []
        self.all_pdf_paths = []
        self.row_state = {}
        self.progress.config(value=0, maximum=100)
        self.status_label.config(text="Scanning for PDFs...", foreground=COLOR_TEXT_MUTED)
        self._set_busy(True)
        self.stop_btn.config(state="disabled")

        threading.Thread(target=self._scan_thread, args=(source,), daemon=True).start()

    def _scan_thread(self, source):
        try:
            # Collect everything, then filter in _apply_filter so the filter can
            # be re-tuned afterwards without walking the disk again.
            paths = converter.find_pdfs(source)
        except Exception as e:
            self.after(0, lambda: self._finish_error(f"Scan failed: {e}"))
            return
        self.after(0, lambda: self._scan_done(paths))

    def _scan_done(self, paths):
        self.all_pdf_paths = paths
        self._apply_filter()
        self._log(f"📄 PDF to MD: found {len(paths)} PDF(s) under {self.source_dir}, "
                  f"{len(self.pdf_paths)} match the filter", "header")

    # -- Convert --

    def _convert_all(self):
        self._start_convert(self.pdf_paths)

    def _convert_selected(self):
        # Tree item ids are the PDF paths, so the selection is already a path list.
        selected = [path for path in self.tree.selection() if path in self.pdf_paths]
        if not selected:
            messagebox.showinfo("Nothing Selected", "Highlight one or more rows in the list first.")
            return
        self._start_convert(selected)

    def _start_convert(self, paths):
        if not paths:
            return

        output_root = self._resolve_output_root()
        if self.output_mode.get() == "mirror" and not output_root:
            messagebox.showwarning("No Output Folder", "Please choose an output folder, or switch back to 'Next to each PDF'.")
            return
        if output_root and self.config_manager:
            self.config_manager.set_pdf_output_folder(output_root)

        paths = list(paths)
        for path in paths:
            self.row_state.pop(path, None)
            if self.tree.exists(path):
                self.tree.item(path, values=("Pending", ""), tags=())

        self.cancel_event.clear()
        self.progress.config(maximum=len(paths), value=0)
        self.status_label.config(text=f"Converting {len(paths)} file(s)...", foreground=COLOR_TEXT_MUTED)
        self._set_busy(True)
        self.open_btn.config(state="disabled")

        self.worker = threading.Thread(
            target=self._convert_thread,
            args=(self.source_dir, paths, output_root,
                  self.overwrite_var.get(), self.images_var.get(), self.min_chars_var.get()),
            daemon=True,
        )
        self.worker.start()

    def _convert_thread(self, source_root, paths, output_root, overwrite, write_images, min_chars):
        def on_progress(index, total, pdf_path, status, detail):
            self.after(0, lambda: self._update_row(index, pdf_path, status, detail))

        try:
            summary = converter.convert_folder(
                source_root, paths,
                output_root=output_root,
                overwrite=overwrite,
                write_images=write_images,
                min_chars_per_page=min_chars,
                progress_callback=on_progress,
                cancel_event=self.cancel_event,
            )
        except Exception as e:
            self.after(0, lambda: self._finish_error(f"Conversion failed: {e}"))
            return

        self.after(0, lambda: self._convert_done(summary, output_root))

    def _update_row(self, index, pdf_path, status, detail):
        self.row_state[pdf_path] = (status, detail)
        if self.tree.exists(pdf_path):
            self.tree.item(pdf_path, values=(status, detail), tags=(status,))
            self.tree.see(pdf_path)
        self.progress.config(value=index)

    def _convert_done(self, summary, output_root):
        self._set_busy(False)
        self.open_btn.config(state="normal")
        self.last_output_root = output_root

        parts = [
            f"{summary[STATUS_CONVERTED]} converted",
            f"{summary[STATUS_NO_TEXT]} no-text",
            f"{summary[STATUS_EXISTS]} existing",
            f"{summary[STATUS_ENCRYPTED]} locked",
            f"{summary[STATUS_ERROR]} errors",
        ]
        text = ("Cancelled - " if summary["cancelled"] else "Done - ") + " · ".join(parts)
        self.status_label.config(text=text, foreground=COLOR_PRIMARY)
        self._log(f"📄 PDF to MD: {text}", "header")

    def _finish_error(self, message):
        self._set_busy(False)
        self.status_label.config(text=message, foreground="#ff5555")
        messagebox.showerror("PDF to MD", message)

    def _stop(self):
        self.cancel_event.set()
        self.status_label.config(text="Stopping after the current file...", foreground=COLOR_TEXT_MUTED)

    # -- Output --

    def _open_path(self, path):
        try:
            if os.name == 'nt':
                os.startfile(path)
            elif os.uname().sysname == 'Darwin':
                subprocess.run(['open', path], check=True)
            else:
                subprocess.run(['xdg-open', path], check=True)
        except Exception as e:
            self._log(f"❌ Error opening {path}: {e}", "header")

    def _open_output(self):
        target = getattr(self, "last_output_root", None) or self.source_dir
        if target and os.path.isdir(target):
            self._open_path(target)
        else:
            self.status_label.config(text="No output folder to open yet.", foreground=COLOR_TEXT_MUTED)

    def _on_tree_double_click(self, event):
        selected = self.tree.selection()
        if not selected:
            return
        pdf_path = selected[0]
        md_path = converter.markdown_path_for(pdf_path, self.source_dir, getattr(self, "last_output_root", None))
        if os.path.exists(md_path):
            self._open_path(md_path)
        else:
            self._open_path(pdf_path)
