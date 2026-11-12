# Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
# MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
"""The crawl corpus, version 1 -- Thick's copy of the rules.

What MAP.txt and EVERYTHING.LOG look like, which folders a crawl skips, which
files are text, how extensions group into categories, and what the AST metrics
of a Python file are. The source of truth is Contract/corpus.v1.json and the
golden fixtures in Contract/fixtures/v1/; Thin carries the same rules in
Thin/src/lib/corpusFormat.ts. Thick/tests/test_corpus_contract.py and
Thin/test/corpus-contract.test.mjs fail when either half drifts.

No tkinter here: the tests import it on a machine without a display.
"""

import ast
import json
import re

CORPUS_FORMAT = "crawler-corpus"
CORPUS_VERSION = 1
CORPUS_HEADER = f"# {CORPUS_FORMAT}: {CORPUS_VERSION}"
_HEADER_PATTERN = re.compile(r"^# crawler-corpus: (\d+)$")
BANNER = "# " + "=" * 84
SECTION_RULE = "-" * 84
_FILE_DELIMITER = re.compile(r"^# --- File: (.+) ---$", re.M)
# A file whose content is the same as an earlier one (sha256) is not copied
# again: EVERYTHING.LOG lists it on a link line between the banner and the
# first "# --- File:" section -- text every v1 reader already skips -- and the
# map marks it "(same as: <path>)". A corpus without duplicates has none, so
# the golden fixtures and Thin's output are unchanged.
LINK_PREFIX = "# --- Link: "
LINK_SUFFIX = " ---"
_LINK_PATTERN = re.compile(r"^# --- Link: (\{.*\}) ---$", re.M)
_LEGACY_THICK_DELIMITER = re.compile(r"^#{37}\n### File: (.+)\n#{37}\n", re.M)

SKIPPED_DIR_NAMES = ["node_modules", "venv", "__pycache__", "crawl"]
SKIPPED_DIR_PATTERNS = [re.compile(r"^\."), re.compile(r"^\d{14}$")]

TEXT_EXTENSIONS = [
    ".bash", ".bat", ".c", ".cc", ".cjs", ".cmake", ".conf", ".cpp", ".cs", ".csproject", ".css", ".csv",
    ".cxx", ".desktop", ".env", ".go", ".h", ".hpp", ".htm", ".html", ".ini", ".java", ".js", ".json",
    ".jsonl", ".jsx", ".kt", ".kts", ".less", ".md", ".mdx", ".mjs", ".php", ".proto", ".ps1", ".py",
    ".rb", ".rs", ".rst", ".sass", ".scss", ".sh", ".sln", ".sql", ".svg", ".swift", ".toml", ".ts",
    ".tsv", ".tsx", ".txt", ".vue", ".xml", ".yaml", ".yml",
]

CATEGORIES = {
    "Programming": [".py", ".rs", ".c", ".cpp", ".cc", ".cxx", ".h", ".hpp", ".ipp", ".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx", ".sh", ".bash", ".bat", ".java", ".cs", ".rb", ".go", ".php", ".swift", ".kt", ".kts", ".ps1"],
    "Web & Markup": [".html", ".htm", ".svg", ".css", ".scss", ".sass", ".less", ".vue"],
    "Data & Config": [".json", ".jsonl", ".yaml", ".yml", ".toml", ".ini", ".conf", ".csv", ".tsv", ".proto", ".xml", ".env", ".sql", ".db", ".sqlite", ".sqlite3", ".mdb", ".accdb", ".dat"],
    "Build & Infra": [".cmake", ".lock", ".in", ".nsi", ".desktop", ".sln", ".csproject"],
    "Docs": [".md", ".mdx", ".txt", ".pdf", ".doc", ".docx", ".rst", ".rtf"],
    "Media": [".png", ".jpg", ".jpeg", ".gif", ".ico", ".webp"],
    "Compiler Caches": [".o", ".pyc", ".d", ".rmeta"],
    "Runtime & Index": [".log", ".tag"],
    "Backups": [".old", ".tmp", ".bak"],
    "Libraries": [".rlib", ".a", ".so", ".lib", ".dll", ".dylib", ".whl"],
    "Binaries": [".exe", ".bin", ".msi", ".dmg", ".pkg", ".iso", ".out", ".elf", ".apk"],
    "Misc": [".zip", ".mib", ".expr", ".shw"],
}
OTHER_CATEGORY = "Other"
DEFAULT_SELECTED_CATEGORIES = ["Programming", "Web & Markup", "Data & Config", "Build & Infra", "Docs"]

