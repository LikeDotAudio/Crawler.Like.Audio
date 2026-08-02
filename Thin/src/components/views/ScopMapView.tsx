"use client";

import React, { useState, useMemo, useEffect } from "react";
import { FolderTree, Maximize, Settings2, FolderSearch, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import * as d3 from "d3-hierarchy";

interface TreeNode {
  name: string;
  value?: number;
  type?: "file" | "directory";
  extension?: string;
  children?: TreeNode[];
}

const EXT_COLORS: Record<string, string> = {
  ".js": "#f7df1e",
  ".jsx": "#f7df1e",
  ".ts": "#3178c6",
  ".tsx": "#3178c6",
  ".json": "#8bc34a",
  ".md": "#ff9800",
  ".html": "#e34f26",
  ".css": "#1572b6",
  ".py": "#3572A5",
  ".csv": "#4CAF50",
  ".svg": "#ffb300",
  ".png": "#e91e63",
  ".jpg": "#e91e63",
  ".jpeg": "#e91e63",
  "folder": "#334155",
  "default": "#64748b"
};

export function ScopMapView() {
  const [isScanning, setIsScanning] = useState(false);
  const [treeData, setTreeData] = useState<TreeNode | null>(null);
  const [colorMode, setColorMode] = useState<"type" | "size">("type");
  const [showLabels, setShowLabels] = useState(true);
  const [scannedFiles, setScannedFiles] = useState(0);

  const handleSelectFolder = async () => {
    try {
      // @ts-ignore
      const handle = await window.showDirectoryPicker();
      setIsScanning(true);
      setTreeData(null);
      setScannedFiles(0);

      const root: TreeNode = {
        name: handle.name,
        type: "directory",
        children: []
      };

      let count = 0;

      const scanDir = async (dirHandle: any, node: TreeNode) => {
        const children: TreeNode[] = [];
        for await (const entry of dirHandle.values()) {
          if (entry.name === '.git' || entry.name === 'node_modules') continue;

          if (entry.kind === "file") {
            try {
              const file = await entry.getFile();
              count++;
              if (count % 100 === 0) setScannedFiles(count);
              
              const ext = entry.name.includes('.') ? "." + entry.name.split('.').pop()?.toLowerCase() : "";
              children.push({
                name: entry.name,
                value: file.size,
                type: "file",
                extension: ext
              });
            } catch (e) {
              // ignore locked files
            }
          } else if (entry.kind === "directory") {
            const dirNode: TreeNode = {
              name: entry.name,
              type: "directory",
              children: []
            };
            await scanDir(entry, dirNode);
            // Only add directory if it has files
            if (dirNode.children && dirNode.children.length > 0) {
              children.push(dirNode);
            }
          }
        }
        node.children = children;
      };

      await scanDir(handle, root);
      setScannedFiles(count);
      
      // Clean up empty root
      if (root.children?.length === 0) {
        root.value = 1; // dummy value to prevent crash
      }
      
      setTreeData(root);
    } catch (err) {
      console.error(err);
    } finally {
      setIsScanning(false);
    }
  };

  const treemapLayout = useMemo(() => {
    if (!treeData) return null;

    // Use d3-hierarchy to compute layout
    const hierarchy = d3.hierarchy<TreeNode>(treeData)
      .sum(d => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    // The dimensions here are arbitrary relative units that we will map to percentages
    const treemap = d3.treemap<TreeNode>()
      .size([100, 100])
      .paddingInner(1)
      .paddingOuter(2)
      .paddingTop(20)
      .round(false);

    return treemap(hierarchy);
  }, [treeData]);

  // Color scale for size heatmap
  const sizeColorScale = useMemo(() => {
    if (!treemapLayout) return () => EXT_COLORS["default"];
    const maxVal = treemapLayout.value || 1;
    // from blue/cool (small) to red/hot (large)
    const scale = (val: number) => {
        const ratio = Math.min(val / (maxVal * 0.1 || 1), 1);
        // Simple manual heatmap from blue to red
        const r = Math.round(ratio * 255);
        const b = Math.round((1 - ratio) * 255);
        return `rgb(${r}, 0, ${b})`;
    };
    return scale;
  }, [treemapLayout]);

  const getColor = (node: d3.HierarchyRectangularNode<TreeNode>) => {
    if (node.data.type === "directory") return EXT_COLORS["folder"];
    if (colorMode === "type") {
      return EXT_COLORS[node.data.extension || ""] || EXT_COLORS["default"];
    } else {
      return sizeColorScale(node.data.value || 0);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="w-full flex flex-col gap-6 h-full">
      <div className="w-full flex flex-col h-full space-y-4">
        
        <header className="flex flex-col md:flex-row items-center justify-between gap-6 pb-4 border-b border-white/10 shrink-0">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3 mb-2">
              <FolderTree className="w-8 h-8 text-primary" /> SCOP Map
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
            
            <div className="text-sm font-mono text-slate-400">
              Total Size: {formatBytes(treemapLayout?.value || 0)}
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
              
              return (
                <div
                  key={i}
                  title={`${node.data.name}\nSize: ${formatBytes(node.data.value || 0)}`}
                  className={`absolute overflow-hidden transition-all duration-300 hover:brightness-110 group ${
                    isLeaf ? 'cursor-crosshair shadow-sm border border-black/20' : 'pointer-events-none border border-slate-800/50'
                  }`}
                  style={{
                    left: `${x0}%`,
                    top: `${y0}%`,
                    width: `${width}%`,
                    height: `${height}%`,
                    backgroundColor: isRoot ? 'transparent' : getColor(node),
                    zIndex: node.depth,
                    borderTopLeftRadius: isLeaf ? '0' : '4px',
                    borderTopRightRadius: isLeaf ? '0' : '4px',
                  }}
                >
                  {/* Directory Header Label */}
                  {!isLeaf && showLabels && height > 4 && width > 4 && (
                    <div className="absolute top-0 left-0 w-full px-1 py-0.5 text-[10px] font-bold text-slate-300/80 truncate bg-slate-900/40 backdrop-blur-sm shadow-sm pointer-events-auto">
                      {node.data.name}
                    </div>
                  )}
                  
                  {/* File Label */}
                  {isLeaf && showLabels && width > 3 && height > 3 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-1 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-sm">
                      <span className="text-[11px] font-bold text-white truncate w-full text-center drop-shadow-md">
                        {node.data.name}
                      </span>
                      <span className="text-[9px] font-mono text-slate-300 truncate w-full text-center">
                        {formatBytes(node.data.value || 0)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
