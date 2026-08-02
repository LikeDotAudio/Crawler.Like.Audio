"use client";

import { useAppStore } from '@/store/useAppStore';
import { Card, CardContent } from '@/components/ui/card';
import { FolderTree } from 'lucide-react';

export function ProgramMapView() {
  const { mapText } = useAppStore();

  return (
    <div className="w-full flex-1 flex flex-col space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
          <FolderTree className="w-8 h-8 text-primary" /> Program Map
        </h2>
        <p className="text-muted-foreground mt-1">Text-based directory structure mapping of your analyzed codebase.</p>
      </div>
      
      <Card className="flex-1 shadow-md border-border/50 bg-card/80 backdrop-blur-sm relative overflow-hidden rounded-2xl">
        <CardContent className="p-0 h-full">
          <div className="h-full w-full bg-[#0d0d12] p-6 overflow-y-auto font-mono text-sm absolute inset-0 whitespace-pre text-green-400/90 leading-relaxed">
            {mapText ? mapText : <div className="text-muted-foreground/50 h-full flex items-center justify-center italic">No map generated yet. Run a crawl first.</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
