// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
//
// The one place Thin reaches a web page. Until 2026-10-30 the Web Scraper view
// sent every URL to the public api.allorigins.win proxy, so a third party saw
// (and could rewrite) everything scraped. Now the browser fetches the page
// itself: it works for any site that allows cross-origin reads (CORS), and a
// site that does not is reported as such instead of being routed through
// someone else's server. A proxy of our own would be another Fetcher.
//
// No imports and erasable TypeScript only: node --test loads this file directly.

export interface FetchedPage { url: string; status: number; contentType: string; text: string }

export interface Fetcher { fetchText(url: string): Promise<FetchedPage> }

export class CorsBlockedError extends Error {
  url: string;
  constructor(url: string) {
    super(`The browser could not read ${url}: the site does not allow cross-origin reads (CORS), or it is unreachable. Save the page and use a local tool (Thick's Web Crawler) instead.`);
    this.name = 'CorsBlockedError';
    this.url = url;
  }
}

export class HttpStatusError extends Error {
  status: number;
  constructor(url: string, status: number) {
    super(`${url} answered HTTP ${status}.`);
    this.name = 'HttpStatusError';
    this.status = status;
  }
}

export function assertWebUrl(url: string): URL {
  const parsed = new URL(url);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('URL must start with http:// or https://');
  return parsed;
}

/** Direct, credential-less CORS fetch. `fetchImpl` is for tests. */
export function directFetcher(fetchImpl?: typeof fetch): Fetcher {
  return {
    async fetchText(url: string): Promise<FetchedPage> {
      assertWebUrl(url);
      let response: Response;
      try {
        const doFetch = fetchImpl ?? globalThis.fetch.bind(globalThis);
        response = await doFetch(url, { mode: 'cors', credentials: 'omit', redirect: 'follow' });
      } catch {
        // fetch rejects with an opaque TypeError for CORS refusals and network failures alike
        throw new CorsBlockedError(url);
      }
      if (!response.ok) throw new HttpStatusError(url, response.status);
      return {
        url: response.url || url,
        status: response.status,
        contentType: response.headers.get('content-type') ?? '',
        text: await response.text(),
      };
    },
  };
}

export const fetcher: Fetcher = directFetcher();
