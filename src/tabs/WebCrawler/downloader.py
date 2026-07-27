# src/tabs/WebCrawler/downloader.py
import threading
import os
import requests
import queue
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import logging

class Downloader:
    def __init__(self, log_callback, md_queue, url_queue, visited_urls, add_file_to_tree_callback):
        self.log_callback = log_callback
        self.md_queue = md_queue
        self.url_queue = url_queue
        self.visited_urls = visited_urls
        self.add_file_to_tree_callback = add_file_to_tree_callback
        self.current_output_dir = None

    def start_crawl(self, initial_url, scrape_media_flag):
        self.log_callback(f"Starting crawl for: {initial_url}", "header")
        threading.Thread(target=self._run_crawler, args=(initial_url, scrape_media_flag), daemon=True).start()

    def _run_crawler(self, initial_url, scrape_media_flag):
        self.visited_urls.clear()
        
        parsed_initial_url = urlparse(initial_url)
        folder_name = "crawl-" + parsed_initial_url.netloc.replace('.', '-')
        
        project_root = os.getcwd()
        master_folder = os.path.join(project_root, "scrapes")
        
        html_dir = os.path.join(master_folder, folder_name)
        md_dir = os.path.join(master_folder, folder_name + "-MD")
        media_dir = os.path.join(master_folder, folder_name + "-MEDIA")
        
        try:
            os.makedirs(html_dir, exist_ok=True)
            os.makedirs(md_dir, exist_ok=True)
            if scrape_media_flag: os.makedirs(media_dir, exist_ok=True)
            self.log_callback(f"Created: {html_dir}", "header")
        except Exception as e:
            self.log_callback(f"Error creating directories: {e}", "header")
            return
        
        self.current_output_dir = html_dir
        self.log_callback(f"HTML Output: {self.current_output_dir}", "header")
        
        # The markdown worker will be in another class/file.
        # Let's assume the calling code starts it.
        
        self.url_queue.put((initial_url, f"{parsed_initial_url.scheme}://{parsed_initial_url.netloc}"))
        
        self.log_callback("Crawl in progress...", "header")
        
        threading.Thread(target=self._crawl_loop, args=(html_dir, scrape_media_flag, media_dir), daemon=True).start()

    def _crawl_loop(self, html_dir, scrape_media_flag, media_dir):
        self.log_callback("Crawl loop started", "header")
        while not self.url_queue.empty():
            item = self.url_queue.get()
            if item is None:
                break
            
            url, base_url = item
            self._download_page(url, base_url, html_dir, scrape_media_flag, media_dir)
            self.url_queue.task_done()

        self.log_callback("[Main Thread] Scraping finished. Waiting for Markdown converter...", "header")
        self.md_queue.put(None) # Signal to markdown converter to finish

    def _download_page(self, url, base_url, html_dir, scrape_media_flag, media_dir):
        try:
            self.log_callback(f"Downloading: {url}", "file")
            headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()

            parsed = urlparse(url)
            rel_path = parsed.path.lstrip('/')
            if not rel_path or rel_path.endswith('/'):
                rel_path = os.path.join(rel_path, 'index.html')
            
            filepath = os.path.join(html_dir, rel_path)
            os.makedirs(os.path.dirname(filepath), exist_ok=True)
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(response.text)
            
            self.md_queue.put((response.text, rel_path))

            soup = BeautifulSoup(response.text, 'html.parser')
            links = soup.find_all('a', href=True)
            self.log_callback(f"Found {len(links)} links on {url}", "file")

            for link in links:
                next_url = urljoin(url, link['href']).split('#')[0]
                if urlparse(next_url).netloc == parsed.netloc and next_url not in self.visited_urls:
                    self.visited_urls.add(next_url)
                    self.url_queue.put((next_url, base_url))
                    self.log_callback(f"Queueing: {next_url}", "file")

        except Exception as e:
            self.log_callback(f"Error on {url}: {e}", "header")