AST_LANGUAGES = [".py"]
AST_MAX_BYTES = 512000


def ext_of(name):
    """Lower-cased extension with its dot, or '' (os.path.splitext's rule:
    a leading dot is part of the name, so '.gitignore' has none)."""
    start = len(name) - len(name.lstrip("."))
    dot = name.rfind(".")
    return name[dot:].lower() if dot >= start else ""


def is_skipped_dir(name):
    return name.lower() in SKIPPED_DIR_NAMES or any(p.search(name) for p in SKIPPED_DIR_PATTERNS)


def is_text_file(name):
    return ext_of(name) in TEXT_EXTENSIONS


def category_of(ext):
    for name, exts in CATEGORIES.items():
        if ext in exts:
            return name
    return OTHER_CATEGORY


def wants_ast(name, size_bytes):
    return ext_of(name) in AST_LANGUAGES and size_bytes < AST_MAX_BYTES


# ------------------------------------------------------------------ AST metrics

def python_metrics(source):
    """Every class and function (methods, nested and async defs included),
    depth-first in source order -- what tree-sitter's walk in Thin yields.
    None when the source does not parse."""
    try:
        tree = ast.parse(source)
    except (SyntaxError, ValueError):
        return None
    structures = []

    def walk(node):
        if isinstance(node, ast.ClassDef):
            structures.append({"type": "class", "name": node.name})
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            structures.append({"type": "function", "name": node.name})
        # decorators come before the def in the source, after the body in _fields
        children = list(ast.iter_child_nodes(node))
        decorators = getattr(node, "decorator_list", [])
        for child in decorators:
            walk(child)
        for child in children:
            if child not in decorators:
                walk(child)

    walk(tree)
    return {
        "classCount": sum(1 for s in structures if s["type"] == "class"),
        "functionCount": sum(1 for s in structures if s["type"] == "function"),
        "structures": structures,
    }


# ------------------------------------------------------------------ writing
# An entry is a dict: {"path": "sub/file.py" (POSIX, relative, no leading
# slash), "kind": "dir"|"file", "content": str|None, "metrics": dict|None},
# and optionally "sha256" and "sameAs" (the path of the earlier file with the
# same content; such an entry carries no content of its own).

def _tree(entries):
    root = {"name": "", "kind": "dir", "entry": None, "children": {}}
    for entry in entries:
        parts = [p for p in entry["path"].split("/") if p]
        node = root
        for i, part in enumerate(parts):
            last = i == len(parts) - 1
            nxt = node["children"].get(part)
            if nxt is None:
                nxt = {"name": part, "kind": entry["kind"] if last else "dir", "entry": None, "children": {}}
                node["children"][part] = nxt
            if last:
                nxt["entry"] = entry
            node = nxt
    return root


def _sorted(node):
    return sorted(node["children"].values(), key=lambda c: (c["kind"] != "dir", c["name"]))


def order_entries(entries):
    """Dirs first, then files, each by name; depth-first."""
    out = []

    def visit(node):
        for child in _sorted(node):
            if child["entry"] is not None:
                out.append(child["entry"])
            visit(child)

    visit(_tree(entries))
    return out


def _metrics_suffix(metrics):
    return f"  (classes: {metrics['classCount']}, functions: {metrics['functionCount']})" if metrics else ""


def build_map(root_name, entries, created):
    lines = [CORPUS_HEADER, f"# Program Map: {root_name}", f"# Created: {created}", "#", f"{root_name}/"]

    def visit(node, prefix):
        children = _sorted(node)
        for i, child in enumerate(children):
            last = i == len(children) - 1
            if child["kind"] == "dir":
                label = child["name"] + "/"
            else:
                entry = child["entry"] or {}
                label = child["name"] + _metrics_suffix(entry.get("metrics"))
                if entry.get("sameAs"):
                    label += f"  (same as: {entry['sameAs']})"
            lines.append(f"{prefix}{'└── ' if last else '├── '}{label}")
            if child["kind"] == "dir":
                visit(child, prefix + ("    " if last else "│   "))

    visit(_tree(entries), "")
    return "\n".join(lines) + "\n"


