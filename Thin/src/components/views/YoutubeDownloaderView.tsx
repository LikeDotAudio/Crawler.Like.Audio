"use client";

import React, { useState } from "react";
import { PlayCircle, Download, Film, Headphones, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function YoutubeDownloaderView() {
  const [url, setUrl] = useState("");
  const [type, setType] = useState<"video" | "audio">("video");
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    if (!url) return;
    
    // Basic validation
    if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
      setError("Please enter a valid YouTube URL.");
      return;
    }

    setError(null);
    const format = type === "video" ? "1080" : "mp3";
    // Using an awesome free downloader widget that bypasses CORS natively!
    setIframeUrl(`https://loader.to/api/button/?url=${encodeURIComponent(url)}&f=${format}&color=0ea5e9`);
  };

  return (
    <div className="w-full flex flex-col gap-6 h-full max-w-4xl mx-auto">
      <header className="flex flex-col md:flex-row items-center justify-between gap-6 pb-4 border-b border-white/10 shrink-0">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3 mb-2">
            <PlayCircle className="w-8 h-8 text-primary" /> Media Link Downloader
          </h2>
          <p className="text-muted-foreground mt-1">Download YouTube videos as high-quality MP4 movies or MP3 audio.</p>
        </div>
      </header>

      <div className="flex-1 bg-slate-900/30 border border-slate-800/50 rounded-3xl p-8 shadow-2xl flex flex-col gap-8">
        
        {/* URL Input */}
        <div className="space-y-3">
          <label className="text-sm font-semibold text-slate-300 ml-1 uppercase tracking-wider">YouTube URL</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <PlayCircle className="w-5 h-5 text-slate-500" />
            </div>
            <input
              type="text"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setIframeUrl(null); }}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-lg px-4 py-4 pl-12 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-inner"
            />
          </div>
        </div>

        {/* Format Selection */}
        <div className="space-y-3">
          <label className="text-sm font-semibold text-slate-300 ml-1 uppercase tracking-wider">Format</label>
          <div className="grid grid-cols-2 gap-4">
            <div 
              onClick={() => { setType("video"); setIframeUrl(null); }}
              className={`cursor-pointer border-2 rounded-xl p-4 flex flex-col items-center gap-3 transition-all ${
                type === "video" 
                ? 'border-primary bg-primary/10 shadow-[0_0_15px_rgba(var(--primary),0.2)]' 
                : 'border-slate-800 bg-slate-950/50 hover:border-slate-700'
              }`}
            >
              <div className={`p-3 rounded-full ${type === "video" ? 'bg-primary/20 text-primary' : 'bg-slate-800 text-slate-400'}`}>
                <Film className="w-6 h-6" />
              </div>
              <div className="text-center">
                <div className={`font-bold ${type === "video" ? 'text-primary' : 'text-slate-300'}`}>Movie (MP4)</div>
                <div className="text-xs text-slate-500 mt-1">Best available video & audio quality</div>
              </div>
            </div>

            <div 
              onClick={() => { setType("audio"); setIframeUrl(null); }}
              className={`cursor-pointer border-2 rounded-xl p-4 flex flex-col items-center gap-3 transition-all ${
                type === "audio" 
                ? 'border-primary bg-primary/10 shadow-[0_0_15px_rgba(var(--primary),0.2)]' 
                : 'border-slate-800 bg-slate-950/50 hover:border-slate-700'
              }`}
            >
              <div className={`p-3 rounded-full ${type === "audio" ? 'bg-primary/20 text-primary' : 'bg-slate-800 text-slate-400'}`}>
                <Headphones className="w-6 h-6" />
              </div>
              <div className="text-center">
                <div className={`font-bold ${type === "audio" ? 'text-primary' : 'text-slate-300'}`}>Audio Only (MP3)</div>
                <div className="text-xs text-slate-500 mt-1">Extracted high-quality audio stream</div>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl flex items-center gap-3 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="pt-4 mt-auto border-t border-slate-800/50">
          {iframeUrl ? (
            <div className="w-full h-[60px] rounded-xl overflow-hidden shadow-2xl relative bg-slate-950 border border-slate-800">
              <iframe 
                src={iframeUrl} 
                style={{ width: '100%', height: '60px', border: '0', overflow: 'hidden' }} 
                scrolling="no" 
                title="Download Widget"
              />
            </div>
          ) : (
            <Button
              onClick={handleDownload}
              disabled={!url}
              className={`w-full py-6 text-lg font-bold rounded-xl flex items-center justify-center gap-3 transition-all bg-primary hover:bg-primary/90 text-[#0a2540] shadow-[0_0_20px_rgba(var(--primary),0.3)] hover:scale-[1.02]`}
            >
              <Download className="w-6 h-6" />
              Prepare {type === 'video' ? 'Movie' : 'Audio'} Download
            </Button>
          )}
          <p className="text-center text-xs text-slate-500 mt-4">
            Downloads are processed entirely through a secure third-party CORS-proxy widget natively in your browser. No backend server required!
          </p>
        </div>

      </div>
    </div>
  );
}
