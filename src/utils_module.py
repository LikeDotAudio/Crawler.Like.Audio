# src/utils_module.py

import inspect
import os
import fnmatch
import re

# --- Global Version Information ---
current_version = "Version 20260117.010000.1" # Updated date
current_version_hash = (20260117 * 10000 * 1)

def debug_log(message, file, version, function, **kwargs):
    # A simplified debug logging function for this script.
    print(f"DEBUG: {file} - {function} - {message} - Version: {version}")

class GitIgnoreMatcher:
    def __init__(self, root_dir):
        self.root_dir = os.path.abspath(root_dir)
        self.patterns = []
        self._load_gitignore()

    def _load_gitignore(self):
        gitignore_path = os.path.join(self.root_dir, '.gitignore')
        if not os.path.exists(gitignore_path):
            return

        try:
            with open(gitignore_path, 'r') as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith('#'):
                        continue
                    self.patterns.append(line)
        except Exception as e:
            print(f"Error loading .gitignore: {e}")

    def is_ignored(self, path):
        if not self.patterns:
            return False

        # Get path relative to root_dir
        abs_path = os.path.abspath(path)
        try:
            rel_path = os.path.relpath(abs_path, self.root_dir)
        except ValueError:
            return False # Different drive on Windows?

        if rel_path == '.':
            return False

        # Normalize to forward slashes for matching
        rel_path = rel_path.replace(os.sep, '/')
        
        # Check each pattern
        for pattern in self.patterns:
            if self._match_pattern(rel_path, pattern):
                return True
        return False

    def _match_pattern(self, rel_path, pattern):
        # Basic .gitignore matching logic
        
        # 1. Directory only patterns (ending with /)
        is_dir_pattern = pattern.endswith('/')
        clean_pattern = pattern.rstrip('/')
        
        # 2. Handle patterns starting with / (anchored to root)
        anchored = clean_pattern.startswith('/')
        if anchored:
            clean_pattern = clean_pattern[1:]

        # Normalize pattern for regex
        # Replace ** with a special marker to avoid fnmatch escaping it
        p = clean_pattern.replace('**/', '___DOUBLE_STAR_DIR___')
        p = p.replace('/**', '___DOUBLE_STAR_DIR___')
        p = p.replace('**', '___DOUBLE_STAR___')
        
        # Use fnmatch.translate on the rest
        regex_body = fnmatch.translate(p)
        # Remove the \Z(?ms) anchoring that fnmatch adds if we want partial matching
        # but for .gitignore, we usually want to match the whole path or a component
        
        regex_body = regex_body.replace('___DOUBLE_STAR_DIR___', '(?:.*/)?')
        regex_body = regex_body.replace('___DOUBLE_STAR___', '.*')

        if anchored:
            if re.match(regex_body, rel_path):
                return True
        else:
            # If not anchored, it can match any suffix of the path
            # or it can match any component
            if re.search(regex_body, rel_path):
                return True
            
            # Also check if it matches as a component (e.g. "node_modules" matches any "node_modules" dir)
            parts = rel_path.split('/')
            for part in parts:
                if fnmatch.fnmatch(part, clean_pattern):
                    return True

        # Special case for directories: if pattern is "node_modules/", it matches "node_modules" and "node_modules/..."
        if is_dir_pattern:
            parts = rel_path.split('/')
            if any(fnmatch.fnmatch(part, clean_pattern) for part in parts):
                return True

        return False
