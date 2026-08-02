"use client";

import { useAppStore } from '@/store/useAppStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FileCode2, CheckSquare, Square } from 'lucide-react';
import { useState, useEffect } from 'react';

export function FileTypeSelector() {
  const { fileCategories, toggleExtension, toggleCategory, toggleAllCategories } = useAppStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="h-48 flex items-center justify-center text-muted-foreground">Loading file types...</div>;

  return (
    <Card className="w-full shadow-md border-border/50 bg-card/80 backdrop-blur-sm mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <CardHeader className="border-b border-border/50 bg-muted/30 pb-4 flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-sm font-bold text-primary uppercase tracking-wider pt-1.5">
          <FileCode2 className="w-4 h-4" /> Discovered File Types
        </CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => toggleAllCategories(true)} className="h-8 text-xs gap-2 bg-background/50 hover:bg-background">
            <CheckSquare className="w-3 h-3" /> Select All
          </Button>
          <Button variant="outline" size="sm" onClick={() => toggleAllCategories(false)} className="h-8 text-xs gap-2 bg-background/50 hover:bg-background">
            <Square className="w-3 h-3" /> Deselect All
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-8 gap-y-10">
          {fileCategories.map((category) => {
            const totalSize = category.extensions.reduce((acc, ext) => acc + (ext.selected ? ext.sizeMB : 0), 0);
            const allSelected = category.extensions.length > 0 && category.extensions.every(ext => ext.selected);
            
            return (
              <div key={category.name} className="flex flex-col space-y-4">
                <div className="space-y-3">
                  <h3 className="font-bold text-primary text-xs tracking-widest uppercase">
                    {category.name}
                  </h3>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full h-8 text-xs bg-muted/20 border-border/50 hover:bg-muted"
                    onClick={() => toggleCategory(category.name, !allSelected)}
                  >
                    {allSelected ? 'DESELECT' : 'SELECT'} [{totalSize.toFixed(2)}MB]
                  </Button>
                </div>
                
                <div className="space-y-2.5">
                  {category.extensions.map((ext) => (
                    <div key={ext.ext} className="flex items-center space-x-2 group">
                      <Checkbox 
                        id={`${category.name}-${ext.ext}`} 
                        checked={ext.selected}
                        onCheckedChange={() => toggleExtension(category.name, ext.ext)}
                        className="w-4 h-4 rounded-sm border-muted-foreground/40 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                      <label 
                        htmlFor={`${category.name}-${ext.ext}`}
                        className="text-xs font-mono flex-1 cursor-pointer select-none group-hover:text-primary transition-colors flex justify-between items-center"
                      >
                        <span className="text-foreground font-semibold">{ext.ext} <span className="text-muted-foreground font-normal">({ext.count})</span></span>
                        <span className={`${ext.selected ? 'text-green-400' : 'text-muted-foreground'} ml-2`}>
                          [{ext.sizeMB.toFixed(2)}MB]
                        </span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
