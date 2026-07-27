# src/tabs/WebCrawler/view.py
import tkinter as tk
from tkinter import ttk
import os
from tkhtmlview import HTMLLabel
import markdown

# NOTE: This view requires the following packages:
# pip install tkhtmlview markdown

class ResultsView(ttk.Frame):
    def __init__(self, parent):
        super().__init__(parent)
        self.current_output_dir = None
        self._setup_ui()

    def _setup_ui(self):
        self.paned = ttk.PanedWindow(self, orient="horizontal")
        self.paned.pack(fill="both", expand=True, padx=10, pady=5)

        # Treeview (Left)
        self.tree_frame = ttk.LabelFrame(self.paned, text="Discovered Files")
        self.paned.add(self.tree_frame, weight=1)
        self.tree = ttk.Treeview(self.tree_frame, columns=("path"), show="tree")
        self.tree.pack(fill="both", expand=True)
        self.tree.bind("<<TreeviewSelect>>", self._on_tree_select)

        # Markdown Viewer (Right)
        self.viewer_frame = ttk.LabelFrame(self.paned, text="Markdown Preview")
        self.paned.add(self.viewer_frame, weight=3)
        self.md_viewer = HTMLLabel(self.viewer_frame, background="black", foreground="white")
        self.md_viewer.pack(fill="both", expand=True)

    def add_file_to_tree(self, file_path):
        self.after(0, lambda: self._update_tree_ui(file_path))

    def _on_tree_select(self, event):
        selection = self.tree.selection()
        if not selection: return
        file_path = self.tree.item(selection[0], "values")[0]
        if os.path.exists(file_path) and file_path.endswith('.md'):
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
            # Add some basic styling for the dark theme
            html = markdown.markdown(content, extensions=['fenced_code', 'codehilite'])
            styled_html = f"""
            <style>
                body {{
                    background-color: black;
                    color: white;
                    font-family: sans-serif;
                }}
                pre {{
                    background-color: #333;
                    color: #eee;
                    padding: 10px;
                    border-radius: 5px;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                }}
                code {{
                    font-family: monospace;
                }}
                h1, h2, h3, h4, h5, h6 {{
                    color: #4e9a06;
                }}
                a {{
                    color: #3465a4;
                }}
            </style>
            {html}
            """
            self.md_viewer.set_html(styled_html)
        else:
            self.md_viewer.set_html("")

    def _update_tree_ui(self, file_path):
        if self.current_output_dir:
            try:
                # To show a relative path from the *parent* of the output dir (e.g. scrapes/crawl-...)
                base_dir = os.path.dirname(self.current_output_dir)
                rel_path = os.path.relpath(file_path, base_dir)
            except ValueError:
                rel_path = os.path.basename(file_path)
        else:
            rel_path = os.path.basename(file_path)
            
        parts = rel_path.split(os.sep)
        
        parent = ""
        for i, part in enumerate(parts):
            node_id = os.sep.join(parts[:i+1])
            
            if not self.tree.exists(node_id):
                self.tree.insert(parent, "end", node_id, text=part, values=[file_path])
            
            parent = node_id
            
        self.tree.see(parent)
        self.tree.item(parent, open=True)
        
    def set_current_output_dir(self, directory):
        self.current_output_dir = directory
        
    def clear_tree(self):
        for item in self.tree.get_children():
            self.tree.delete(item)
