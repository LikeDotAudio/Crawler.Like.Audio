# src/tabs/WebCrawler/parser.py
import os
from markdownify import markdownify
import threading

class Parser:
    def __init__(self, log_callback, md_queue, add_file_to_tree_callback):
        self.log_callback = log_callback
        self.md_queue = md_queue
        self.add_file_to_tree_callback = add_file_to_tree_callback

    def start_worker(self, output_dir_md):
        self.log_callback("Markdown worker started", "header")
        thread = threading.Thread(target=self._markdown_worker, args=(output_dir_md,), daemon=True)
        thread.start()
        return thread

    def _markdown_worker(self, output_dir_md):
        while True:
            item = self.md_queue.get()
            if item is None: 
                self.md_queue.task_done()
                break
            
            html_content, relative_path = item
            
            md_path = os.path.splitext(relative_path)[0] + '.md'
            filepath = os.path.join(output_dir_md, md_path)
            
            os.makedirs(os.path.dirname(filepath), exist_ok=True)
            
            try:
                md_content = markdownify(html_content, heading_style="ATX")
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(md_content.strip())
                self.log_callback(f"Saved MD: {filepath}", "file")
                self.add_file_to_tree_callback(filepath)
            except Exception as e:
                self.log_callback(f"Error converting MD for {filepath}: {e}", "file")
                
            self.md_queue.task_done()
        self.log_callback("Markdown worker finished", "header")
