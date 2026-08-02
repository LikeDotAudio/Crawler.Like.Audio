"use client";

import React, { useState } from "react";
import * as jsyaml from "js-yaml";
import { json2xml } from "xml-js";
import { Upload, FileCode2, Play, Download, CodeXml } from "lucide-react";
import { motion } from "framer-motion";

export function JsonConverterView() {
  const [jsonData, setJsonData] = useState<any>(null);
  const [yamlOutput, setYamlOutput] = useState<string>("");
  const [xmlOutput, setXmlOutput] = useState<string>("");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"yaml" | "xml">("yaml");

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);
        setJsonData(parsed);
        setError("");
        setYamlOutput("");
        setXmlOutput("");
      } catch (err: any) {
        setError("Invalid JSON file: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  const convertData = () => {
    if (!jsonData) return;
    try {
      const yamlStr = jsyaml.dump(jsonData);
      setYamlOutput(yamlStr);

      const xmlStr = json2xml(JSON.stringify(jsonData), { compact: true, spaces: 4 });
      setXmlOutput(xmlStr);
      setError("");
    } catch (err: any) {
      setError("Failed to convert: " + err.message);
    }
  };

  const downloadOutput = () => {
    const output = activeTab === "yaml" ? yamlOutput : xmlOutput;
    if (!output) return;
    const blob = new Blob([output], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `converted.${activeTab}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  React.useEffect(() => {
    convertData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jsonData]);

  return (
    <div className="w-full flex flex-col gap-6">
      <div className="w-full space-y-8">
        
        <header className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-white/10">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3 mb-2">
              <FileCode2 className="w-8 h-8 text-primary" /> JSON format Converter
            </h2>
            <p className="text-muted-foreground mt-1">Convert JSON structures flawlessly into YAML or XML.</p>
          </div>
          
          <div className="flex items-center gap-4">
            <label className="relative cursor-pointer group">
              <div className="absolute inset-0 bg-orange-500/20 rounded-xl blur-lg transition-all group-hover:bg-orange-500/40"></div>
              <div className="relative flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white px-6 py-3 rounded-xl shadow-lg transition-all border border-orange-400/30 font-medium">
                <Upload size={18} />
                Upload JSON
              </div>
              <input type="file" accept=".json" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
        </header>

        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl flex items-center gap-3">
            <span className="font-semibold">Error:</span> {error}
          </motion.div>
        )}

        {jsonData && (
          <div className="grid lg:grid-cols-2 gap-8">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 p-4 rounded-2xl shadow-xl flex flex-col h-[650px]">
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-2 text-slate-400 p-2">
                  Input JSON Preview
                </h3>
                <div className="flex-1 overflow-auto bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 shadow-inner">
                  <pre>{JSON.stringify(jsonData, null, 2).slice(0, 3000)}{JSON.stringify(jsonData).length > 3000 ? "\n... (truncated)" : ""}</pre>
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col">
              <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-2xl shadow-xl flex flex-col h-[650px]">
                <div className="p-4 border-b border-white/5 flex items-center justify-between">
                  <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
                    <button 
                      onClick={() => setActiveTab('yaml')}
                      className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${activeTab === 'yaml' ? 'bg-orange-500/20 text-orange-400' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      YAML
                    </button>
                    <button 
                      onClick={() => setActiveTab('xml')}
                      className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${activeTab === 'xml' ? 'bg-orange-500/20 text-orange-400' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      XML
                    </button>
                  </div>
                  <div className="flex gap-3">
                    {(activeTab === 'yaml' ? yamlOutput : xmlOutput) && (
                      <button 
                        onClick={downloadOutput}
                        className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        <Download size={14} /> Download
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="p-4 flex-1 overflow-auto bg-slate-950/80 m-4 rounded-xl border border-slate-800 font-mono text-xs shadow-inner">
                  {(activeTab === 'yaml' ? yamlOutput : xmlOutput) ? (
                    <pre className="text-orange-300/90 leading-relaxed overflow-x-auto whitespace-pre">
                      {activeTab === 'yaml' ? yamlOutput : xmlOutput}
                    </pre>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4">
                      <CodeXml size={48} className="opacity-20" />
                      <p>Click Convert to generate {activeTab.toUpperCase()}</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
