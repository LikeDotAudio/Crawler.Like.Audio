# src/tabs/json_converter_tab.py

import json
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import os
import yaml
from ..styles import *

class JsonConverterTab(ttk.Frame):
    def __init__(self, parent):
        super().__init__(parent)
        self.setup_ui()

    def setup_ui(self):
        self.top_frame = tk.Frame(self, padx=10, pady=10, bg=COLOR_BG_APP)
        self.top_frame.pack(fill=tk.X)

        tk.Label(self.top_frame, text="Input JSON File:", bg=COLOR_BG_APP, fg=COLOR_TEXT_MAIN).grid(row=0, column=0, sticky="W", padx=5, pady=2)
        self.json_path_entry = tk.Entry(self.top_frame, width=50, bg=COLOR_BG_SURFACE, fg=COLOR_TEXT_MAIN, insertbackground=COLOR_TEXT_MAIN)
        self.json_path_entry.grid(row=0, column=1, padx=5, pady=2)
        self.json_browse_button = ttk.Button(self.top_frame, text="Browse...", command=self.load_json_file)
        self.json_browse_button.grid(row=0, column=2, padx=5, pady=2)
        
        self.format_var = tk.StringVar(value="yaml")
        tk.Radiobutton(self.top_frame, text="Convert to YAML", variable=self.format_var, value="yaml", bg=COLOR_BG_APP, fg=COLOR_TEXT_MAIN, selectcolor=COLOR_BG_SURFACE).grid(row=1, column=1, sticky="W", pady=5)
        tk.Radiobutton(self.top_frame, text="Convert to XML", variable=self.format_var, value="xml", bg=COLOR_BG_APP, fg=COLOR_TEXT_MAIN, selectcolor=COLOR_BG_SURFACE).grid(row=2, column=1, sticky="W")

        self.convert_button = ttk.Button(self.top_frame, text="Convert & Save", command=self.convert_file, style="Accent.TButton")
        self.convert_button.grid(row=3, column=1, pady=15)

    def load_json_file(self):
        filepath = filedialog.askopenfilename(defaultextension=".json", filetypes=[("JSON files", "*.json")])
        if filepath:
            self.json_path_entry.delete(0, tk.END)
            self.json_path_entry.insert(0, filepath)

    def dict_to_xml(self, tag, d):
        elem = f"<{tag}>"
        if isinstance(d, dict):
            for key, val in d.items():
                safe_key = str(key).replace(' ', '_')
                if safe_key and safe_key[0].isdigit():
                    safe_key = "_" + safe_key
                elem += self.dict_to_xml(safe_key, val)
        elif isinstance(d, list):
            for item in d:
                elem += self.dict_to_xml("item", item)
        else:
            elem += str(d)
        elem += f"</{tag}>"
        return elem

    def convert_file(self):
        in_path = self.json_path_entry.get()
        if not in_path or not os.path.exists(in_path):
            messagebox.showerror("Error", "Please select a valid input JSON file.")
            return

        fmt = self.format_var.get()
        out_path = filedialog.asksaveasfilename(defaultextension=f".{fmt}", filetypes=[(f"{fmt.upper()} files", f"*.{fmt}")])
        if not out_path:
            return

        try:
            with open(in_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            if fmt == "yaml":
                with open(out_path, 'w', encoding='utf-8') as f:
                    yaml.dump(data, f, default_flow_style=False, sort_keys=False)
            else:
                xml_str = '<?xml version="1.0" encoding="UTF-8" ?>\n'
                xml_str += self.dict_to_xml("root", data)
                with open(out_path, 'w', encoding='utf-8') as f:
                    f.write(xml_str)
                    
            messagebox.showinfo("Success", f"Converted successfully to {out_path}")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to convert: {str(e)}")
