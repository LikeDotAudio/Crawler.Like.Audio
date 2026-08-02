"use client";

import React, { useState } from "react";
import Papa from "papaparse";
import * as jsyaml from "js-yaml";
import { json2xml } from "xml-js";
import * as XLSX from "xlsx";
import { Upload, FileCode2, Download, TableProperties, CodeXml, LayoutList, Table, FileJson } from "lucide-react";
import { motion } from "framer-motion";

export function JsonToCsvView() {
  const [jsonData, setJsonData] = useState<any>(null);
  const [csvOutput, setCsvOutput] = useState<string>("");
  const [yamlOutput, setYamlOutput] = useState<string>("");
  const [xmlOutput, setXmlOutput] = useState<string>("");
  const [jsonOutput, setJsonOutput] = useState<string>("");
  const [processedData, setProcessedData] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"csv" | "excel" | "yaml" | "xml" | "json">("csv");
  const [viewMode, setViewMode] = useState<"raw" | "table">("raw");
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
      setProcessedData(processed);
      const csv = Papa.unparse(processed);
      setCsvOutput(csv);
      setYamlOutput(jsyaml.dump(jsonData));
      setXmlOutput(json2xml(JSON.stringify(jsonData), { compact: true, spaces: 4 }));
      setJsonOutput(JSON.stringify(jsonData, null, 2));
      setError("");
    } catch (err: any) {
      setError("Failed to convert: " + err.message);
    }
  };

  const downloadOutput = () => {
    if (activeTab === "excel") {
      const ws = XLSX.utils.json_to_sheet(processedData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Data");
      XLSX.writeFile(wb, "converted.xlsx");
      return;
    }

    let data = "";
    let ext = "";
    let type = "";
    if (activeTab === "csv") {
      data = csvOutput;
      ext = "csv";
      type = "text/csv";
    } else if (activeTab === "yaml") {
      data = yamlOutput;
      ext = "yaml";
      type = "text/plain";
    } else if (activeTab === "xml") {
      data = xmlOutput;
      ext = "xml";
      type = "text/plain";
    } else if (activeTab === "json") {
      data = jsonOutput;
      ext = "json";
      type = "application/json";
    }
    
    if (!data) return;
    const blob = new Blob([data], { type: `${type};charset=utf-8;` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `converted.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  React.useEffect(() => {
    generateCsv();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jsonData, flattenArrays]);

  return (
    <div className="w-full flex flex-col gap-6">
      <div className="w-full space-y-8">
        
        <header className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-white/10">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3 mb-2">
              <FileJson className="w-8 h-8 text-primary" /> JSON Importer & Shuffler
            </h2>
            <p className="text-muted-foreground mt-1">Import JSON and shuffle it into CSV, YAML, XML, or Pretty JSON.</p>
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
                  <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
                    <button 
                      onClick={() => setActiveTab('csv')}
                      className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${activeTab === 'csv' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      CSV
                    </button>
                    <button 
                      onClick={() => { setActiveTab('excel'); setViewMode('table'); }}
                      className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${activeTab === 'excel' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      Excel
                    </button>
                    <button 
                      onClick={() => setActiveTab('yaml')}
                      className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${activeTab === 'yaml' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      YAML
                    </button>
                    <button 
                      onClick={() => setActiveTab('xml')}
                      className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${activeTab === 'xml' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      XML
                    </button>
                    <button 
                      onClick={() => setActiveTab('json')}
                      className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${activeTab === 'json' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      JSON
                    </button>
                  </div>
                  <div className="flex gap-3 items-center">
                    {(activeTab === 'csv' || activeTab === 'excel') && (
                      <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800 mr-2">
                        <button
                          onClick={() => setViewMode('raw')}
                          className={`p-1.5 rounded-md transition-colors ${viewMode === 'raw' ? 'bg-slate-800 text-slate-200' : 'text-slate-500 hover:text-slate-300'}`}
                          title="Raw Text View"
                        >
                          <LayoutList size={16} />
                        </button>
                        <button
                          onClick={() => setViewMode('table')}
                          className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-slate-800 text-slate-200' : 'text-slate-500 hover:text-slate-300'}`}
                          title="Table View"
                        >
                          <Table size={16} />
                        </button>
                      </div>
                    )}
                    {jsonData && (
                      <button 
                        onClick={downloadOutput}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        <Download size={14} /> Download {activeTab.toUpperCase()}
                      </button>
                    )}
                  </div>
                </div>
                
                <div className={`p-4 flex-1 overflow-auto m-4 rounded-xl border border-slate-800 shadow-inner ${viewMode === 'table' && (activeTab === 'csv' || activeTab === 'excel') ? 'bg-slate-900/40' : 'bg-slate-950/80 font-mono text-xs'}`}>
                  {jsonData ? (
                    viewMode === 'table' && (activeTab === 'csv' || activeTab === 'excel') ? (
                      processedData.length > 0 ? (
                        <table className="w-full text-left text-xs text-slate-300">
                          <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                            <tr>
                              {Object.keys(processedData[0]).map((h) => (
                                <th key={h} className="px-3 py-2 font-semibold whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/50">
                            {processedData.slice(0, 100).map((row, i) => (
                              <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                                {Object.keys(processedData[0]).map((h) => (
                                  <td key={h} className="px-3 py-1.5 whitespace-nowrap overflow-hidden text-ellipsis max-w-xs">{row[h] !== null && row[h] !== undefined ? String(row[h]) : ""}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="text-slate-500 text-center py-10">No data</p>
                      )
                    ) : (
                      <pre className="text-emerald-300/90 leading-relaxed overflow-x-auto whitespace-pre">
                        {activeTab === 'csv' && csvOutput.slice(0, 10000)}
                        {activeTab === 'csv' && csvOutput.length > 10000 ? "\n... (preview truncated)" : ""}
                        
                        {activeTab === 'excel' && csvOutput.slice(0, 10000)}
                        {activeTab === 'excel' && csvOutput.length > 10000 ? "\n... (preview truncated)" : ""}
                        
                        {activeTab === 'yaml' && yamlOutput.slice(0, 10000)}
                        {activeTab === 'yaml' && yamlOutput.length > 10000 ? "\n... (preview truncated)" : ""}

                        {activeTab === 'xml' && xmlOutput.slice(0, 10000)}
                        {activeTab === 'xml' && xmlOutput.length > 10000 ? "\n... (preview truncated)" : ""}

                        {activeTab === 'json' && jsonOutput.slice(0, 10000)}
                        {activeTab === 'json' && jsonOutput.length > 10000 ? "\n... (preview truncated)" : ""}
                      </pre>
                    )
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4">
                      <CodeXml size={48} className="opacity-20" />
                      <p>Upload JSON to preview outputs</p>
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
