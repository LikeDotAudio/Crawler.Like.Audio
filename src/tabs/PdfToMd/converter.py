# src/tabs/PdfToMd/converter.py
#
# Offline PDF -> Markdown conversion. No network calls, no API keys, no tokens.
# PDFs without a real text layer (scans that were never OCR'd) are reported as
# skipped instead of producing an empty markdown file.

import contextlib
import fnmatch
import io
import math
import os

try:
    import pymupdf
except ImportError:
    try:
        import fitz as pymupdf  # older PyMuPDF releases
    except ImportError:
        pymupdf = None

try:
    # The library prints an advisory banner on import - keep it off the console.
    with contextlib.redirect_stdout(io.StringIO()):
        import pymupdf4llm
except ImportError:
    pymupdf4llm = None

LIBS_AVAILABLE = pymupdf is not None and pymupdf4llm is not None
MISSING_LIBS_MESSAGE = "PyMuPDF / pymupdf4llm not installed. Run: pip install -r requirements.txt"

# Statuses reported back to the UI
STATUS_CONVERTED = "Converted"
STATUS_NO_TEXT = "Skipped (no text layer)"
STATUS_EXISTS = "Skipped (already exists)"
STATUS_ENCRYPTED = "Skipped (encrypted)"
STATUS_ERROR = "Error"

# Directories that never hold user documents
SKIP_DIRS = {"venv", "__pycache__", "node_modules"}


def parse_filter(raw):
    """Splits a comma-separated filter string into normalised patterns."""
    if not raw:
        return []
    return [part.strip().lower() for part in raw.split(",") if part.strip()]


def matches_filter(pdf_path, source_root, patterns):
    """
    True when the PDF satisfies at least one pattern (or there are none).

    A pattern containing a wildcard (* ? [) is treated as a glob, anything else
    as a plain substring. Both the file name and the path relative to
    source_root are tested, so "invoices/" or "*2024*.pdf" both work.
    """
    if not patterns:
        return True

    name = os.path.basename(pdf_path).lower()
    try:
        rel = os.path.relpath(pdf_path, source_root)
    except ValueError:  # different drive on Windows
        rel = pdf_path
    rel = rel.replace(os.sep, "/").lower()

    for pattern in patterns:
        if any(ch in pattern for ch in "*?["):
            # The relative path is also tested unanchored, so a pattern like
            # "invoices/*.pdf" matches at any depth rather than only at the root.
            if (fnmatch.fnmatch(name, pattern)
                    or fnmatch.fnmatch(rel, pattern)
                    or fnmatch.fnmatch(rel, "*" + pattern)):
                return True
        elif pattern in name or pattern in rel:
            return True
    return False


def find_pdfs(root_dir, patterns=None):
    """
    Walks root_dir recursively and returns every .pdf file, sorted.
    When patterns are given, only matching files are returned.
    """
    found = []
    for dirpath, dirnames, filenames in os.walk(root_dir):
        dirnames[:] = [d for d in dirnames if not d.startswith('.') and d not in SKIP_DIRS]
        for name in filenames:
            if not name.lower().endswith(".pdf"):
                continue
            full = os.path.join(dirpath, name)
            if matches_filter(full, root_dir, patterns):
                found.append(full)
    found.sort()
    return found


# A document must have a text layer on at least this share of its pages.
# Keeps a mostly-scanned document from passing on one stamped header line,
# while a short but genuine document (every page has text) still qualifies.
TEXT_PAGE_RATIO = 0.1


def inspect_pdf(pdf_path, min_chars_per_page=20):
    """
    Decides whether a PDF carries an extractable text layer.

    A page counts as "text" when it yields at least min_chars_per_page
    non-whitespace characters. The document qualifies once TEXT_PAGE_RATIO of
    its pages (at least one) are text pages - image-only scans yield zero.

    Returns a dict: pages, text_pages, text_chars, has_text, encrypted, error.
    """
    info = {
        "pages": 0,
        "text_pages": 0,
        "text_chars": 0,
        "has_text": False,
        "encrypted": False,
        "error": None,
    }

    doc = None
    try:
        doc = pymupdf.open(pdf_path)

        if doc.is_encrypted and not doc.authenticate(""):
            info["encrypted"] = True
            return info

        info["pages"] = doc.page_count
        required = max(1, math.ceil(doc.page_count * TEXT_PAGE_RATIO))

        for page in doc:
            text = "".join(page.get_text("text").split())
            info["text_chars"] += len(text)
            if len(text) >= min_chars_per_page:
                info["text_pages"] += 1
            # Enough evidence of a text layer - stop reading early.
            if info["text_pages"] >= required:
                info["has_text"] = True
                break
    except Exception as e:
        info["error"] = str(e)
    finally:
        if doc is not None:
            try:
                doc.close()
            except Exception:
                pass

    return info


