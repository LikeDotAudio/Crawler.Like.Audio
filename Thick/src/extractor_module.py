# src/extractor_module.py

import os
import re

class CommentAndMarkdownExtractor:
    def __init__(self, output_dir, log_callback=None):
        self.output_dir = output_dir
        self.log_callback = log_callback
        self.output_file_path = os.path.join(self.output_dir, "EXTRACTED_COMMENTS_AND_DOCS.LOG")
        self.file_handle = None

    def open_file(self):
        try:
            self.file_handle = open(self.output_file_path, "w", encoding="utf-8")
            self.file_handle.write("# Extracted Markdown and Code Comments\n")
            self.file_handle.write("# ==========================================\n\n")
        except Exception as e:
            if self.log_callback:
                self.log_callback(f"❌ Error opening extractor output file: {e}", "header")

    def extract_from_file(self, file_path, relative_path):
        if not self.file_handle:
            return

        try:
            _, ext = os.path.splitext(file_path)
            ext = ext.lower()

            with open(file_path, "r", encoding="utf-8", errors='replace') as f:
                content = f.read()

            extracted_text = ""

            if ext == '.md':
                # For Markdown files, we extract the whole content
                extracted_text = content
            else:
                # For code files, we extract comments
                extracted_text = self._extract_comments(content, ext)

            if extracted_text.strip():
                self.file_handle.write(f"#####################################\n")
                self.file_handle.write(f"### File: {relative_path}\n")
                self.file_handle.write(f"#####################################\n")
                self.file_handle.write(f"{extracted_text.strip()}\n\n")

        except Exception as e:
            if self.log_callback:
                self.log_callback(f"❌ Error extracting from {file_path}: {e}", "header")

    def _extract_comments(self, content, ext):
        extracted = []
        
        # Python comments
        if ext in ['.py']:
            # match single line comments # ...
            # and docstrings """ ... """ or ''' ... '''
            lines = content.split('\n')
            in_docstring = False
            doc_char = ""
            for line in lines:
                sline = line.strip()
                if not in_docstring:
                    if sline.startswith('"""') or sline.startswith("'''"):
                        in_docstring = True
                        doc_char = sline[:3]
                        extracted.append(sline)
                        if sline.endswith(doc_char) and len(sline) > 3:
                            in_docstring = False
                    elif '#' in line:
                        # Extract the comment part
                        extracted.append(line[line.find('#'):].strip())
                else:
                    extracted.append(sline)
                    if sline.endswith(doc_char):
                        in_docstring = False
                        
        # C-style comments (JS, CS, CSS, etc.)
        elif ext in ['.js', '.cs', '.css', '.cpp', '.c', '.h']:
            # Match // ... and /* ... */
            lines = content.split('\n')
            in_multiline = False
            for line in lines:
                sline = line.strip()
                if not in_multiline:
                    if '/*' in sline:
                        in_multiline = True
                        extracted.append(sline[sline.find('/*'):])
                        if '*/' in sline[sline.find('/*')+2:]:
                            in_multiline = False
                    elif '//' in sline:
                        extracted.append(sline[sline.find('//'):])
                else:
                    extracted.append(sline)
                    if '*/' in sline:
                        in_multiline = False

        # HTML / XML comments
        elif ext in ['.html', '.xml']:
            lines = content.split('\n')
            in_multiline = False
            for line in lines:
                sline = line.strip()
                if not in_multiline:
                    if '<!--' in sline:
                        in_multiline = True
                        extracted.append(sline[sline.find('<!--'):])
                        if '-->' in sline[sline.find('<!--')+4:]:
                            in_multiline = False
                else:
                    extracted.append(sline)
                    if '-->' in sline:
                        in_multiline = False
                        
        return '\n'.join(extracted)

    def close_file(self):
        if self.file_handle:
            self.file_handle.close()
            self.file_handle = None
