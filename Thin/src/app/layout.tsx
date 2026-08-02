import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Crawler.like.audio",
  description: "Modernized web interface for Crawler with Visual Explorer",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col text-foreground font-sans" suppressHydrationWarning>
        <Script id="tree-sitter-loader" type="module" strategy="beforeInteractive" dangerouslySetInnerHTML={{
          __html: `
            import { Parser, Language } from '/web-tree-sitter.js';
            Parser.Language = Language;
            window.TreeSitter = Parser;
          `
        }} />
        {children}
      </body>
    </html>
  );
}
