// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
// THE ONE TABLE (ROAD-3494): the two converter tables are APKTables drawn by
// components/common/ApkTable.tsx (on the vendored src/vendor/apk-table) under
// their own ids, and no component writes a <table> itself.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('../src', import.meta.url));
const { loadApkTable } = createRequire(import.meta.url)('./apk-table-shim.cjs');
const walk = (d) => readdirSync(d).flatMap((n) => {
  const p = path.join(d, n);
  return statSync(p).isDirectory() ? (n === 'vendor' ? [] : walk(p)) : [p];
});

test('the converter tables are crawler-csv-columns and crawler-json-preview', () => {
  const files = walk(src).filter((f) => /\.(tsx|ts)$/.test(f));
  const ids = files.flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/<ApkTable\s+id="([^"]+)"/g)].map((m) => m[1]));
  assert.deepEqual(ids.sort(), ['crawler-csv-columns', 'crawler-json-preview']);
  for (const f of files) assert.doesNotMatch(readFileSync(f, 'utf8'), /<table|createElement\(['"]table/, f);
});

test('the vendored apk-table registers what the wrapper creates', () => {
  const { window, document } = loadApkTable(path.join(src, 'vendor/apk-table/apk-table.js'));
  const t = window.APKTable.create(document.createElement('div'), { id: 'crawler-json-preview', editable: false, columns: [{ key: 'a' }], rows: [{ a: '<i>1</i>' }] });
  assert.equal(window.APKTable.get('crawler-json-preview'), t);
  assert.equal(t.el.querySelector('tbody').children[0].children[0].textContent, '<i>1</i>');
});
