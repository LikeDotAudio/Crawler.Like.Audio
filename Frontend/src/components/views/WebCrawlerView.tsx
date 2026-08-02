"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Globe, Download, Play, SearchCode } from 'lucide-react';
import { useState } from 'react';
import TurndownService from 'turndown';

export function WebCrawlerView() {
  const [url, setUrl] = useState('');
  const [output, setOutput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleScrape = async () => {
    if (!url) return;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      setError('URL must start with http:// or https://');
      return;
    }
    
    setError('');
    setIsLoading(true);
    
    try {
      console.log(`[Scraper] Starting scrape for URL: ${url}`);
      // Using allorigins as a public CORS proxy for demonstration
      const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
      
      console.log(`[Scraper] Proxy response status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`[Scraper] Proxy data received, contents length: ${data.contents?.length || 0}`);
        const html = data.contents;
        
        // Parse HTML and convert to clean Markdown
        const doc = new DOMParser().parseFromString(html, 'text/html');
        
        // Remove scripts, styles, and often noisy elements
        doc.querySelectorAll('script, style, noscript, iframe, svg, nav, footer, header').forEach(el => el.remove());
        
        const turndownService = new TurndownService({
          headingStyle: 'atx',
          codeBlockStyle: 'fenced',
          bulletListMarker: '-',
          hr: '---'
        });
        
        // Remove empty links or useless span wrappers if needed, but Turndown is usually smart enough
        const markdown = turndownService.turndown(doc.body);
        
        console.log(`[Scraper] Extraction successful. Markdown length: ${markdown.length}`);
        setOutput(`Scraping: ${url}\n\n${markdown}`);
      } else {
        console.error(`[Scraper Error] Proxy returned status: ${response.status} ${response.statusText}`);
        setError('Failed to fetch the URL via proxy.');
      }
    } catch (e) {
      console.error("[Scraper Exception]", e);
      setError('An error occurred during scraping.');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadFile = () => {
    const blob = new Blob(['\uFEFF' + output], { type: 'text/markdown;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `scraped_content.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  };

  return (
    <div className="w-full flex-1 flex flex-col space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Web Scraper</h2>
        <p className="text-muted-foreground mt-1">Extract text content from any public URL into Markdown.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 shadow-md border-border/50 bg-card/80 backdrop-blur-sm h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Globe className="w-5 h-5" /> Target URL
            </CardTitle>
            <CardDescription>Enter a website URL to extract its textual content.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <input 
                type="text" 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors" 
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isLoading}
              />
            </div>
            
            {error && <div className="text-red-400 text-xs font-semibold">{error}</div>}
            
            <Button onClick={handleScrape} className="w-full gap-2 shadow-lg shadow-primary/20" disabled={isLoading || !url}>
              <Play className={`w-4 h-4 ${isLoading ? 'animate-pulse' : ''}`} /> 
              {isLoading ? 'Extracting...' : 'Start Scrape'}
            </Button>

            {output && (
              <Button onClick={downloadFile} variant="secondary" className="w-full gap-2 mt-2">
                <Download className="w-4 h-4" /> Download Markdown
              </Button>
            )}
          </CardContent>
        </Card>
        
        <Card className="md:col-span-2 shadow-md border-border/50 bg-card/80 backdrop-blur-sm flex flex-col h-[600px]">
          <CardHeader className="border-b border-border/50 bg-muted/30 pb-4">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <SearchCode className="w-4 h-4 text-muted-foreground" /> Extracted Output
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <textarea 
              readOnly 
              className="h-full w-full bg-[#0d0d12] text-slate-300 p-4 font-mono text-sm resize-none focus:outline-none"
              value={output || "No content extracted yet. Enter a URL and click Start Scrape."}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
