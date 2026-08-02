"use client";

import React, { useState, useMemo, useEffect } from "react";
import Papa from "papaparse";
import { Upload, FileJson, Settings2, Play, Download, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Role = 
  | "Hierarchical Key"
  | "Sub Key"
  | "Simple Value"
  | "Value as Key"
  | "Key Name and Value"
  | "Skip";

interface HeaderConfig {
  originalHeader: string;
  jsonKey: string;
  role: Role;
  nestedUnder: string;
  partName: string;
}

export function CsvToJsonView() {
  const [csvData, setCsvData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [configs, setConfigs] = useState<Record<string, HeaderConfig>>({});
  const [rootKeyName, setRootKeyName] = useState("root");
  const [jsonOutput, setJsonOutput] = useState<any>(null);
  const [error, setError] = useState("");

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedHeaders = results.meta.fields || [];
        setHeaders(parsedHeaders);
        setCsvData(results.data);

        // Initialize configs
        const newConfigs: Record<string, HeaderConfig> = {};
        parsedHeaders.forEach((h) => {
          newConfigs[h] = {
            originalHeader: h,
            jsonKey: h,
            role: "Simple Value",
            nestedUnder: "root",
            partName: "parts",
          };
        });
        setConfigs(newConfigs);
        setJsonOutput(null);
        setError("");
      },
      error: (err) => {
        setError("Error parsing CSV: " + err.message);
      },
    });
  };

  const parentOptions = useMemo(() => {
    const parents = ["root"];
    Object.values(configs).forEach((c) => {
      if (["Hierarchical Key", "Value as Key", "Key Name and Value"].includes(c.role)) {
        parents.push(c.originalHeader);
      }
    });
    return parents;
  }, [configs]);

  const updateConfig = (header: string, updates: Partial<HeaderConfig>) => {
    setConfigs((prev) => {
      const next = { ...prev, [header]: { ...prev[header], ...updates } };
      
      // If role changed away from hierarchical, check if we need to reset nestedUnder for others
      const newRole = next[header].role;
      if (!["Hierarchical Key", "Value as Key", "Key Name and Value"].includes(newRole)) {
        Object.keys(next).forEach((k) => {
          if (next[k].nestedUnder === header) {
            next[k].nestedUnder = "root";
          }
        });
      }
      return next;
    });
  };

  const groupBy = (array: any[], key: string) => {
    return array.reduce((result: any, currentValue: any) => {
      const val = currentValue[key];
      (result[val] = result[val] || []).push(currentValue);
      return result;
    }, {});
  };

  const buildHierarchy = (rows: any[], parentKey: string): any[] => {
    const levelConfigs = Object.values(configs)
      .filter((c) => c.nestedUnder === parentKey && c.role !== "Skip")
      .sort((a, b) => headers.indexOf(a.originalHeader) - headers.indexOf(b.originalHeader));

    const firstGroupingConfig = levelConfigs.find((c) =>
      ["Hierarchical Key", "Value as Key", "Key Name and Value"].includes(c.role)
    );

    if (!firstGroupingConfig) {
      const outputList: any[] = [];
      const simpleConfigs = levelConfigs.filter((c) => ["Simple Value", "Sub Key"].includes(c.role));
      
      rows.forEach((row) => {
        const node: any = {};
        simpleConfigs.forEach((c) => {
          let val = row[c.originalHeader];
          if (val !== undefined && val !== "") {
            if (val === "true" || val === "True") val = true;
            if (val === "false" || val === "False") val = false;
            node[c.jsonKey] = val;
          }
        });
        if (Object.keys(node).length > 0) {
          outputList.push(node);
        }
      });
      return outputList;
    }

    const groupKey = firstGroupingConfig.originalHeader;
    const grouped = groupBy(rows, groupKey);
    const outputList: any[] = [];

    Object.entries(grouped).forEach(([keyValue, groupRows]: [string, any]) => {
      const node: any = {};
      let val: any = keyValue;
      if (val === "true" || val === "True") val = true;
      if (val === "false" || val === "False") val = false;

      if (firstGroupingConfig.role === "Value as Key") {
        const children = buildHierarchy(groupRows, groupKey);
        let mergedChildren = {};
        children.forEach((c) => {
          mergedChildren = { ...mergedChildren, ...c };
        });
        node[val as string] = mergedChildren;
      } else if (firstGroupingConfig.role === "Hierarchical Key") {
        node[firstGroupingConfig.jsonKey] = val;
        node[firstGroupingConfig.partName] = buildHierarchy(groupRows, groupKey);
      } else if (firstGroupingConfig.role === "Key Name and Value") {
        node[firstGroupingConfig.jsonKey] = {
          [firstGroupingConfig.partName]: val,
          parts: buildHierarchy(groupRows, groupKey),
        };
      }
      outputList.push(node);
    });

    return outputList;
  };

  const generateJson = () => {
    if (!csvData.length) return;
    setError("");
    
    try {
      const finalJson = {
        [rootKeyName]: buildHierarchy(csvData, "root"),
      };
      setJsonOutput(finalJson);
    } catch (e: any) {
      setError("Failed to generate JSON: " + e.message);
    }
  };

  const downloadJson = () => {
    if (!jsonOutput) return;
    const blob = new Blob([JSON.stringify(jsonOutput, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "output.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full flex flex-col gap-6">
      <div className="w-full space-y-8">
        
        {/* Header Section */}
        <header className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-white/10">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent drop-shadow-sm mb-2">
              CSV to JSON Converter
            </h1>
            <p className="text-slate-400">Transform tabular data into rich, nested JSON structures with ease.</p>
          </div>
          
          <div className="flex items-center gap-4">
            <label className="relative cursor-pointer group">
              <div className="absolute inset-0 bg-indigo-500/20 rounded-xl blur-lg transition-all group-hover:bg-indigo-500/40"></div>
              <div className="relative flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl shadow-lg transition-all border border-indigo-400/30 font-medium">
                <Upload size={18} />
                Upload CSV
              </div>
              <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
        </header>

        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl flex items-center gap-3">
            <span className="font-semibold">Error:</span> {error}
          </motion.div>
        )}

        {headers.length > 0 && (
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Configuration Column */}
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              
              {/* Global Config */}
              <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 p-6 rounded-2xl shadow-xl">
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-4 text-indigo-300">
                  <Settings2 size={18} /> Global Settings
                </h3>
                <div className="flex flex-col gap-2">
                  <label className="text-sm text-slate-400 font-medium">Root Key Name</label>
                  <input
                    type="text"
                    value={rootKeyName}
                    onChange={(e) => setRootKeyName(e.target.value)}
                    className="bg-slate-950 border border-slate-800 text-slate-200 px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                  />
                </div>
              </div>

              {/* Column Configs */}
              <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 p-6 rounded-2xl shadow-xl">
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-6 text-indigo-300">
                  Column Configurations
                </h3>
                
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  <AnimatePresence>
                    {headers.map((header) => {
                      const config = configs[header];
                      if (!config) return null;
                      const needsPartName = ["Hierarchical Key", "Key Name and Value"].includes(config.role);

                      return (
                        <motion.div 
                          key={header}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-slate-950/50 border border-slate-800/80 p-4 rounded-xl hover:border-indigo-500/30 transition-colors"
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <span className="bg-indigo-500/20 text-indigo-300 px-2.5 py-1 rounded-md text-xs font-bold font-mono tracking-wider">
                              {header}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-xs text-slate-400 mb-1 block">JSON Key Name</label>
                              <input
                                type="text"
                                value={config.jsonKey}
                                onChange={(e) => updateConfig(header, { jsonKey: e.target.value })}
                                className="w-full bg-slate-900 border border-slate-800 text-sm px-3 py-1.5 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-slate-400 mb-1 block">Role</label>
                              <select
                                value={config.role}
                                onChange={(e) => updateConfig(header, { role: e.target.value as Role })}
                                className="w-full bg-slate-900 border border-slate-800 text-sm px-3 py-1.5 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                              >
                                <option>Simple Value</option>
                                <option>Hierarchical Key</option>
                                <option>Sub Key</option>
                                <option>Value as Key</option>
                                <option>Key Name and Value</option>
                                <option>Skip</option>
                              </select>
                            </div>
                            
                            {config.role !== "Skip" && (
                              <div>
                                <label className="text-xs text-slate-400 mb-1 block">Nested Under</label>
                                <select
                                  value={config.nestedUnder}
                                  onChange={(e) => updateConfig(header, { nestedUnder: e.target.value })}
                                  className="w-full bg-slate-900 border border-slate-800 text-sm px-3 py-1.5 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                                >
                                  {parentOptions.map((p) => (
                                    <option key={p} value={p}>{p}</option>
                                  ))}
                                </select>
                              </div>
                            )}

                            {needsPartName && (
                              <div>
                                <label className="text-xs text-slate-400 mb-1 block">Part Name</label>
                                <input
                                  type="text"
                                  value={config.partName}
                                  onChange={(e) => updateConfig(header, { partName: e.target.value })}
                                  className="w-full bg-slate-900 border border-slate-800 text-sm px-3 py-1.5 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                                  placeholder="e.g. parts"
                                />
                              </div>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>

            {/* Preview Column */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col">
              <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-2xl shadow-xl flex flex-col h-[700px]">
                <div className="p-4 border-b border-white/5 flex items-center justify-between">
                  <h3 className="text-lg font-semibold flex items-center gap-2 text-purple-300">
                    <FileJson size={18} /> JSON Output
                  </h3>
                  <div className="flex gap-3">
                    <button 
                      onClick={generateJson}
                      className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      <Play size={14} className="text-emerald-400" /> Generate
                    </button>
                    {jsonOutput && (
                      <button 
                        onClick={downloadJson}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        <Download size={14} /> Download
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="p-4 flex-1 overflow-auto bg-slate-950/80 m-4 rounded-xl border border-slate-800 font-mono text-sm shadow-inner">
                  {jsonOutput ? (
                    <pre className="text-emerald-300/90 leading-relaxed">
                      {JSON.stringify(jsonOutput, null, 2)}
                    </pre>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4">
                      <FileJson size={48} className="opacity-20" />
                      <p>Configure columns and click Generate to preview JSON</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
        
        {!headers.length && !error && (
          <div className="mt-16 bg-slate-900/30 border border-slate-800/50 rounded-3xl p-16 text-center max-w-3xl mx-auto shadow-2xl flex flex-col items-center gap-6">
            <div className="w-24 h-24 bg-indigo-500/10 rounded-full flex items-center justify-center">
              <Upload size={40} className="text-indigo-400" />
            </div>
            <h2 className="text-2xl font-semibold text-slate-200">Start by uploading a CSV file</h2>
            <p className="text-slate-400 max-w-md">Your file is processed entirely in your browser. No data is sent to our servers.</p>
          </div>
        )}

      </div>
    </div>
  );
}
