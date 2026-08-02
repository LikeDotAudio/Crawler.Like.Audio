# src/tabs/json_to_csv_tab.py

import json
import csv
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import os
from ..styles import *

class JsonToCsvTab(ttk.Frame):
    def __init__(self, parent):
        super().__init__(parent)
        self.json_filepath = ""
        self.setup_ui()

    def setup_ui(self):
        self.top_frame = tk.Frame(self, padx=10, pady=10, bg=COLOR_BG_APP)
        self.top_frame.pack(fill=tk.X)

        tk.Label(self.top_frame, text="Input JSON File:", bg=COLOR_BG_APP, fg=COLOR_TEXT_MAIN).grid(row=0, column=0, sticky="W", padx=5, pady=2)
        self.json_path_entry = tk.Entry(self.top_frame, width=50, bg=COLOR_BG_SURFACE, fg=COLOR_TEXT_MAIN, insertbackground=COLOR_TEXT_MAIN)
        self.json_path_entry.grid(row=0, column=1, padx=5, pady=2)
        self.json_browse_button = ttk.Button(self.top_frame, text="Browse...", command=self.load_json_file)
        self.json_browse_button.grid(row=0, column=2, padx=5, pady=2)

        tk.Label(self.top_frame, text="Output CSV File:", bg=COLOR_BG_APP, fg=COLOR_TEXT_MAIN).grid(row=1, column=0, sticky="W", padx=5, pady=2)
        self.csv_path_entry = tk.Entry(self.top_frame, width=50, bg=COLOR_BG_SURFACE, fg=COLOR_TEXT_MAIN, insertbackground=COLOR_TEXT_MAIN)
        self.csv_path_entry.grid(row=1, column=1, padx=5, pady=2)
        self.csv_browse_button = ttk.Button(self.top_frame, text="Browse...", command=self.save_csv_file)
        self.csv_browse_button.grid(row=1, column=2, padx=5, pady=2)

        self.flatten_arrays_var = tk.BooleanVar(value=True)
        self.flatten_check = tk.Checkbutton(self.top_frame, text="Expand Arrays into Repeating Rows", 
                                            variable=self.flatten_arrays_var, bg=COLOR_BG_APP, fg=COLOR_TEXT_MAIN, 
                                            selectcolor=COLOR_BG_SURFACE, activebackground=COLOR_BG_APP, activeforeground=COLOR_TEXT_MAIN)
        self.flatten_check.grid(row=2, column=0, columnspan=2, sticky="W", padx=5, pady=5)

        self.convert_button = ttk.Button(self.top_frame, text="Convert to CSV", command=self.convert_to_csv, style="Accent.TButton")
        self.convert_button.grid(row=3, column=1, pady=15)

    def load_json_file(self):
        filepath = filedialog.askopenfilename(defaultextension=".json", filetypes=[("JSON files", "*.json")])
        if filepath:
            self.json_path_entry.delete(0, tk.END)
            self.json_path_entry.insert(0, filepath)
            self.json_filepath = filepath
            default_csv_name = os.path.splitext(filepath)[0] + ".csv"
            self.csv_path_entry.delete(0, tk.END)
            self.csv_path_entry.insert(0, default_csv_name)

    def save_csv_file(self):
        filepath = filedialog.asksaveasfilename(defaultextension=".csv", filetypes=[("CSV files", "*.csv")])
        if filepath:
            self.csv_path_entry.delete(0, tk.END)
            self.csv_path_entry.insert(0, filepath)

    def flatten_dict(self, d, parent_key='', sep='.'):
        items = []
        for k, v in d.items():
            new_key = f"{parent_key}{sep}{k}" if parent_key else k
            if isinstance(v, dict) and v:
                items.extend(self.flatten_dict(v, new_key, sep=sep).items())
            else:
                items.append((new_key, v))
        return dict(items)

    def process_json(self, data):
        if isinstance(data, dict):
            keys = list(data.keys())
            if len(keys) == 1 and isinstance(data[keys[0]], list):
                data = data[keys[0]]
            else:
                data = [data]
        elif not isinstance(data, list):
            data = [data]

        if self.flatten_arrays_var.get():
            result = []
            def traverse(current_obj, base_row=None):
                if base_row is None:
                    base_row = {}
                row = dict(base_row)
                has_array = False
                array_key = ""
                array_items = []

                if isinstance(current_obj, dict):
                    for k, v in current_obj.items():
                        if isinstance(v, list) and not has_array:
                            has_array = True
                            array_key = k
                            array_items = v
                        else:
                            row[k] = v

                if has_array:
                    for item in array_items:
                        nested_base = dict(row)
                        if isinstance(item, dict):
                            traverse(item, nested_base)
                        else:
                            nested_base[array_key] = item
                            result.append(self.flatten_dict(nested_base))
                else:
                    result.append(self.flatten_dict(row))

            for item in data:
                traverse(item)
            return result
        else:
            return [self.flatten_dict(item) for item in data if isinstance(item, dict)]

    def convert_to_csv(self):
        in_path = self.json_path_entry.get()
        out_path = self.csv_path_entry.get()
        if not in_path or not out_path:
            messagebox.showerror("Error", "Please specify both input and output files.")
            return

        try:
            with open(in_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            processed = self.process_json(data)
            if not processed:
                messagebox.showinfo("Empty", "No data to convert.")
                return

            fieldnames = []
            for row in processed:
                for k in row.keys():
                    if k not in fieldnames:
                        fieldnames.append(k)
                        
            with open(out_path, 'w', encoding='utf-8', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(processed)
                
            messagebox.showinfo("Success", f"Converted successfully to {out_path}")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to convert: {str(e)}")
