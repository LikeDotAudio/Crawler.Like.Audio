"use client";

import React, { useState, useMemo, useEffect } from "react";
import { FolderTree, Maximize, Settings2, FolderSearch, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import * as d3 from "d3-hierarchy";
import { TreeNode, scanDirectory, computeTreemapLayout, formatBytes, getSizeColor } from "../../lib/scopeMapEngine";

const EXT_COLORS: Record<string, string> = {
  ".js": "#f7df1e",
  ".jsx": "#f7df1e",
  ".ts": "#00d8ff",
  ".tsx": "#00d8ff",
  ".json": "#8bc34a",
  ".md": "#ff00ff",
  ".html": "#ff0000",
  ".css": "#00ff00",
  ".py": "#3572A5",
  ".csv": "#ffcc00",
  ".svg": "#ffb300",
  ".png": "#00ff00",
  ".jpg": "#ff00ff",
  ".jpeg": "#ff00ff",
  ".wav": "#00ffff",
  ".mp4": "#ff4040",
  ".zip": "#00ff00",
  "folder": "#334155",
  "default": "#0000ff"
};

export function ScopeMapView() {
  const [isScanning, setIsScanning] = useState(false);
  const [treeData, setTreeData] = useState<TreeNode | null>(null);
  const [colorMode, setColorMode] = useState<"type" | "size">("type");
  const [showLabels, setShowLabels] = useState(true);
  const [scannedFiles, setScannedFiles] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [totalFolders, setTotalFolders] = useState(0);
  const [hoveredNode, setHoveredNode] = useState<{ node: any, x: number, y: number } | null>(null);

  const handleSelectFolder = async () => {
    try {
      // @ts-ignore
      const handle = await window.showDirectoryPicker();
      setIsScanning(true);
      setTreeData(null);
      setScannedFiles(0);

      const result = await scanDirectory(handle, (count) => {
        setScannedFiles(count);
      });

      setScannedFiles(result.totalFiles);
      setTotalFiles(result.totalFiles);
      setTotalFolders(result.totalFolders);
      setTreeData(result.root);
    } catch (err) {
      console.error(err);
    } finally {
      setIsScanning(false);
    }
  };

  const treemapLayout = useMemo(() => {
    if (!treeData) return null;
    return computeTreemapLayout(treeData);
  }, [treeData]);

  // Color scale for size heatmap
  const sizeColorScale = useMemo(() => {
    if (!treemapLayout) return () => EXT_COLORS["default"];
    const maxVal = treemapLayout.value || 1;
    return (val: number) => getSizeColor(val, maxVal);
  }, [treemapLayout]);

  const getColor = (node: d3.HierarchyRectangularNode<TreeNode>) => {
    if (node.data.type === "directory") return EXT_COLORS["folder"];
    if (colorMode === "type") {
      return EXT_COLORS[node.data.extension || ""] || EXT_COLORS["default"];
    } else {
      return sizeColorScale(node.data.value || 0);
    }
  };



  return (
    <div className="w-full flex flex-col gap-6 h-full">
      <div className="w-full flex flex-col h-full space-y-4">
        
        <header className="flex flex-col md:flex-row items-center justify-between gap-6 pb-4 border-b border-white/10 shrink-0">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
              <FolderTree className="w-8 h-8 text-primary" /> SCOPE Map
            </h2>
            <p className="text-muted-foreground mt-1">Project Scope Analyzer. Visualize file sizes as an interactive Treemap.</p>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={handleSelectFolder}
              disabled={isScanning}
              className="relative flex items-center gap-2 bg-primary/20 hover:bg-primary/30 text-primary px-6 py-3 rounded-xl transition-all border border-primary/30 font-bold tracking-wide"
            >
              {isScanning ? <RefreshCw className="animate-spin w-5 h-5" /> : <FolderSearch className="w-5 h-5" />}
              {isScanning ? `Scanning (${scannedFiles})...` : "Select Folder"}
            </button>
          </div>
        </header>

        {treeData && (
          <div className="flex items-center gap-6 bg-slate-900/50 p-4 rounded-xl border border-white/5 shrink-0">
            <div className="flex items-center gap-3">
              <Settings2 className="text-slate-400 w-5 h-5" />
              <span className="text-sm font-semibold text-slate-300">Settings:</span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 uppercase tracking-wider">Color By:</span>
              <select 
                value={colorMode}
                onChange={(e) => setColorMode(e.target.value as "type" | "size")}
                className="bg-slate-950 border border-slate-800 text-slate-200 text-sm px-3 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/50"
              >
                <option value="type">File Type</option>
                <option value="size">File Size (Heatmap)</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2 border-l border-slate-800 pl-6">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300">
                <input 
                  type="checkbox" 
                  checked={showLabels} 
                  onChange={(e) => setShowLabels(e.target.checked)}
                  className="rounded border-slate-800 text-primary focus:ring-primary/50 bg-slate-950"
                />
                Show Text Labels
              </label>
            </div>

            <div className="flex-1"></div>
            
            <div className="flex items-center gap-6 text-sm font-mono text-slate-400">
              <div>
                <span className="text-slate-500">Files:</span> {totalFiles}
              </div>
              <div>
                <span className="text-slate-500">Folders:</span> {totalFolders}
              </div>
              <div className="text-primary font-bold">
                <span className="text-slate-500 font-normal">Total Size:</span> {formatBytes(treemapLayout?.value || 0)}
              </div>
            </div>
          </div>
        )}

        {!treeData && !isScanning && (
          <div className="flex-1 mt-8 bg-slate-900/30 border border-slate-800/50 rounded-3xl p-16 text-center shadow-2xl flex flex-col items-center justify-center gap-6 min-h-[400px]">
            <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center">
              <Maximize size={40} className="text-primary" />
            </div>
            <h2 className="text-2xl font-semibold text-slate-200">Visualize your project's footprint</h2>
            <p className="text-slate-400 max-w-md">Click "Select Folder" to scan a local directory and render a beautiful, interactive Treemap of all files and folders relative to their size.</p>
          </div>
        )}

        {treemapLayout && (
          <div className="flex-1 relative w-full h-[600px] bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl min-h-[500px]">
            {treemapLayout.descendants().map((node, i) => {
              const isRoot = node.depth === 0;
              const isLeaf = !node.children;
              const x0 = node.x0;
              const y0 = node.y0;
              const x1 = node.x1;
              const y1 = node.y1;
              
              const width = x1 - x0;
              const height = y1 - y0;
              
              if (width < 0.1 || height < 0.1) return null; // Too small to render
              
              const baseColor = getColor(node);
              const bgStyle = isRoot 
                ? 'transparent' 
                : isLeaf 
                  ? `radial-gradient(circle at center, rgba(255,255,255,0.9) 0%, ${baseColor} 45%, #000000 130%)`
                  : 'transparent'; // Folders are invisible in classic WinDirStat treemap

              return (
                <div
                  key={i}
                  onMouseMove={(e) => {
                    if (isLeaf) {
                      setHoveredNode({
                        node,
                        x: e.clientX,
                        y: e.clientY
                      });
                    }
                  }}
                  onMouseLeave={() => setHoveredNode(null)}
                  className={`absolute overflow-hidden transition-all duration-300 group ${
                    isLeaf ? 'cursor-crosshair shadow-2xl hover:z-50 hover:scale-[1.02]' : 'pointer-events-none'
                  }`}
                  style={{
                    left: `${x0}%`,
                    top: `${y0}%`,
                    width: `${width}%`,
                    height: `${height}%`,
                    background: bgStyle,
                    zIndex: node.depth,
                    border: isLeaf ? '1px solid rgba(0,0,0,0.8)' : 'none',
                    boxShadow: isLeaf ? 'inset 0 0 4px rgba(0,0,0,0.5), inset 0 0 1px rgba(255,255,255,0.5)' : 'none'
                  }}
                >
                  {/* File Label */}
                  {isLeaf && showLabels && width > 4 && height > 4 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-1 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 backdrop-blur-sm z-10">
                      <span className="text-[12px] font-bold text-white truncate w-full text-center drop-shadow-md">
                        {node.data.name}
                      </span>
                      <span className="text-[10px] font-mono text-slate-300 truncate w-full text-center mt-1">
                        {formatBytes(node.data.value || 0)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {hoveredNode && (
          <div 
            className="fixed z-[100] bg-slate-950/95 backdrop-blur-md border border-slate-700/50 p-4 rounded-xl shadow-2xl pointer-events-none transform -translate-x-1/2 -translate-y-full mb-4 min-w-[200px]"
            style={{ left: hoveredNode.x, top: hoveredNode.y - 15 }}
          >
            <div className="font-bold text-white mb-1 truncate max-w-[300px]">{hoveredNode.node.data.name}</div>
            <div className="flex flex-col gap-1 mt-2">
              <div className="text-xs text-slate-400 flex justify-between gap-4">
                <span>Type:</span>
                <span className="text-slate-200">{hoveredNode.node.data.type} {hoveredNode.node.data.extension || ''}</span>
              </div>
              <div className="text-xs text-slate-400 flex justify-between gap-4">
                <span>Size:</span>
                <span className="text-primary font-bold">{formatBytes(hoveredNode.node.data.value || 0)}</span>
              </div>
              {hoveredNode.node.data.path && (
                <div className="text-[10px] text-slate-500 mt-2 break-all max-w-[300px] leading-tight">
                  {hoveredNode.node.data.path}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
