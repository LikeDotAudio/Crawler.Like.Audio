"use client";

import React, { useState } from "react";
import { Upload, FileSpreadsheet, Download, RefreshCw, TableProperties } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";

type SupportedFormat = "xlsx" | "xls" | "csv" | "ods";

export function SpreadsheetConverterView() {
  const [file, setFile] = useState<File | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [targetFormat, setTargetFormat] = useState<SupportedFormat>("csv");
  const [convertedData, setConvertedData] = useState<Blob | null>(null);
  const [convertedFileName, setConvertedFileName] = useState<string>("");
  const [error, setError] = useState("");

  const supportedFormats = [
    { id: "xlsx", name: "Excel (XLSX)" },
    { id: "xls", name: "Excel 97-2004 (XLS)" },
    { id: "csv", name: "Comma Separated Values (CSV)" },
    { id: "ods", name: "OpenDocument Spreadsheet (ODS)" }
  ];

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setConvertedData(null);
    setConvertedFileName("");
    setError("");
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        setWorkbook(wb);
        
        // Auto-select a target format that is different from the input
        const ext = selected.name.split('.').pop()?.toLowerCase();
        if (ext === 'csv') setTargetFormat('xlsx');
        else if (ext === 'xlsx' || ext === 'xls') setTargetFormat('csv');
        else setTargetFormat('xlsx');
        
      } catch (err: any) {
        setError("Error parsing spreadsheet: " + err.message);
        setWorkbook(null);
      } finally {
        setIsProcessing(false);
      }
    };
    reader.onerror = () => {
      setError("Failed to read file.");
      setIsProcessing(false);
    };
    reader.readAsArrayBuffer(selected);
  };

  const handleConversion = () => {
    if (!file || !workbook) return;
    setIsProcessing(true);
    setError("");

    try {
      let bookType: XLSX.BookType = "xlsx";
      let mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      
      switch (targetFormat) {
        case "xlsx":
          bookType = "xlsx";
          mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
          break;
        case "xls":
          bookType = "biff8";
          mimeType = "application/vnd.ms-excel";
          break;
        case "csv":
          bookType = "csv";
          mimeType = "text/csv";
          break;
        case "ods":
          bookType = "ods";
          mimeType = "application/vnd.oasis.opendocument.spreadsheet";
          break;
      }

      // Generate buffer
      const buffer = XLSX.write(workbook, { bookType, type: "array" });
      const blob = new Blob([buffer], { type: mimeType });
      
      setConvertedData(blob);
      const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      setConvertedFileName(`${baseName}.${targetFormat}`);
      
    } catch (err: any) {
      setError("Failed to convert file: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadFile = () => {
    if (!convertedData || !convertedFileName) return;
    
    const url = URL.createObjectURL(convertedData);
    const a = document.createElement("a");
    a.href = url;
    a.download = convertedFileName;
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
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent drop-shadow-sm mb-2">
              Spreadsheet Converter
            </h1>
            <p className="text-slate-400">Convert between XLSX, XLS, CSV, and ODS formats entirely in your browser.</p>
          </div>
          
          <div className="flex items-center gap-4">
            <label className="relative cursor-pointer group">
              <div className="absolute inset-0 bg-emerald-500/20 rounded-xl blur-lg transition-all group-hover:bg-emerald-500/40"></div>
              <div className="relative flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl shadow-lg transition-all border border-emerald-400/30 font-medium">
                <Upload size={18} />
                Upload Spreadsheet
              </div>
              <input type="file" accept=".xlsx,.xls,.csv,.ods" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
        </header>

        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl flex items-center gap-3">
            <span className="font-semibold">Error:</span> {error}
          </motion.div>
        )}

        {!file && !error && (
          <div className="mt-8 bg-slate-900/30 border border-slate-800/50 rounded-3xl p-16 text-center max-w-3xl mx-auto shadow-2xl flex flex-col items-center gap-6">
            <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center">
              <TableProperties size={40} className="text-emerald-400" />
            </div>
            <h2 className="text-2xl font-semibold text-slate-200">Upload a spreadsheet</h2>
            <p className="text-slate-400 max-w-md">Supported formats: CSV, XLSX, XLS, and ODS. Processed entirely locally.</p>
          </div>
        )}

        {file && workbook && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid lg:grid-cols-2 gap-8 mt-8 max-w-5xl mx-auto">
            {/* Input Section */}
            <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 p-8 rounded-3xl shadow-xl flex flex-col items-center justify-center relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <TableProperties size={120} />
              </div>
              <div className="z-10 flex flex-col items-center text-center w-full">
                <FileSpreadsheet size={48} className="text-emerald-400 mb-4" />
                <h3 className="text-xl font-bold text-slate-200 mb-1 line-clamp-1 max-w-[300px]" title={file.name}>
                  {file.name}
                </h3>
                <p className="text-sm text-slate-400 mb-2 font-mono">{(file.size / 1024).toFixed(2)} KB</p>
                <p className="text-xs text-emerald-500/70 mb-8 font-semibold">{workbook.SheetNames.length} Sheet(s)</p>
                
                <div className="w-full text-left mb-6">
                  <label className="text-sm font-semibold text-slate-400 mb-2 block">Convert to format:</label>
                  <select 
                    value={targetFormat}
                    onChange={(e) => {
                      setTargetFormat(e.target.value as SupportedFormat);
                      setConvertedData(null); // Reset output when format changes
                    }}
                    className="w-full bg-slate-950 border border-slate-700 text-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all appearance-none"
                  >
                    {supportedFormats.map(fmt => (
                      <option key={fmt.id} value={fmt.id} disabled={file.name.toLowerCase().endsWith(fmt.id)}>
                        {fmt.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <button
                  onClick={handleConversion}
                  disabled={isProcessing || !!convertedData}
                  className="relative group w-full overflow-hidden rounded-xl"
                >
                  <div className={`absolute inset-0 transition-all ${isProcessing ? 'bg-teal-600/40' : 'bg-gradient-to-r from-emerald-600 to-teal-500 group-hover:opacity-90'}`}></div>
                  <div className="relative flex items-center justify-center gap-2 px-6 py-4 text-white font-bold tracking-wide">
                    {isProcessing ? (
                      <>
                        <RefreshCw size={20} className="animate-spin" />
                        Converting...
                      </>
                    ) : convertedData ? (
                      <>Converted!</>
                    ) : (
                      <>
                        <RefreshCw size={20} />
                        Convert Spreadsheet
                      </>
                    )}
                  </div>
                </button>
              </div>
            </div>

            {/* Output Section */}
            <AnimatePresence>
              {convertedData && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }} 
                  animate={{ opacity: 1, scale: 1 }} 
                  className="bg-gradient-to-br from-slate-900 to-slate-800 backdrop-blur-xl border border-emerald-500/20 p-8 rounded-3xl shadow-xl flex flex-col items-center justify-center relative overflow-hidden"
                >
                  <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-500/20 blur-3xl rounded-full"></div>
                  <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-teal-500/20 blur-3xl rounded-full"></div>
                  
                  <div className="z-10 flex flex-col items-center text-center">
                    <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mb-6 shadow-lg border border-emerald-500/30">
                      <Download size={32} />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-100 mb-2">Success!</h3>
                    <p className="text-slate-400 mb-8 max-w-[280px]">
                      Your spreadsheet has been converted to <strong>{targetFormat.toUpperCase()}</strong> format.
                    </p>
                    
                    <button 
                      onClick={downloadFile}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 px-8 rounded-xl shadow-lg transition-all border border-emerald-400/30 flex items-center justify-center gap-2 hover:scale-[1.02]"
                    >
                      <Download size={20} />
                      Download {convertedFileName}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
}