def normalize_content(content):
    """Trailing newlines collapse to one; empty stays empty (same in Thin)."""
    body = content.rstrip("\n")
    return body + "\n" if body else ""


def link_line(path, same_as, sha256):
    body = json.dumps({"path": path, "sameAs": same_as, "sha256": sha256}, ensure_ascii=False, sort_keys=True)
    return f"{LINK_PREFIX}{body}{LINK_SUFFIX}"


def build_everything(map_text, entries, created):
    out = [f"{map_text}\n{SECTION_RULE}\n\n{BANNER}\n# EVERYTHING.LOG\n# Log started at: {created}\n{BANNER}\n"]
    ordered = order_entries(entries)
    for entry in ordered:
        if entry["kind"] == "file" and entry.get("sameAs"):
            out.append(link_line(entry["path"], entry["sameAs"], entry.get("sha256")) + "\n")
    for entry in ordered:
        if entry["kind"] != "file" or entry.get("content") is None:
            continue
        out.append(f"\n# --- File: {entry['path']} ---\n{normalize_content(entry['content'])}")
    return "".join(out)


def build_corpus(root_name, entries, created):
    map_text = build_map(root_name, entries, created)
    return map_text, build_everything(map_text, entries, created)


# ------------------------------------------------------------------ reading

class UnsupportedCorpusVersion(ValueError):
    def __init__(self, version):
        super().__init__(f"This corpus is {CORPUS_FORMAT} version {version}; "
                         f"this build reads up to version {CORPUS_VERSION}.")
        self.version = version


def read_corpus_version(text):
    """The version the first line declares; 0 = written before versioning."""
    first = text.lstrip("﻿").split("\n", 1)[0].rstrip("\r")
    m = _HEADER_PATTERN.match(first)
    return int(m.group(1)) if m else 0


def is_safe_relative_path(path):
    if not path or path.startswith("/") or re.match(r"^[A-Za-z]:", path) or "\\" in path:
        return False
    return ".." not in path.split("/")


def _split(text, delimiter, header_has_newline):
    matches = list(delimiter.finditer(text))
    found = []
    for i, m in enumerate(matches):
        start = m.end() + (1 if header_has_newline else 0)
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        found.append({"path": m.group(1).strip(), "content": normalize_content(text[start:end])})
    return found


def parse_everything(text):
    """{'version', 'files': [{'path', 'content'}], 'skipped': [path]}.
    Raises UnsupportedCorpusVersion for a version newer than this build;
    drops paths that would leave the target folder."""
    text = text.lstrip("﻿").replace("\r\n", "\n")
    version = read_corpus_version(text)
    if version > CORPUS_VERSION:
        raise UnsupportedCorpusVersion(version)
    raw = _split(text, _FILE_DELIMITER, True)
    if version == 0:
        # v0 Thin wrote "/sub/file"; v0 Thick wrote a 37-hash banner and "<root>/sub/file".
        if raw:
            raw = [{**f, "path": f["path"].lstrip("/")} for f in raw]
        else:
            raw = _split(text, _LEGACY_THICK_DELIMITER, False)
    return {
        "version": version,
        "files": [f for f in raw if is_safe_relative_path(f["path"])],
        "skipped": [f["path"] for f in raw if not is_safe_relative_path(f["path"])],
    }


def parse_links(text):
    """[{'path', 'sameAs', 'sha256'}] from the link lines before the first
    file section; both paths must be safe. [] for a corpus without any."""
    text = text.lstrip("\ufeff").replace("\r\n", "\n")
    first = _FILE_DELIMITER.search(text)
    links = []
    for m in _LINK_PATTERN.finditer(text[:first.start() if first else len(text)]):
        try:
            link = json.loads(m.group(1))
        except ValueError:
            continue
        if not isinstance(link, dict):
            continue
        path, same_as = link.get("path"), link.get("sameAs")
        if isinstance(path, str) and isinstance(same_as, str) \
                and is_safe_relative_path(path) and is_safe_relative_path(same_as):
            links.append({"path": path, "sameAs": same_as, "sha256": link.get("sha256")})
    return links
