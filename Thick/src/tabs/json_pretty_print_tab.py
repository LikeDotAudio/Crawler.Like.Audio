# src/tabs/json_pretty_print_tab.py

import tkinter as tk
from tkinter import ttk, messagebox
import json
from ..styles import *
from ..utils_module import pretty_print_json

class JsonPrettyPrintTab(ttk.Frame):
    def __init__(self, parent):
        super().__init__(parent)
        self.setup_ui()

    def setup_ui(self):
        self.rowconfigure(1, weight=1)
        self.columnconfigure(0, weight=1)
        self.columnconfigure(1, weight=1)

        # Header
        header_frame = tk.Frame(self, bg=COLOR_BG_APP)
        header_frame.grid(row=0, column=0, columnspan=2, sticky="ew", padx=10, pady=10)
        
        tk.Label(header_frame, text="JSON Pretty Printer", font=("Segoe UI", 16, "bold"), bg=COLOR_BG_APP, fg=COLOR_PRIMARY).pack(side="left")
        ttk.Button(header_frame, text="Pretty Print", command=self.format_json, style="Accent.TButton").pack(side="right")

        # Input Area
        input_frame = tk.Frame(self, bg=COLOR_BG_APP)
        input_frame.grid(row=1, column=0, sticky="nsew", padx=10, pady=5)
        tk.Label(input_frame, text="Raw JSON Input:", bg=COLOR_BG_APP, fg=COLOR_TEXT_MAIN).pack(anchor="w")
        self.input_text = tk.Text(input_frame, bg=COLOR_BG_SURFACE, fg=COLOR_TEXT_MAIN, insertbackground=COLOR_TEXT_MAIN, wrap="none")
        self.input_text.pack(fill="both", expand=True)

        # Output Area
        output_frame = tk.Frame(self, bg=COLOR_BG_APP)
        output_frame.grid(row=1, column=1, sticky="nsew", padx=10, pady=5)
        
        out_header = tk.Frame(output_frame, bg=COLOR_BG_APP)
        out_header.pack(fill="x")
        tk.Label(out_header, text="Formatted Output:", bg=COLOR_BG_APP, fg=COLOR_TEXT_MAIN).pack(side="left")
        
        self.output_text = tk.Text(output_frame, bg=COLOR_BG_SURFACE, fg=COLOR_TEXT_MAIN, insertbackground=COLOR_TEXT_MAIN, wrap="none", state="normal")
        self.output_text.pack(fill="both", expand=True)

    def format_json(self):
        raw_text = self.input_text.get("1.0", tk.END).strip()
        if not raw_text:
            self.output_text.delete("1.0", tk.END)
            return

        formatted = pretty_print_json(raw_text)
        
        self.output_text.delete("1.0", tk.END)
        self.output_text.insert(tk.END, formatted)
        
        # Verify JSON validity for user feedback
        try:
            json.loads(raw_text)
        except json.JSONDecodeError as e:
            messagebox.showwarning("Warning", f"Invalid JSON input:\n{e}")
