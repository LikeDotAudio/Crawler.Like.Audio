// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
// The export is served from two places: crawler.like.audio's root and the
// APK.audio OS window's deep folder. A hand-written "/file" into public/ only
// works at a site root, so on apk.audio it 404s while the page still renders
// — the AST parser just never boots. Every such URL must start with BASE_PATH.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|mjs|js)$/.test(name)) out.push(p);
  }
  return out;
}

test('no source names a public/ file by a root-absolute URL', () => {
  const served = readdirSync(join(root, 'public'));
  const offenders = [];
  for (const file of walk(join(root, 'src'))) {
    const text = readFileSync(file, 'utf8');
    for (const name of served) {
      const bare = new RegExp(`["'\`]/${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
      if (bare.test(text)) offenders.push(`${file.slice(root.length + 1)} → /${name}`);
    }
    if (/["'`]\/['"`]\s*\+\s*path/.test(text)) offenders.push(`${file.slice(root.length + 1)} → '/' + path`);
  }
  assert.deepEqual(offenders, []);
});

test('the deep-path build is one environment variable away', () => {
  const cfg = readFileSync(join(root, 'next.config.ts'), 'utf8');
  assert.match(cfg, /process\.env\.CRAWLER_BASE_PATH/);
  assert.match(cfg, /\bbasePath\b/);
  assert.match(cfg, /NEXT_PUBLIC_BASE_PATH/);
});
