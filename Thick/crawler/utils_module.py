# crawler/utils_module.py

import inspect
import os
import re
import json

# --- Global Version Information ---
current_version = "Version 20260117.010000.1" # Updated date
current_version_hash = (20260117 * 10000 * 1)

def debug_log(message, file, version, function, **kwargs):
    # A simplified debug logging function for this script.
    print(f"DEBUG: {file} - {function} - {message} - Version: {version}")

class GitIgnoreMatcher:
    """The root .gitignore of a crawl, with git's rules: '*' and '?' stay inside
    one path segment, '**' crosses them, a pattern with a slash before its end
    is anchored to the root, a trailing '/' matches folders only, '!' re-includes,
    the last matching line wins, and nothing under an ignored folder comes back.
    Thin uses the `ignore` npm package; Contract/fixtures/v1/ignore-cases.json
    holds both to the same answers."""

    def __init__(self, root_dir):
        self.root_dir = os.path.abspath(root_dir)
        self.rules = []          # (regex, negated, dir_only, anchored)
        self.patterns = []       # the raw lines, for display
        self._load_gitignore()

    def _load_gitignore(self):
        gitignore_path = os.path.join(self.root_dir, '.gitignore')
        if not os.path.exists(gitignore_path):
            return
        try:
            with open(gitignore_path, 'r', encoding='utf-8', errors='replace') as f:
                self.add(f.read())
        except Exception as e:
            print(f"Error loading .gitignore: {e}")

    def add(self, text):
        for line in text.splitlines():
            line = line.rstrip()
            if not line or line.startswith('#'):
                continue
            self.patterns.append(line)
            negated = line.startswith('!')
            if negated:
                line = line[1:]
            if line.startswith('\\'):
                line = line[1:]
            dir_only = line.endswith('/')
            line = line.rstrip('/')
            if not line:
                continue
            anchored = '/' in line
            line = line.lstrip('/')
            self.rules.append((re.compile(self._translate(line)), negated, dir_only, anchored))

    @staticmethod
    def _translate(glob):
        out, i, n = [], 0, len(glob)
        while i < n:
            c = glob[i]
            if glob.startswith('**/', i):
                out.append('(?:.*/)?'); i += 3; continue
            if glob.startswith('/**', i) and i + 3 == n:
                out.append('(?:/.*)?'); i += 3; continue
            if glob.startswith('**', i):
                out.append('.*'); i += 2; continue
            if c == '*':
                out.append('[^/]*')
            elif c == '?':
                out.append('[^/]')
            elif c == '[':
                j = glob.find(']', i + 1)
                if j == -1:
                    out.append(re.escape(c))
                else:
                    body = glob[i + 1:j]
                    if body.startswith('!'):
                        body = '^' + body[1:]
                    out.append('[' + body.replace('\\', '\\\\') + ']')
                    i = j
            else:
                out.append(re.escape(c))
            i += 1
        return '(?s:' + ''.join(out) + r')\Z'

    def _decide(self, rel, is_dir):
        ignored = False
        base = rel.rsplit('/', 1)[-1]
        for regex, negated, dir_only, anchored in self.rules:
            if dir_only and not is_dir:
                continue
            if regex.match(rel if anchored else base):
                ignored = not negated
        return ignored

    def ignores(self, rel_path, is_dir=False):
        """`rel_path` is POSIX and relative to the root."""
        parts = [p for p in rel_path.split('/') if p]
        for i in range(1, len(parts) + 1):
            last = i == len(parts)
            if self._decide('/'.join(parts[:i]), is_dir if last else True):
                return True
        return False

    def is_ignored(self, path, is_dir=None):
        if not self.rules:
            return False
        abs_path = os.path.abspath(path)
        try:
            rel_path = os.path.relpath(abs_path, self.root_dir)
        except ValueError:
            return False  # different drive on Windows
        if rel_path == '.' or rel_path.startswith('..'):
            return False
        if is_dir is None:
            is_dir = os.path.isdir(abs_path)
        return self.ignores(rel_path.replace(os.sep, '/'), is_dir)

def pretty_print_json(data):
    """
    Takes a Python dictionary, list, or JSON string and returns a pretty-printed JSON string.
    """
    try:
        if isinstance(data, str):
            parsed_data = json.loads(data)
        else:
            parsed_data = data
        return json.dumps(parsed_data, indent=4)
    except (json.JSONDecodeError, TypeError) as e:
        print(f"Error parsing JSON for pretty printing: {e}")
        return str(data)
