"use client";

import React, { useState, useMemo, useEffect } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import * as jsyaml from "js-yaml";
import { json2xml } from "xml-js";
import { Upload, FileJson, Settings2, Download, Table, FileCode2 } from "lucide-react";
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
  const [yamlOutput, setYamlOutput] = useState<string>("");
  const [xmlOutput, setXmlOutput] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"json" | "yaml" | "xml">("json");
  const [error, setError] = useState("");
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");

  const loadSheetData = (wb: XLSX.WorkBook, sheetName: string) => {
    const ws = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, { defval: "" });
    if (data.length > 0) {
      const parsedHeaders = Object.keys(data[0] as any);
      setHeaders(parsedHeaders);
      setCsvData(data);

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
    } else {
      setError("Selected sheet is empty");
      setHeaders([]);
      setCsvData([]);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.name.toLowerCase().endsWith(".csv")) {
      setWorkbook(null);
      setSheetNames([]);
      setSelectedSheet("");
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const parsedHeaders = results.meta.fields || [];
          setHeaders(parsedHeaders);
          setCsvData(results.data);

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
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: "array" });
          setWorkbook(wb);
          setSheetNames(wb.SheetNames);
          if (wb.SheetNames.length > 0) {
            setSelectedSheet(wb.SheetNames[0]);
            loadSheetData(wb, wb.SheetNames[0]);
          } else {
            setError("No sheets found in Excel file.");
          }
        } catch (err: any) {
          setError("Error parsing Excel: " + err.message);
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleSheetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sheet = e.target.value;
    setSelectedSheet(sheet);
    if (workbook) {
      loadSheetData(workbook, sheet);
    }
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
          if (c.role === "Skip") return;
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
      
      try {
        setYamlOutput(jsyaml.dump(finalJson));
      } catch (yErr: any) {
        setYamlOutput("# Error generating YAML: " + yErr.message);
      }
      
      try {
        setXmlOutput(json2xml(JSON.stringify(finalJson), { compact: true, spaces: 4 }));
      } catch (xErr: any) {
        setXmlOutput("<!-- XML Error: Keys cannot contain spaces or invalid characters -->\n" + xErr.message);
      }
    } catch (e: any) {
      setError("Failed to generate: " + e.message);
    }
  };

  const downloadOutput = () => {
    if (!jsonOutput) return;
    let data = "";
    let ext = "";
    let type = "";
    if (activeTab === "json") {
      data = JSON.stringify(jsonOutput, null, 2);
      ext = "json";
      type = "application/json";
    } else if (activeTab === "yaml") {
      data = yamlOutput;
      ext = "yaml";
      type = "text/plain";
    } else if (activeTab === "xml") {
      data = xmlOutput;
      ext = "xml";
      type = "text/plain";
    }
    
    const blob = new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `output.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    generateJson();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [csvData, configs, rootKeyName]);

  return (
    <div className="w-full flex flex-col gap-6">
      <div className="w-full space-y-8">
        
        {/* Header Section */}
        <header className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-white/10">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3 mb-2">
              <Table className="w-8 h-8 text-primary" /> CSV Importer & Shuffler
            </h2>
            <p className="text-muted-foreground mt-1">Import tabular data and shuffle it into JSON, YAML, or XML.</p>
          </div>
          
          <div className="flex items-center gap-4">
            <label className="relative cursor-pointer group">
              <div className="absolute inset-0 bg-indigo-500/20 rounded-xl blur-lg transition-all group-hover:bg-indigo-500/40"></div>
              <div className="relative flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl shadow-lg transition-all border border-indigo-400/30 font-medium">
                <Upload size={18} />
                Upload CSV / Excel
              </div>
              <input type="file" accept=".csv,.xls,.xlsx" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
        </header>

        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl flex items-center gap-3">
            <span className="font-semibold">Error:</span> {error}
          </motion.div>
        )}

        {sheetNames.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900/50 backdrop-blur-xl border border-white/5 p-4 rounded-xl flex items-center gap-4">
            <Table size={18} className="text-indigo-400" />
            <label className="text-sm text-slate-300 font-medium whitespace-nowrap">Select Sheet:</label>
            <select
              value={selectedSheet}
              onChange={handleSheetChange}
              className="bg-slate-950 border border-slate-800 text-sm px-3 py-1.5 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors text-slate-200"
            >
              {sheetNames.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </motion.div>
        )}

        {headers.length > 0 && (
          <div className="flex flex-col gap-8">
            {/* Configuration Section */}
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 w-full">
              
              {/* Global Config */}
              <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 p-6 rounded-2xl shadow-xl w-full">
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
              <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 p-6 rounded-2xl shadow-xl overflow-hidden flex flex-col">
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-6 text-indigo-300">
                  Column Configurations
                </h3>
                
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left text-sm text-slate-300 min-w-[800px]">
                    <thead className="text-xs uppercase bg-slate-950/80 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Column</th>
                        <th className="px-4 py-3 font-semibold w-1/4">JSON Key Name</th>
                        <th className="px-4 py-3 font-semibold w-1/5">Role</th>
                        <th className="px-4 py-3 font-semibold w-1/5">Nested Under</th>
                        <th className="px-4 py-3 font-semibold w-1/5">Part Name</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      <AnimatePresence>
                        {headers.map((header) => {
                          const config = configs[header];
                          if (!config) return null;
                          const needsPartName = ["Hierarchical Key", "Key Name and Value"].includes(config.role);

                          return (
                            <motion.tr 
                              key={header}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="hover:bg-slate-800/30 transition-colors"
                            >
                              <td className="px-4 py-3 align-middle">
                                <span className="bg-indigo-500/10 text-indigo-300 px-2.5 py-1 rounded-md text-xs font-bold font-mono tracking-wider inline-block">
                                  {header}
                                </span>
                              </td>
                              
                              <td className="px-4 py-2 align-middle">
                                <input
                                  type="text"
                                  value={config.jsonKey}
                                  onChange={(e) => updateConfig(header, { jsonKey: e.target.value })}
                                  className="w-full bg-slate-950 border border-slate-800/80 text-sm px-3 py-1.5 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                                />
                              </td>

                              <td className="px-4 py-2 align-middle">
                                <select
                                  value={config.role}
                                  onChange={(e) => updateConfig(header, { role: e.target.value as Role })}
                                  className="w-full bg-slate-950 border border-slate-800/80 text-sm px-3 py-1.5 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                                >
                                  <option>Simple Value</option>
                                  <option>Hierarchical Key</option>
                                  <option>Sub Key</option>
                                  <option>Value as Key</option>
                                  <option>Key Name and Value</option>
                                  <option>Skip</option>
                                </select>
                              </td>
                              
                              <td className="px-4 py-2 align-middle">
                                {config.role !== "Skip" && (
                                  <select
                                    value={config.nestedUnder}
                                    onChange={(e) => updateConfig(header, { nestedUnder: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-800/80 text-sm px-3 py-1.5 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                                  >
                                    {parentOptions.map((p) => (
                                      <option key={p} value={p}>{p}</option>
                                    ))}
                                  </select>
                                )}
                              </td>

                              <td className="px-4 py-2 align-middle">
                                {needsPartName && (
                                  <input
                                    type="text"
                                    value={config.partName}
                                    onChange={(e) => updateConfig(header, { partName: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-800/80 text-sm px-3 py-1.5 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                                    placeholder="e.g. parts"
                                  />
                                )}
                              </td>
                            </motion.tr>
                          );
                        })}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>

            {/* Preview Section */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col w-full">
              <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-2xl shadow-xl flex flex-col h-[700px]">
                <div className="p-4 border-b border-white/5 flex items-center justify-between">
                  <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
                    <button 
                      onClick={() => setActiveTab('json')}
                      className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${activeTab === 'json' ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      JSON
                    </button>
                    <button 
                      onClick={() => setActiveTab('yaml')}
                      className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${activeTab === 'yaml' ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      YAML
                    </button>
                    <button 
                      onClick={() => setActiveTab('xml')}
                      className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${activeTab === 'xml' ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      XML
                    </button>
                  </div>
                  <div className="flex gap-3">
                    {jsonOutput && (
                      <button 
                        onClick={downloadOutput}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        <Download size={14} /> Download {activeTab.toUpperCase()}
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="p-4 flex-1 overflow-auto bg-slate-950/80 m-4 rounded-xl border border-slate-800 font-mono text-sm shadow-inner">
                  {jsonOutput ? (
                    <pre className="text-emerald-300/90 leading-relaxed">
                      {activeTab === 'json' && JSON.stringify(jsonOutput, null, 2)}
                      {activeTab === 'yaml' && yamlOutput}
                      {activeTab === 'xml' && xmlOutput}
                    </pre>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4">
                      <FileCode2 size={48} className="opacity-20" />
                      <p>Configure columns to preview output</p>
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
            <h2 className="text-2xl font-semibold text-slate-200">Start by uploading a CSV or Excel file</h2>
            <p className="text-slate-400 max-w-md">Your file is processed entirely in your browser. No data is sent to our servers.</p>
          </div>
        )}

      </div>
    </div>
  );
}
