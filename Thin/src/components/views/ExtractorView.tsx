"use client";

import { useAppStore } from '@/store/useAppStore';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ExtractorView() {
  const { extractorText } = useAppStore();

  const downloadFile = () => {
    const blob = new Blob(['\uFEFF' + extractorText], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Extraction_${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full flex-1 flex flex-col space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <FileText className="w-8 h-8 text-amber-500" /> Extractor
          </h2>
          <p className="text-muted-foreground mt-1">Comments and Markdown files extracted from the crawler.</p>
        </div>
        {extractorText && (
          <Button onClick={downloadFile} variant="outline" className="gap-2">
            <Download className="w-4 h-4" /> Export MD
          </Button>
        )}
      </div>
      
      <Card className="flex-1 shadow-md border-border/50 bg-card/80 backdrop-blur-sm relative overflow-hidden rounded-2xl">
        <CardContent className="p-0 h-full">
          <div className="h-full w-full bg-[#0d0d12] p-6 overflow-y-auto font-mono text-sm absolute inset-0 whitespace-pre text-amber-400/90 leading-relaxed">
            {extractorText ? extractorText : <div className="text-muted-foreground/50 h-full flex items-center justify-center italic">No content extracted yet. Run a crawl first.</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
