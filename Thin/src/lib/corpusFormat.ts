// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
//
// The crawl corpus, version 1: what MAP.txt and EVERYTHING.LOG look like, which
// folders a crawl skips, which files are text, how extensions group into
// categories, and what the AST metrics of a Python file are.
//
// The source of truth is ../../../Contract/corpus.v1.json and the golden
// fixtures beside it. Thick carries the same rules in
// Thick/crawler/corpus_format.py. test/corpus-contract.test.mjs (here) and
// Thick/tests/test_corpus_contract.py (there) fail when either half drifts.
//
// Pure functions, no imports: node --test loads this file directly (type
// stripping), so it must stay erasable TypeScript with no path aliases.

export const CORPUS_FORMAT = 'crawler-corpus';
export const CORPUS_VERSION = 1;
export const CORPUS_HEADER = `# ${CORPUS_FORMAT}: ${CORPUS_VERSION}`;
const HEADER_PATTERN = /^# crawler-corpus: (\d+)$/;
export const BANNER = '# ' + '='.repeat(84);
export const SECTION_RULE = '-'.repeat(84);
const FILE_DELIMITER = /^# --- File: (.+) ---$/gm;
const LEGACY_THICK_DELIMITER = /^#{37}\n### File: (.+)\n#{37}\n/gm;

export const SKIPPED_DIR_NAMES = ['node_modules', 'venv', '__pycache__', 'crawl'];
export const SKIPPED_DIR_PATTERNS = [/^\./, /^\d{14}$/];

export const TEXT_EXTENSIONS = [
  '.bash', '.bat', '.c', '.cc', '.cjs', '.cmake', '.conf', '.cpp', '.cs', '.csproject', '.css', '.csv',
  '.cxx', '.desktop', '.env', '.go', '.h', '.hpp', '.htm', '.html', '.ini', '.java', '.js', '.json',
  '.jsonl', '.jsx', '.kt', '.kts', '.less', '.md', '.mdx', '.mjs', '.php', '.proto', '.ps1', '.py',
  '.rb', '.rs', '.rst', '.sass', '.scss', '.sh', '.sln', '.sql', '.svg', '.swift', '.toml', '.ts',
  '.tsv', '.tsx', '.txt', '.vue', '.xml', '.yaml', '.yml',
];

export const CATEGORIES: Record<string, string[]> = {
  'Programming': ['.py', '.rs', '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp', '.ipp', '.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.sh', '.bash', '.bat', '.java', '.cs', '.rb', '.go', '.php', '.swift', '.kt', '.kts', '.ps1'],
  'Web & Markup': ['.html', '.htm', '.svg', '.css', '.scss', '.sass', '.less', '.vue'],
  'Data & Config': ['.json', '.jsonl', '.yaml', '.yml', '.toml', '.ini', '.conf', '.csv', '.tsv', '.proto', '.xml', '.env', '.sql', '.db', '.sqlite', '.sqlite3', '.mdb', '.accdb', '.dat'],
  'Build & Infra': ['.cmake', '.lock', '.in', '.nsi', '.desktop', '.sln', '.csproject'],
  'Docs': ['.md', '.mdx', '.txt', '.pdf', '.doc', '.docx', '.rst', '.rtf'],
  'Media': ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp'],
  'Compiler Caches': ['.o', '.pyc', '.d', '.rmeta'],
  'Runtime & Index': ['.log', '.tag'],
  'Backups': ['.old', '.tmp', '.bak'],
  'Libraries': ['.rlib', '.a', '.so', '.lib', '.dll', '.dylib', '.whl'],
  'Binaries': ['.exe', '.bin', '.msi', '.dmg', '.pkg', '.iso', '.out', '.elf', '.apk'],
  'Misc': ['.zip', '.mib', '.expr', '.shw'],
};
export const OTHER_CATEGORY = 'Other';
export const DEFAULT_SELECTED_CATEGORIES = ['Programming', 'Web & Markup', 'Data & Config', 'Build & Infra', 'Docs'];

export const AST_LANGUAGES = ['.py'];
export const AST_MAX_BYTES = 512000;

/** Lower-cased extension with its dot, or '' — Python's os.path.splitext rule:
 *  a leading dot is part of the name (".gitignore" has no extension). */
