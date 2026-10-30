// The folder the export is served from: "" at crawler.like.audio, the deep
// APK.audio window path when built with CRAWLER_BASE_PATH (next.config.ts).
// Every hand-written URL into public/ starts with it.
export const BASE_PATH: string = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
