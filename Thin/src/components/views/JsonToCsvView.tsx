"use client";

import React, { useState } from "react";
import Papa from "papaparse";
import { Upload, FileCode2, Play, Download, TableProperties } from "lucide-react";
import { motion } from "framer-motion";

export function JsonToCsvView() {
  const [jsonData, setJsonData] = useState<any>(null);
  const [csvOutput, setCsvOutput] = useState<string>("");
  const [error, setError] = useState("");
  const [flattenArrays, setFlattenArrays] = useState(true);

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
        setCsvOutput("");
      } catch (err: any) {
        setError("Invalid JSON file: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  const flattenObject = (obj: any, prefix = ""): any => {
    return Object.keys(obj).reduce((acc: any, k: string) => {
      const pre = prefix.length ? prefix + "." : "";
      if (typeof obj[k] === "object" && obj[k] !== null && !Array.isArray(obj[k])) {
        Object.assign(acc, flattenObject(obj[k], pre + k));
      } else {
        acc[pre + k] = obj[k];
      }
      return acc;
    }, {});
  };

  const processJson = (data: any): any[] => {
    let arr = Array.isArray(data) ? data : [data];

    // Attempt to drill down if the root is an object containing a single array
    if (!Array.isArray(data) && typeof data === 'object') {
      const keys = Object.keys(data);
      if (keys.length === 1 && Array.isArray(data[keys[0]])) {
        arr = data[keys[0]];
      }
    }

    if (flattenArrays) {
      // Create repeating rows for nested arrays
      const result: any[] = [];
      const traverse = (currentObj: any, baseRow: any = {}) => {
        const row = { ...baseRow };
        let hasArray = false;
        let arrayKey = "";
        let arrayItems: any[] = [];

        for (const key in currentObj) {
          if (Array.isArray(currentObj[key])) {
            hasArray = true;
            arrayKey = key;
            arrayItems = currentObj[key];
            break; // Just handle one array per level for simplicity in repeating rows
          } else {
            row[key] = currentObj[key];
          }
        }

        if (hasArray) {
          arrayItems.forEach((item) => {
            const nestedBase = { ...row };
            if (typeof item === 'object' && item !== null) {
               traverse(item, nestedBase);
            } else {
               nestedBase[arrayKey] = item;
               result.push(flattenObject(nestedBase));
            }
          });
        } else {
          result.push(flattenObject(row));
        }
      };

      arr.forEach((item) => traverse(item));
      return result;
    } else {
      // Just flatten objects, leave arrays stringified
      return arr.map((item) => flattenObject(item));
    }
  };

  const generateCsv = () => {
    if (!jsonData) return;
    try {
      const processed = processJson(jsonData);
      const csv = Papa.unparse(processed);
      setCsvOutput(csv);
      setError("");
    } catch (err: any) {
      setError("Failed to convert to CSV: " + err.message);
    }
  };

  const downloadCsv = () => {
    if (!csvOutput) return;
    const blob = new Blob([csvOutput], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "converted.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full flex flex-col gap-6">
      <div className="w-full space-y-8">
        
        <header className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-white/10">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent drop-shadow-sm mb-2">
              JSON to CSV Converter
            </h1>
            <p className="text-slate-400">Flatten nested JSON into repeating rows and tabular CSV data.</p>
          </div>
          
          <div className="flex items-center gap-4">
            <label className="relative cursor-pointer group">
              <div className="absolute inset-0 bg-emerald-500/20 rounded-xl blur-lg transition-all group-hover:bg-emerald-500/40"></div>
              <div className="relative flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl shadow-lg transition-all border border-emerald-400/30 font-medium">
                <Upload size={18} />
                Upload JSON
              </div>
              <input type="file" accept=".json" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
        </header>

        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl">
            <span className="font-semibold">Error:</span> {error}
          </motion.div>
        )}

        {jsonData && (
          <div className="grid lg:grid-cols-2 gap-8">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 p-6 rounded-2xl shadow-xl">
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-4 text-emerald-300">
                  <TableProperties size={18} /> Conversion Settings
                </h3>
                
                <div className="flex items-center gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <input
                    type="checkbox"
                    id="flattenArrays"
                    checked={flattenArrays}
                    onChange={(e) => setFlattenArrays(e.target.checked)}
                    className="w-5 h-5 accent-emerald-500 rounded bg-slate-800 border-slate-700"
                  />
                  <label htmlFor="flattenArrays" className="text-slate-300 select-none flex flex-col cursor-pointer">
                    <span className="font-medium text-sm">Expand Arrays into Repeating Rows</span>
                    <span className="text-xs text-slate-500">Unpacks nested array objects into their own rows, repeating parent data.</span>
                  </label>
                </div>
              </div>

              <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 p-4 rounded-2xl shadow-xl flex flex-col h-[400px]">
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-2 text-slate-400">
                  Input JSON Preview
                </h3>
                <div className="flex-1 overflow-auto bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-300">
                  <pre>{JSON.stringify(jsonData, null, 2).slice(0, 2000)}{JSON.stringify(jsonData).length > 2000 ? "\n... (truncated)" : ""}</pre>
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col">
              <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-2xl shadow-xl flex flex-col h-[650px]">
                <div className="p-4 border-b border-white/5 flex items-center justify-between">
                  <h3 className="text-lg font-semibold flex items-center gap-2 text-emerald-300">
                    <FileCode2 size={18} /> CSV Output
                  </h3>
                  <div className="flex gap-3">
                    <button 
                      onClick={generateCsv}
                      className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      <Play size={14} className="text-emerald-400" /> Convert
                    </button>
                    {csvOutput && (
                      <button 
                        onClick={downloadCsv}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        <Download size={14} /> Download
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="p-4 flex-1 overflow-auto bg-slate-950/80 m-4 rounded-xl border border-slate-800 font-mono text-xs shadow-inner">
                  {csvOutput ? (
                    <pre className="text-emerald-300/90 leading-relaxed overflow-x-auto whitespace-pre">
                      {csvOutput.slice(0, 10000)}
                      {csvOutput.length > 10000 ? "\n... (preview truncated)" : ""}
                    </pre>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4">
                      <TableProperties size={48} className="opacity-20" />
                      <p>Adjust settings and click Convert to see the CSV</p>
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