export function extOf(name: string): string {
  const dot = name.lastIndexOf('.');
  let start = 0;
  while (start < name.length && name[start] === '.') start++;
  return dot >= start ? name.slice(dot).toLowerCase() : '';
}

export function isSkippedDir(name: string): boolean {
  return SKIPPED_DIR_NAMES.includes(name.toLowerCase()) || SKIPPED_DIR_PATTERNS.some(re => re.test(name));
}

export function isTextFile(name: string): boolean {
  return TEXT_EXTENSIONS.includes(extOf(name));
}

export function categoryOf(ext: string): string {
  for (const [name, exts] of Object.entries(CATEGORIES)) {
    if (exts.includes(ext)) return name;
  }
  return OTHER_CATEGORY;
}

export function wantsAst(name: string, sizeBytes: number): boolean {
  return AST_LANGUAGES.includes(extOf(name)) && sizeBytes < AST_MAX_BYTES;
}

// ---------------------------------------------------------------- AST metrics

export interface AstStructure { type: 'class' | 'function'; name: string }
export interface AstMetrics { classCount: number; functionCount: number; structures: AstStructure[] }

/** The slice of a tree-sitter node the metrics walk reads. */
export interface SyntaxNodeLike {
  type: string;
  childCount: number;
  child(index: number): SyntaxNodeLike | null;
  childForFieldName(field: string): { text: string } | null;
}

/** Every class_definition / function_definition, depth-first in source order
 *  (methods and nested functions included; async def is a function). */
export function metricsFromTree(root: SyntaxNodeLike): AstMetrics {
  const structures: AstStructure[] = [];
  const walk = (node: SyntaxNodeLike) => {
    const type = node.type === 'class_definition' ? 'class' : node.type === 'function_definition' ? 'function' : null;
    if (type) {
      const nameNode = node.childForFieldName('name');
      if (nameNode) structures.push({ type, name: nameNode.text });
    }
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) walk(child);
    }
  };
  walk(root);
  return {
    classCount: structures.filter(s => s.type === 'class').length,
    functionCount: structures.filter(s => s.type === 'function').length,
    structures,
  };
}

// ---------------------------------------------------------------- writing

export interface CorpusEntry {
  /** POSIX path relative to the crawled folder, no leading slash. */
  path: string;
  kind: 'dir' | 'file';
  /** Text of a text file (isTextFile); absent or null for anything else. */
  content?: string | null;
  metrics?: AstMetrics | null;
}

interface TreeNode { name: string; kind: 'dir' | 'file'; entry?: CorpusEntry; children: Map<string, TreeNode> }

const byName = (a: TreeNode, b: TreeNode) =>
  a.kind !== b.kind ? (a.kind === 'dir' ? -1 : 1) : a.name < b.name ? -1 : a.name > b.name ? 1 : 0;

function buildTree(entries: CorpusEntry[]): TreeNode {
  const root: TreeNode = { name: '', kind: 'dir', children: new Map() };
  for (const entry of entries) {
    const parts = entry.path.split('/').filter(Boolean);
    let node = root;
    parts.forEach((part, i) => {
      const last = i === parts.length - 1;
      const kind = last ? entry.kind : 'dir';
      let next = node.children.get(part);
      if (!next) {
        next = { name: part, kind, children: new Map() };
        node.children.set(part, next);
      }
      if (last) next.entry = entry;
      node = next;
    });
  }
  return root;
}

const metricsSuffix = (m?: AstMetrics | null) =>
  m ? `  (classes: ${m.classCount}, functions: ${m.functionCount})` : '';

/** Dirs first, then files, each by name; depth-first. The order of MAP.txt
 *  and of the file blocks in EVERYTHING.LOG. */
export function orderEntries(entries: CorpusEntry[]): CorpusEntry[] {
  const out: CorpusEntry[] = [];
  const visit = (node: TreeNode) => {
    for (const child of [...node.children.values()].sort(byName)) {
      if (child.entry) out.push(child.entry);
      visit(child);
    }
  };
  visit(buildTree(entries));
  return out;
}

