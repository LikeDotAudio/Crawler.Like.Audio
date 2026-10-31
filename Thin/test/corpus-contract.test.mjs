// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
// Thin against the crawl corpus contract (Contract/corpus.v1.json and
// Contract/fixtures/v1/). Thick/tests/test_corpus_contract.py runs the same
// fixtures, so a rule or format change in one half fails here or there until
// the other half and the fixtures agree. src/lib/corpusFormat.ts is loaded
// as-is through Node's type stripping (Node >= 22.18).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ignore from 'ignore';
// The tree-sitter runtime the page itself loads (layout.tsx), not node_modules':
// public/'s grammars are built for it.
import { Parser, Language } from '../public/web-tree-sitter.js';
import * as cf from '../src/lib/corpusFormat.ts';

const here = dirname(fileURLToPath(import.meta.url));
const contractDir = join(here, '..', '..', 'Contract');
const fix = join(contractDir, 'fixtures', 'v1');
const CREATED = '2026-10-30 00:00:00';
const read = (...p) => readFileSync(join(fix, ...p), 'utf8');
const json = (...p) => JSON.parse(read(...p));
const contract = JSON.parse(readFileSync(join(contractDir, 'corpus.v1.json'), 'utf8'));

let parser;
async function pythonParser() {
  if (parser) return parser;
  const pub = join(here, '..', 'public');
  await Parser.init({ locateFile: () => join(pub, 'web-tree-sitter.wasm') });
  const p = new Parser();
  p.setLanguage(await Language.load(join(pub, 'tree-sitter-python.wasm')));
  parser = p;
  return parser;
}

/** crawlerEngine.ts's walk, over node:fs instead of FileSystemDirectoryHandle:
 *  sorted children, isSkippedDir, the `ignore` package, isTextFile, wantsAst. */
async function crawl(root) {
  const ig = ignore();
  try { ig.add(readFileSync(join(root, '.gitignore'), 'utf8')); } catch { /* none */ }
  const p = await pythonParser();
  const entries = [];
  const walk = (dir, rel) => {
    const names = readdirSync(dir).map(name => ({ name, dir: statSync(join(dir, name)).isDirectory() }));
    names.sort((a, b) => a.dir !== b.dir ? (a.dir ? -1 : 1) : a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    for (const { name, dir: isDir } of names) {
      const path = rel + name;
      if (isDir && cf.isSkippedDir(name)) continue;
      if (ig.ignores(isDir ? path + '/' : path)) continue;
      if (isDir) {
        entries.push({ path, kind: 'dir' });
        walk(join(dir, name), path + '/');
        continue;
      }
      const entry = { path, kind: 'file', content: null, metrics: null };
      if (cf.isTextFile(name)) entry.content = readFileSync(join(dir, name), 'utf8');
      if (entry.content != null && cf.wantsAst(name, statSync(join(dir, name)).size)) {
        entry.metrics = cf.metricsFromTree(p.parse(entry.content).rootNode);
      }
      entries.push(entry);
    }
  };
  walk(root, '');
  return cf.buildCorpus('input', entries, CREATED);
}

test('the constants in corpusFormat.ts are the contract\'s', () => {
  assert.equal(cf.CORPUS_FORMAT, contract.format);
  assert.equal(cf.CORPUS_VERSION, contract.version);
  assert.equal(cf.CORPUS_HEADER, contract.header);
  assert.equal(cf.BANNER, contract.banner);
  assert.equal(cf.SECTION_RULE, contract.sectionRule);
  assert.deepEqual(cf.SKIPPED_DIR_NAMES, contract.skippedDirNames);
  assert.deepEqual(cf.SKIPPED_DIR_PATTERNS.map(r => r.source), contract.skippedDirPatterns);
  assert.deepEqual(cf.TEXT_EXTENSIONS, contract.textExtensions);
  assert.deepEqual(cf.CATEGORIES, contract.categories);
  assert.equal(cf.OTHER_CATEGORY, contract.otherCategory);
  assert.deepEqual(cf.DEFAULT_SELECTED_CATEGORIES, contract.defaultSelectedCategories);
  assert.deepEqual(cf.AST_LANGUAGES, contract.astMetrics.languages);
  assert.equal(cf.AST_MAX_BYTES, contract.astMetrics.maxBytes);
});

test('name rules match the shared cases', () => {
  const cases = json('name-cases.json');
  for (const c of cases.ext) assert.equal(cf.extOf(c.name), c.ext, c.name);
  for (const c of cases.skippedDir) assert.equal(cf.isSkippedDir(c.name), c.skipped, c.name);
  for (const c of cases.category) assert.equal(cf.categoryOf(c.ext), c.category, c.ext);
  for (const c of cases.text) assert.equal(cf.isTextFile(c.name), c.text, c.name);
});

test('the ignore package gives the shared .gitignore answers', () => {
  const cases = json('ignore-cases.json');
  const ig = ignore().add(cases.gitignore);
  for (const c of cases.cases) assert.equal(ig.ignores(c.isDir ? c.path + '/' : c.path), c.ignored, c.path);
});

test('a crawl of the fixture folder is the golden corpus', async () => {
  const { mapText, everythingText } = await crawl(join(fix, 'input'));
  assert.equal(mapText, read('expected', 'MAP.txt'));
  assert.equal(everythingText, read('expected', 'EVERYTHING.LOG'));
  assert.equal(cf.readCorpusVersion(everythingText), 1);
});

test('tree-sitter AST metrics are the golden ones', async () => {
  const p = await pythonParser();
  for (const [path, expected] of Object.entries(json('expected', 'ast-metrics.json'))) {
    assert.deepEqual(cf.metricsFromTree(p.parse(read('input', ...path.split('/'))).rootNode), expected);
  }
});

test('the reader parses every corpus it knows and refuses a newer one', () => {
  for (const [name, expected] of Object.entries(json('parse-cases.json').expect)) {
    const text = read(...name.split('/'));
    if ('refused' in expected) {
      assert.throws(() => cf.parseEverything(text), e => e instanceof cf.UnsupportedCorpusVersionError && e.version === expected.refused);
    } else {
      assert.deepEqual(cf.parseEverything(text), expected, name);
    }
  }
  // the download button prefixes a BOM
  assert.equal(cf.readCorpusVersion('﻿' + read('expected', 'EVERYTHING.LOG')), 1);
});
