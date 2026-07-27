# src/tabs/file_types_tab.py

import tkinter as tk
from tkinter import ttk, messagebox
import os
import threading
from ..config_manager import ConfigManager
from ..styles import *
from ..utils_module import GitIgnoreMatcher

class FileTypesTab(ttk.Frame):
    def __init__(self, parent, start_crawl_callback):
        super().__init__(parent)
        self.start_crawl_callback = start_crawl_callback
        self.target_directory = None
        self.extension_vars = {}
        self.config_manager = ConfigManager()
        self.column_exts = {} # Map column name to list of extensions
        self.sizes_dict = {}
        self.non_ignored_counts = {}
        self.total_counts = {}
        self.has_ignored_files = {} # ext -> bool
        self.category_frames = []
        self._last_cols = -1
        
        self.categories = {
            "Compiler Caches": {'.o', '.pyc', '.d', '.rmeta'},
            "Runtime & Index": {'.log', '.tag'},
            "Backups": {'.old', '.tmp', '.bak'},
            "Libraries": {'.rlib', '.a', '.so', '.lib', '.dll', '.dylib', '.whl'},
            "Binaries": {'.exe', '.bin', '.msi', '.dmg', '.pkg', '.iso', '.out', '.elf', '.apk'},
            "Programming": {'.py', '.rs', '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp', '.ipp', '.js', '.sh', '.bat', 
                            '.java', '.cs', '.rb', '.go', '.php', '.swift', '.kt', '.kts', '.ps1'},
            "Data & Config": {'.json', '.jsonl', '.yaml', '.yml', '.toml', '.ini', '.csv', '.proto', 
                              '.xml', '.env', '.sql', '.db', '.sqlite', '.sqlite3', '.mdb', '.accdb', '.dat'},
            "Web & Markup": {'.html', '.htm', '.svg', '.css', '.jsx', '.ts', '.tsx', '.vue'},
            "Build & Infra": {'.cmake', '.lock', '.in', '.nsi', '.desktop', '.sln', '.csproject'},
            "Docs": {'.md', '.txt', '.pdf', '.rst', '.rtf'},
            "Media": {'.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp'},
            "Misc": {'.zip', '.mib', '.expr', '.shw', '.2'}
        }
        
        self._setup_styles()
        self._setup_ui()

    def _setup_styles(self):
        style = ttk.Style()
        
        # Threshold colors
        self.COLORS = {
            "RED": "#FF5555",
            "ORANGE": "#FFB86C",
            "YELLOW": "#F1FA8C",
            "GREEN": "#50FA7B"
        }

        # Define styles for Checkbuttons
        for name, color in self.COLORS.items():
            style.configure(f"{name}.TCheckbutton", foreground=color)
            # Define styles for Buttons
            style.configure(f"{name}.TButton", foreground=color)
        
        # Special style for flagged (ignored files present)
        style.configure("FLAGGED.TCheckbutton", foreground="#FF5555", font=("Segoe UI", 9, "bold"))

    def _get_size_style(self, size_bytes):
        """Returns the color prefix for the style based on size."""
        size_mb = size_bytes / (1024 * 1024)
        if size_mb >= 100: return "RED"
        if size_mb >= 50:  return "ORANGE" # Coaxial with 75MB instruction
        if size_mb >= 10:  return "YELLOW"
        return "GREEN"

    def _setup_ui(self):
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=1)

        # Top info
        self.info_label = ttk.Label(self, text="No folder selected.", font=("Segoe UI", 10, "bold"), foreground=COLOR_PRIMARY)
        self.info_label.grid(row=0, column=0, pady=15, padx=20, sticky="w")

        # Container for checkboxes
        self.check_frame = ttk.LabelFrame(self, text=" DISCOVERED FILE TYPES ")
        self.check_frame.grid(row=1, column=0, sticky="nsew", padx=15, pady=5)
        
        # Canvas for scrolling
        self.canvas = tk.Canvas(self.check_frame, bg=COLOR_BG_SURFACE, highlightthickness=0)
        self.scrollbar = ttk.Scrollbar(self.check_frame, orient="vertical", command=self.canvas.yview)
        self.scrollable_frame = ttk.Frame(self.canvas)

        self.scrollable_frame.bind(
            "<Configure>",
            lambda e: self.canvas.configure(
                scrollregion=self.canvas.bbox("all")
            )
        )

        self.canvas.create_window((0, 0), window=self.scrollable_frame, anchor="nw")
        self.canvas.configure(yscrollcommand=self.scrollbar.set)

        self.canvas.pack(side="left", fill="both", expand=True, padx=5, pady=5)
        self.scrollbar.pack(side="right", fill="y")
        
        # Bind resize for fluid layout
        self.canvas.bind("<Configure>", self._relayout)

        # Action Buttons
        btn_frame = ttk.Frame(self)
        btn_frame.grid(row=2, column=0, pady=15, sticky="ew")
        
        self.scan_btn = ttk.Button(btn_frame, text=" 🔄 RE-SCAN ", command=self._scan_extensions)
        self.scan_btn.pack(side="left", padx=20)

        self.select_all_btn = ttk.Button(btn_frame, text=" SELECT ALL ", command=self._select_all)
        self.select_all_btn.pack(side="left", padx=5)

        self.select_git_ignore_btn = ttk.Button(btn_frame, text=" SELECT ALL - GIT IGNORE ", command=self._select_git_ignore)
        self.select_git_ignore_btn.pack(side="left", padx=5)

        self.deselect_all_btn = ttk.Button(btn_frame, text=" DESELECT ALL ", command=self._deselect_all)
        self.deselect_all_btn.pack(side="left", padx=5)

        # Respect .gitignore Checkbox
        self.respect_gitignore_var = tk.BooleanVar(value=True)
        self.git_chk = ttk.Checkbutton(btn_frame, text=" RESPECT .GITIGNORE ", variable=self.respect_gitignore_var, command=self._scan_extensions)
        self.git_chk.pack(side="left", padx=20)

        # Zip Checkbox
        self.make_zip_var = tk.BooleanVar(value=self.config_manager.get_make_zip())
        self.zip_chk = ttk.Checkbutton(btn_frame, text=" ZIP OUTPUT ", variable=self.make_zip_var)
        self.zip_chk.pack(side="right", padx=20)

        # Accent Start Crawl Button
        self.crawl_btn = ttk.Button(btn_frame, text=" 🚀 START CRAWL ", command=self._on_crawl_click, state="disabled")
        self.crawl_btn.pack(side="right", padx=5)

    def update_directory(self, path):
        self.target_directory = path
        self.info_label.config(text=f" 📂 TARGET: {path}")
        self.crawl_btn.config(state="normal")
        # Auto scan
        self._scan_extensions()

    def _scan_extensions(self):
        if not self.target_directory: return
        threading.Thread(target=self._scan_thread, daemon=True).start()

    def _scan_thread(self):
        extensions = {} # ext -> total count
        non_ignored_exts = {} # ext -> non-ignored count
        sizes = {}      # ext -> total_size_bytes (non-ignored only if respecting)
        has_ignored = {} # ext -> bool
        
        respect_git = self.respect_gitignore_var.get()
        matcher = GitIgnoreMatcher(self.target_directory)
        
        try:
            for root, dirs, files in os.walk(self.target_directory):
                # Always ignore .git and .crawler
                if '.git' in dirs: dirs.remove('.git')
                if '.crawler' in dirs: dirs.remove('.crawler')
                
                # Also ignore folders from .gitignore if respecting
                if respect_git:
                    dirs_to_remove = []
                    for d in dirs:
                        if matcher.is_ignored(os.path.join(root, d)):
                            dirs_to_remove.append(d)
                    for d in dirs_to_remove:
                        dirs.remove(d)
                
                for f in files:
                    file_path = os.path.join(root, f)
                    _, ext = os.path.splitext(f)
                    if not ext: continue
                    
                    ext_lower = ext.lower()
                    extensions[ext_lower] = extensions.get(ext_lower, 0) + 1
                    
                    is_ignored = matcher.is_ignored(file_path)
                    if is_ignored:
                        has_ignored[ext_lower] = True
                    
                    if not respect_git or not is_ignored:
                        non_ignored_exts[ext_lower] = non_ignored_exts.get(ext_lower, 0) + 1
                        try:
                            sizes[ext_lower] = sizes.get(ext_lower, 0) + os.path.getsize(file_path)
                        except OSError:
                            pass
                    else:
                        if ext_lower not in non_ignored_exts:
                            non_ignored_exts[ext_lower] = 0
                            
        except Exception as e:
            print(f"Error scanning: {e}")

        self.after(0, lambda: self._populate_checkboxes(extensions, non_ignored_exts, sizes, has_ignored))

    def _format_size(self, size_bytes):
        """Formats bytes into MB or GB depending on magnitude."""
        size_mb = size_bytes / (1024 * 1024)
        if size_mb >= 1000:
            return f"{size_mb / 1024:.2f}GB"
        return f"{size_mb:.2f}MB"

    def _populate_checkboxes(self, extensions_dict, non_ignored_dict, sizes_dict, has_ignored_dict):
        # Clear old
        for widget in self.scrollable_frame.winfo_children():
            widget.destroy()
        self.extension_vars.clear()
        self.column_exts.clear()
        self.column_buttons = {}
        self.sizes_dict = sizes_dict
        self.total_counts = extensions_dict
        self.non_ignored_counts = non_ignored_dict
        self.has_ignored_files = has_ignored_dict
        self.category_frames = []
        self._last_cols = -1 # Force relayout

        # Load saved selection
        saved_exts = self.config_manager.get_selected_extensions()
        
        # Default checked
        default_checked = self.categories["Programming"].union(
            self.categories["Data & Config"]
        ).union(
            self.categories["Web & Markup"]
        ).union(
            self.categories["Build & Infra"]
        ).union(
            self.categories["Docs"]
        )

        # Categorize
        categorized_exts = {cat: [] for cat in self.categories.keys()}
        categorized_exts["Other"] = []

        for ext in extensions_dict.keys():
            found = False
            for cat, known_exts in self.categories.items():
                if ext in known_exts:
                    categorized_exts[cat].append(ext)
                    found = True
                    break
            if not found:
                categorized_exts["Other"].append(ext)

        self.column_exts = categorized_exts

        # Setup Columns
        columns = list(self.categories.keys()) + ["Other"]
        
        for col_name in columns:
            cat_frame = ttk.Frame(self.scrollable_frame)
            self.category_frames.append(cat_frame)
            
            # Column Header
            header = ttk.Label(cat_frame, text=col_name.upper(), font=("Segoe UI", 10, "bold"), foreground=COLOR_PRIMARY)
            header.grid(row=0, column=0, sticky="nw", padx=10, pady=(10, 5))

            # Select/Deselect Button
            btn = ttk.Button(cat_frame, width=20)
            btn.config(command=lambda b=btn, c=col_name: self._toggle_column(b, c))
            btn.grid(row=1, column=0, sticky="w", padx=10, pady=(0, 15))
            self.column_buttons[col_name] = btn

            # Items
            exts_in_col = sorted(categorized_exts[col_name])
            for i, ext in enumerate(exts_in_col):
                if saved_exts:
                    is_checked = ext in saved_exts
                else:
                    is_checked = ext in default_checked and non_ignored_dict.get(ext, 0) > 0
                
                total_count = extensions_dict[ext]
                ni_count = non_ignored_dict.get(ext, 0)
                raw_size = sizes_dict.get(ext, 0)
                size_str = self._format_size(raw_size)
                
                is_flagged = has_ignored_dict.get(ext, False)
                style_prefix = "FLAGGED" if is_flagged else self._get_size_style(raw_size)
                
                flag = "🚩 " if is_flagged else ""
                if ni_count == total_count:
                    label_text = f"{flag}{ext} ({total_count}) [{size_str}]"
                else:
                    label_text = f"{flag}{ext} ({ni_count}/{total_count}) [{size_str}]"
                    
                var = tk.BooleanVar(value=is_checked)
                chk = ttk.Checkbutton(cat_frame, text=label_text, variable=var, style=f"{style_prefix}.TCheckbutton")
                chk.grid(row=i+2, column=0, sticky="w", padx=10, pady=2)
                self.extension_vars[ext] = var
                
                # Update button text if state changes manually
                var.trace_add("write", lambda *args, c=col_name: self._sync_column_button(c))

            # Initial sync for button text
            self._sync_column_button(col_name)

        self._relayout()

    def _relayout(self, event=None):
        width = self.canvas.winfo_width()
        if width <= 1: return
        
        col_w = 220 
        cols = max(1, width // col_w)
        
        if self._last_cols == cols:
            return
        self._last_cols = cols
        
        for i, frame in enumerate(self.category_frames):
            r = i // cols
            c = i % cols
            frame.grid(row=r, column=c, sticky="nw", padx=5, pady=5)
            
        for c in range(cols):
            self.scrollable_frame.grid_columnconfigure(c, weight=1, minsize=180)

    def _sync_column_button(self, col_name):
        if not hasattr(self, 'column_buttons') or col_name not in self.column_buttons:
            return
        exts = self.column_exts.get(col_name, [])
        if not exts: 
            self.column_buttons[col_name].config(text="SELECT [0.00MB]", state="disabled", style="TButton")
            return
            
        all_selected = all(self.extension_vars[ext].get() for ext in exts if ext in self.extension_vars)
        total_size = sum(self.sizes_dict.get(ext, 0) for ext in exts)
        size_str = self._format_size(total_size)
        style_prefix = self._get_size_style(total_size)
        
        prefix = "DESELECT" if all_selected else "SELECT"
        self.column_buttons[col_name].config(
            text=f"{prefix} [{size_str}]", 
            state="normal", 
            style=f"{style_prefix}.TButton"
        )

    def _toggle_column(self, btn, col_name):
        exts = self.column_exts.get(col_name, [])
        if not exts: return
        
        all_selected = all(self.extension_vars[ext].get() for ext in exts if ext in self.extension_vars)
        target_state = not all_selected
        
        for ext in exts:
            if ext in self.extension_vars:
                self.extension_vars[ext].set(target_state)
        
        self._sync_column_button(col_name)

    def _select_all(self):
        for var in self.extension_vars.values():
            var.set(True)

    def _select_git_ignore(self):
        for ext, var in self.extension_vars.items():
            if self.non_ignored_counts.get(ext, 0) > 0:
                var.set(True)
            else:
                var.set(False)

    def _deselect_all(self):
        for var in self.extension_vars.values():
            var.set(False)

    def _on_crawl_click(self):
        if not self.target_directory: return
        
        selected_exts = [ext for ext, var in self.extension_vars.items() if var.get()]
        if not selected_exts:
            messagebox.showwarning("No types", "Please select at least one file type to crawl.")
            return

        # Save preferences
        self.config_manager.set_selected_extensions(selected_exts)
        self.config_manager.set_make_zip(self.make_zip_var.get())

        self.start_crawl_callback(
            self.target_directory, 
            selected_exts, 
            self.make_zip_var.get(),
            self.respect_gitignore_var.get()
        )