def markdown_path_for(pdf_path, source_root=None, output_root=None):
    """
    Target .md path. Same basename as the PDF, either beside the original or
    mirrored under output_root with the sub-directory structure preserved.
    """
    if output_root:
        rel = os.path.relpath(pdf_path, source_root)
        return os.path.join(output_root, os.path.splitext(rel)[0] + ".md")
    return os.path.splitext(pdf_path)[0] + ".md"


def _rewrite_image_links(md_text, images_dir, images_folder_name):
    """pymupdf4llm writes absolute image paths - make them relative to the .md."""
    variants = {images_dir, images_dir.replace(os.sep, "/")}
    for variant in variants:
        md_text = md_text.replace(variant + "/", images_folder_name + "/")
        md_text = md_text.replace(variant + os.sep, images_folder_name + "/")
    return md_text


def convert_pdf(pdf_path, md_path, write_images=False):
    """Converts a single PDF to markdown and writes it to md_path."""
    os.makedirs(os.path.dirname(os.path.abspath(md_path)), exist_ok=True)

    kwargs = {"show_progress": False}
    images_dir = None
    images_folder_name = None

    if write_images:
        stem = os.path.splitext(os.path.basename(md_path))[0]
        images_folder_name = f"{stem}_images"
        images_dir = os.path.join(os.path.dirname(os.path.abspath(md_path)), images_folder_name)
        os.makedirs(images_dir, exist_ok=True)
        kwargs["write_images"] = True
        kwargs["image_path"] = images_dir

    doc = pymupdf.open(pdf_path)
    try:
        # pymupdf4llm writes advisory notices straight to stdout - keep them
        # out of the app console.
        with contextlib.redirect_stdout(io.StringIO()):
            md_text = pymupdf4llm.to_markdown(doc, **kwargs)
    finally:
        try:
            doc.close()
        except Exception:
            pass

    if images_dir:
        md_text = _rewrite_image_links(md_text, images_dir, images_folder_name)

    with open(md_path, "w", encoding="utf-8") as f:
        f.write(md_text)

    return len(md_text)


def convert_folder(source_root, pdf_paths, output_root=None, overwrite=False,
                   write_images=False, min_chars_per_page=20,
                   progress_callback=None, cancel_event=None):
    """
    Converts every PDF in pdf_paths. progress_callback receives
    (index, total, pdf_path, status, detail) after each file.

    Returns a summary dict keyed by status plus a "cancelled" flag.
    """
    summary = {
        STATUS_CONVERTED: 0,
        STATUS_NO_TEXT: 0,
        STATUS_EXISTS: 0,
        STATUS_ENCRYPTED: 0,
        STATUS_ERROR: 0,
        "cancelled": False,
    }

    total = len(pdf_paths)

    for index, pdf_path in enumerate(pdf_paths, start=1):
        if cancel_event is not None and cancel_event.is_set():
            summary["cancelled"] = True
            break

        md_path = markdown_path_for(pdf_path, source_root, output_root)

        if not overwrite and os.path.exists(md_path):
            status, detail = STATUS_EXISTS, os.path.basename(md_path)
        else:
            info = inspect_pdf(pdf_path, min_chars_per_page=min_chars_per_page)

            if info["error"]:
                status, detail = STATUS_ERROR, info["error"]
            elif info["encrypted"]:
                status, detail = STATUS_ENCRYPTED, "password protected"
            elif not info["has_text"]:
                status = STATUS_NO_TEXT
                detail = f"{info['pages']} page(s), {info['text_chars']} text chars - needs OCR"
            else:
                try:
                    chars = convert_pdf(pdf_path, md_path, write_images=write_images)
                    status, detail = STATUS_CONVERTED, f"{chars} chars -> {os.path.basename(md_path)}"
                except Exception as e:
                    status, detail = STATUS_ERROR, str(e)

        summary[status] += 1

        if progress_callback is not None:
            progress_callback(index, total, pdf_path, status, detail)

    return summary
