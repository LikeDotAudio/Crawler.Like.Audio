"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileType, Upload, Download, FileText } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

export function PdfToMdView() {
  const [output, setOutput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Configure worker for pdfjs-dist
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processFile(file);
  };

  const processFile = async (file: File) => {
    if (file.type !== 'application/pdf') {
      alert('Please upload a valid PDF file.');
      return;
    }

    setFileName(file.name);
    setIsLoading(true);
    setOutput('');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let fullText = `# Extracted from ${file.name}\n\n`;
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += `## Page ${i}\n\n${pageText}\n\n`;
      }
      
      setOutput(fullText);
    } catch (err) {
      console.error(err);
      setOutput('Failed to extract text from PDF. The file might be corrupted or protected.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const downloadFile = () => {
    // Add UTF-8 BOM (\uFEFF) to ensure Windows Notepad reads it as UTF-8
    const blob = new Blob(['\uFEFF' + output], { type: 'text/markdown;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `${fileName.replace('.pdf', '')}_extracted.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  };

  return (
    <div className="w-full flex-1 flex flex-col space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">PDF to Markdown</h2>
        <p className="text-muted-foreground mt-1">Extract clean text strings from PDF documents using WebAssembly.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 shadow-md border-border/50 bg-card/80 backdrop-blur-sm h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <FileType className="w-5 h-5" /> PDF Parser
            </CardTitle>
            <CardDescription>Upload a PDF document to begin extraction locally.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`w-full h-32 rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors ${
                isDragging ? 'border-primary bg-primary/20' : 'border-primary/50 hover:bg-primary/10 bg-transparent text-primary'
              }`}
            >
              <input 
                type="file" 
                accept=".pdf" 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleFileChange}
              />
              <Upload className={`w-8 h-8 mb-2 ${isLoading ? 'animate-bounce' : ''}`} /> 
              <span className="font-semibold text-sm">
                {isLoading ? 'Parsing PDF...' : isDragging ? 'Drop PDF here' : 'Drag & Drop PDF or Click to Select'}
              </span>
            </div>
            
            {fileName && (
              <div className="text-xs text-center text-muted-foreground font-mono truncate px-2">
                Loaded: {fileName}
              </div>
            )}

            {output && (
              <Button onClick={downloadFile} variant="secondary" className="w-full gap-2 mt-4">
                <Download className="w-4 h-4" /> Download Markdown
              </Button>
            )}
          </CardContent>
        </Card>
        
        <Card className="md:col-span-2 shadow-md border-border/50 bg-card/80 backdrop-blur-sm flex flex-col h-[600px]">
          <CardHeader className="border-b border-border/50 bg-muted/30 pb-4">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <FileText className="w-4 h-4 text-muted-foreground" /> Extracted Markdown
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <textarea 
              readOnly 
              className="h-full w-full bg-[#0d0d12] text-slate-300 p-4 font-mono text-sm resize-none focus:outline-none"
              value={output || "No document loaded. Select a PDF file to extract text."}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