export function buildMap(rootName: string, entries: CorpusEntry[], created: string): string {
  const lines = [CORPUS_HEADER, `# Program Map: ${rootName}`, `# Created: ${created}`, '#', `${rootName}/`];
  const visit = (node: TreeNode, prefix: string) => {
    const children = [...node.children.values()].sort(byName);
    children.forEach((child, i) => {
      const last = i === children.length - 1;
      const label = child.kind === 'dir' ? `${child.name}/` : `${child.name}${metricsSuffix(child.entry?.metrics)}`;
      lines.push(`${prefix}${last ? '└── ' : '├── '}${label}`);
      if (child.kind === 'dir') visit(child, prefix + (last ? '    ' : '│   '));
    });
  };
  visit(buildTree(entries), '');
  return lines.join('\n') + '\n';
}

/** Trailing newlines collapse to one; empty stays empty. The one place v1 is
 *  not byte-exact, and it is the same in both halves. */
export function normalizeContent(content: string): string {
  const body = content.replace(/\n+$/, '');
  return body ? body + '\n' : '';
}

export function buildEverything(mapText: string, entries: CorpusEntry[], created: string): string {
  let out = `${mapText}\n${SECTION_RULE}\n\n${BANNER}\n# EVERYTHING.LOG\n# Log started at: ${created}\n${BANNER}\n`;
  for (const entry of orderEntries(entries)) {
    if (entry.kind !== 'file' || entry.content == null) continue;
    out += `\n# --- File: ${entry.path} ---\n${normalizeContent(entry.content)}`;
  }
  return out;
}

export function buildCorpus(rootName: string, entries: CorpusEntry[], created: string) {
  const mapText = buildMap(rootName, entries, created);
  return { mapText, everythingText: buildEverything(mapText, entries, created) };
}

// ---------------------------------------------------------------- reading

export class UnsupportedCorpusVersionError extends Error {
  version: number;
  constructor(version: number) {
    super(`This corpus is ${CORPUS_FORMAT} version ${version}; this build reads up to version ${CORPUS_VERSION}.`);
    this.name = 'UnsupportedCorpusVersionError';
    this.version = version;
  }
}

/** The version a corpus declares on its first line; 0 = written before the
 *  format was versioned (accepted, parsed with the legacy delimiters). */
export function readCorpusVersion(text: string): number {
  const first = text.replace(/^﻿/, '').split('\n', 1)[0].replace(/\r$/, '');
  const m = HEADER_PATTERN.exec(first);
  return m ? Number(m[1]) : 0;
}

export function isSafeRelativePath(path: string): boolean {
  if (!path || path.startsWith('/') || /^[A-Za-z]:/.test(path) || path.includes('\\')) return false;
  return !path.split('/').some(part => part === '..');
}

export interface ParsedCorpus { version: number; files: { path: string; content: string }[]; skipped: string[] }

function split(text: string, delimiter: RegExp, headerHasNewline: boolean) {
  const found: { path: string; content: string }[] = [];
  const matches = [...text.matchAll(delimiter)];
  matches.forEach((m, i) => {
    const start = (m.index ?? 0) + m[0].length + (headerHasNewline ? 1 : 0);
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length;
    found.push({ path: m[1].trim(), content: normalizeContent(text.slice(start, end)) });
  });
  return found;
}

/** Every file in an EVERYTHING.LOG. Refuses a version newer than this build
 *  (UnsupportedCorpusVersionError); drops paths that would leave the target. */
export function parseEverything(text: string): ParsedCorpus {
  text = text.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const version = readCorpusVersion(text);
  if (version > CORPUS_VERSION) throw new UnsupportedCorpusVersionError(version);
  let raw = split(text, FILE_DELIMITER, true);
  if (version === 0) {
    // v0 Thin wrote "/sub/file"; v0 Thick wrote a 37-hash banner and "<root>/sub/file".
    raw = raw.length ? raw.map(f => ({ ...f, path: f.path.replace(/^\/+/, '') })) : split(text, LEGACY_THICK_DELIMITER, false);
  }
  return {
    version,
    files: raw.filter(f => isSafeRelativePath(f.path)),
    skipped: raw.filter(f => !isSafeRelativePath(f.path)).map(f => f.path),
  };
}
