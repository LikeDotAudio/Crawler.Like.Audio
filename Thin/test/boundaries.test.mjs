// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
// What Thin may reach outside the page. The Web Scraper used to send every URL
// to the public api.allorigins.win proxy and the PDF page loaded its pdf.js
// worker from cdnjs; both now stay in-house (src/lib/fetcher.ts,
// public/pdf.worker.min.js), and these tests keep them there.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { directFetcher, CorsBlockedError, HttpStatusError } from '../src/lib/fetcher.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|mjs|js)$/.test(name)) out.push(p);
  }
  return out;
}

test('no source names a third-party proxy, and the pdf.js worker is not fetched from a CDN', () => {
  const offenders = [];
  for (const file of walk(join(root, 'src'))) {
    // whole-line comments may tell the history; code may not do it
    const text = readFileSync(file, 'utf8').replace(/^\s*\/\/.*$/gm, '');
    if (/allorigins|corsproxy|cors-anywhere/i.test(text)) offenders.push(`${file.slice(root.length + 1)}: CORS proxy`);
    if (/pdf\.worker[^'"`]*['"`]/.test(text) && /cdnjs|unpkg|jsdelivr/.test(text)) offenders.push(`${file.slice(root.length + 1)}: CDN worker`);
  }
  assert.deepEqual(offenders, []);
});

test('the self-hosted pdf.js worker is the version pdfjs-dist runs', () => {
  const version = JSON.parse(readFileSync(join(root, 'node_modules/pdfjs-dist/package.json'), 'utf8')).version;
  const worker = readFileSync(join(root, 'public/pdf.worker.min.js'), 'utf8');
  assert.ok(worker.includes(`"${version}"`), `public/pdf.worker.min.js is not pdfjs-dist ${version}: run npm run sync:pdf-worker`);
  assert.match(readFileSync(join(root, 'src/components/views/PdfToMdView.tsx'), 'utf8'), /workerSrc = `\$\{BASE_PATH\}\/pdf\.worker\.min\.js`/);
});

test('the direct fetcher reads a CORS-open page itself, without credentials', async () => {
  let seen;
  const f = directFetcher(async (url, init) => {
    seen = { url, init };
    return new Response('<h1>hi</h1>', { status: 200, headers: { 'content-type': 'text/html' } });
  });
  const page = await f.fetchText('https://example.org/a');
  assert.equal(seen.url, 'https://example.org/a');
  assert.equal(seen.init.mode, 'cors');
  assert.equal(seen.init.credentials, 'omit');
  assert.equal(page.text, '<h1>hi</h1>');
  assert.equal(page.contentType, 'text/html');
});

test('a CORS refusal and an HTTP error are told apart, and only http(s) is fetched', async () => {
  const refused = directFetcher(async () => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(refused.fetchText('https://example.org/'), CorsBlockedError);
  const missing = directFetcher(async () => new Response('', { status: 404 }));
  await assert.rejects(missing.fetchText('https://example.org/x'), e => e instanceof HttpStatusError && e.status === 404);
  await assert.rejects(missing.fetchText('file:///etc/passwd'), /http:\/\/ or https:\/\//);
});
