"use client";

import React, { useState } from "react";
import { Upload, FileJson, Copy, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { prettyPrintJson } from "@/lib/utils";

export function JsonPrettyPrintView() {
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        setInputText(text);
        formatJson(text);
      } catch (err: any) {
        setError("Error reading file: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  const formatJson = (text: string) => {
    try {
      if (!text.trim()) {
        setOutputText("");
        setError("");
        return;
      }
      const formatted = prettyPrintJson(text);
      // verify it actually parses to check for invalid json error
      JSON.parse(text); 
      setOutputText(formatted);
      setError("");
    } catch (err: any) {
      setError("Invalid JSON: " + err.message);
      setOutputText(prettyPrintJson(text)); // still try to format if we can or just show raw
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setInputText(text);
    formatJson(text);
  };

  const copyToClipboard = () => {
    if (!outputText) return;
    navigator.clipboard.writeText(outputText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full flex flex-col gap-6">
      <div className="w-full space-y-8">
        
        <header className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-white/10">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent drop-shadow-sm mb-2">
              JSON Pretty Printer
            </h1>
            <p className="text-slate-400">Format and beautify your raw JSON data.</p>
          </div>
          
          <div className="flex items-center gap-4">
            <label className="relative cursor-pointer group">
              <div className="absolute inset-0 bg-violet-500/20 rounded-xl blur-lg transition-all group-hover:bg-violet-500/40"></div>
              <div className="relative flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-6 py-3 rounded-xl shadow-lg transition-all border border-violet-400/30 font-medium">
                <Upload size={18} />
                Upload JSON
              </div>
              <input type="file" accept=".json,txt" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
        </header>

        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl">
            <span className="font-semibold">Error:</span> {error}
          </motion.div>
        )}

        <div className="grid lg:grid-cols-2 gap-8">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col h-[600px]">
            <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-2xl shadow-xl flex flex-col h-full">
              <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2 text-slate-300">
                  <FileJson size={18} /> Raw JSON Input
                </h3>
              </div>
              <textarea
                value={inputText}
                onChange={handleInputChange}
                placeholder="Paste your raw, minified JSON here..."
                className="flex-1 w-full bg-transparent p-4 resize-none outline-none font-mono text-sm text-slate-300 placeholder:text-slate-600"
              />
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col h-[600px]">
            <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-2xl shadow-xl flex flex-col h-full">
              <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2 text-violet-300">
                  <FileJson size={18} /> Formatted Output
                </h3>
                {outputText && (
                  <button 
                    onClick={copyToClipboard}
                    className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                  >
                    {copied ? <CheckCircle2 size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    {copied ? "Copied!" : "Copy"}
                  </button>
                )}
              </div>
              
              <div className="flex-1 overflow-auto bg-slate-950/80 m-4 rounded-xl border border-slate-800 font-mono text-sm shadow-inner p-4">
                {outputText ? (
                  <pre className="text-violet-300/90 leading-relaxed">
                    {outputText}
                  </pre>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-4">
                    <FileJson size={48} className="opacity-20" />
                    <p>Beautiful JSON will appear here</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
