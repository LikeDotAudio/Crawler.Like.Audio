// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/**
 * Crawler's door onto THE ONE SOFTAPP CLIENT (FrontEnd/shared/apk-softapp.js,
 * vendored in src/vendor/apk-softapp, held to its source by check.sh webshared).
 *
 * Loaded on first use in the browser only — the static export prerenders on
 * the server, where there is no window to draw a card in. apk-softapp.js reads
 * window.APKContracts for the problems catalogue, so the vendored contracts
 * module is hung there first.
 *
 * problem() is how a view says something went wrong: what happened / why /
 * do this, with Retry where retrying helps. A user cancelling a picker is not
 * a problem and is ignored.
 */
type Sdk = {
  showProblem(p: unknown, opts?: ProblemOpts): unknown;
  describe(d: unknown): unknown;
};

export interface ProblemOpts {
  subject?: string;
  detail?: string;
  fix?: string[];
  onRetry?: () => void;
}

let loading: Promise<Sdk | null> | null = null;

function sdk(): Promise<Sdk | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (!loading) {
    loading = import('@/vendor/apk-contracts/apk-contracts.mjs')
      .then((C) => {
        const w = window as unknown as Record<string, unknown>;
        if (!w.APKContracts) w.APKContracts = C;
        return import('@/vendor/apk-softapp/apk-softapp.js');
      })
      .then(() => ((window as unknown as { APKSoftapp?: Sdk }).APKSoftapp) || null)
      .catch(() => null);
  }
  return loading;
}

/** True for a picker the user closed — nothing went wrong. */
export function isCancel(err: unknown): boolean {
  return !!err && typeof err === 'object' && (err as { name?: string }).name === 'AbortError';
}

export function problem(codeOrError: unknown, opts: ProblemOpts = {}): void {
  if (isCancel(codeOrError)) return;
  void sdk().then((s) => {
    if (s) s.showProblem(codeOrError, opts);
  });
}

/** What Crawler takes in, puts out and lets you control — the ? button (F1). */
export function describeCrawler(): void {
  void sdk().then((s) => {
    if (!s) return;
    s.describe({
      name: 'Crawler',
      does: 'Crawls a folder in the browser into a map, a full-text scrape and a graph, audits code projects, and converts PDFs, CSV, JSON, spreadsheets and audio — nothing is uploaded.',
      inputs: [
        { name: 'A folder', from: 'Browse (File Crawler, SCOPE Map, Project Audit, Regenerate) — File System Access, Chrome or Edge', kind: 'file' },
        { name: 'A file', from: 'drop or pick: PDF, CSV, JSON, spreadsheet, audio', kind: 'file' },
        { name: 'A web page', from: 'Web Scraper — the URL you type', kind: 'http' }
      ],
      outputs: [
        { name: 'MAP.txt, EVERYTHING.LOG, Crawl.log', to: 'downloads, one at a time or as a .zip', kind: 'file' },
        { name: 'Audit report, converted files, Markdown', to: 'downloads from each tool', kind: 'file' },
        { name: 'Graph and treemap', to: 'Visual Explorer and SCOPE Map on screen' }
      ],
      controls: [
        { name: 'Sidebar', how: 'picks the tool: File Crawler, Visual Explorer, Program Map, SCOPE Map, Project Audit, Extractor, Regenerate, Web Scraper, Hardware Auditor, Network Sweeper, the converters' },
        { name: 'Browse', how: 'grants read access to one folder' },
        { name: 'File types', how: 'tick the extensions the crawl reads (none ticked = all)' },
        { name: 'Start / Stop', how: 'runs or aborts the crawl' }
      ],
      problems: ['unsupported_browser', 'permission_denied', 'file_unreadable', 'bad_input', 'save_failed', 'fetch_failed']
    });
  });
}
