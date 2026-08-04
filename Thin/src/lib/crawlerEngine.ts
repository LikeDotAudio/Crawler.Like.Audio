import ignore from 'ignore';
import { extensionEmojiMap } from '@/store/useAppStore';
import { astParser } from '@/lib/astParser';

export interface CrawlOptions {
  dirHandle: any;
  respectGitIgnore: boolean;
  selectedExts: Set<string>;
  fallbackAll: boolean;
  addCrawlLog: (msg: string) => void;
  checkIsCrawling: () => boolean;
}

export interface CrawlResult {
  mapText: string;
  scrapeText: string;
  extractorText: string;
  graphNodes: any[];
  graphEdges: any[];
  fileCount: number;
  dirCount: number;
  totalSize: number;
}

export const runCrawler = async (options: CrawlOptions): Promise<CrawlResult | null> => {
  const { dirHandle, respectGitIgnore, selectedExts, fallbackAll, addCrawlLog, checkIsCrawling } = options;

  try {
    addCrawlLog('[INFO] Booting web-tree-sitter WASM engine...');
    await astParser.init();
    addCrawlLog('[SUCCESS] WebAssembly engine initialized for Python parsing.');
  } catch (e: any) {
    console.error(e);
    addCrawlLog(`[ERROR] Failed to load WASM engine: ${e.message || e}`);
  }
  
  let fileCount = 0;
  let dirCount = 0;
  let extCounts: Record<string, number> = {};
  let totalSize = 0;
  
  let graphNodes: any[] = [];
  let graphEdges: any[] = [];
  
  let mapTextBuilder = `# Program Map:\n# Created: ${new Date().toLocaleString()}\n#\n`;
  let scrapeTextBuilder = `# ====================================================================================\n# EVERYTHING.LOG\n# Log started at: ${new Date().toLocaleString()}\n# ====================================================================================\n\n`;
  let extractorTextBuilder = `# ====================================================================================\n# COMMENTS AND MARKDOWN EXTRACTION\n# Log started at: ${new Date().toLocaleString()}\n# ====================================================================================\n\n`;

  const extractCommentsAndMarkdown = (text: string, ext: string, path: string, entryName: string) => {
    let extracted = '';
    if (['.js', '.jsx', '.ts', '.tsx', '.java', '.c', '.cpp', '.cs', '.go'].includes(ext)) {
      const matches = text.match(/(\/\*[\s\S]*?\*\/|\/\/.*$)/gm);
      if (matches) extracted = matches.join('\n');
    } else if (['.py', '.rb', '.sh', '.yaml', '.yml', '.conf'].includes(ext)) {
      const matches = text.match(/(#.*$)/gm);
      if (matches) extracted = matches.join('\n');
    } else if (['.html', '.xml', '.svg'].includes(ext)) {
      const matches = text.match(/(<!--[\s\S]*?-->)/gm);
      if (matches) extracted = matches.join('\n');
    } else if (ext === '.md' || ext === '.mdx' || ext === '.txt') {
      extracted = text;
    }
    
    if (extracted.trim()) {
      return `\n\n# --- File: ${path}${entryName} ---\n${extracted}`;
    }
    return '';
  };

  let ig = ignore();
  if (respectGitIgnore) {
    try {
      const gitignoreHandle = await dirHandle.getFileHandle('.gitignore');
      const file = await gitignoreHandle.getFile();
      const text = await file.text();
      ig.add(text);
      addCrawlLog('[INFO] Found and loaded .gitignore rules.');
    } catch (e) {
      addCrawlLog('[INFO] No .gitignore found in root directory.');
    }
  } else {
    addCrawlLog('[INFO] Ignoring .gitignore rules as requested by user.');
  }
  ig.add(['.git', 'node_modules', 'venv', '.crawler', '.next']);

  let globalTreeYIndex = 0;
  let rootNodeId = `dir-root`;
  
  graphNodes.push({
    id: rootNodeId,
    position: { x: 0, y: globalTreeYIndex * 80 },
    data: { label: `📁 ${dirHandle.name}`, depth: 0 },
    style: { background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px', fontWeight: 'bold' }
  });
  globalTreeYIndex++;

  const crawlDirectory = async (handle: any, path: string, depth = 0, parentNodeId: string = rootNodeId) => {
    if (!checkIsCrawling()) return;
    
    try {
      for await (const entry of handle.values()) {
        if (!checkIsCrawling()) break;
        
        const relativePath = path === '/' ? entry.name : path.substring(1) + entry.name;
        const isIgnored = ig.ignores(entry.kind === 'directory' ? relativePath + '/' : relativePath);
        
        if (isIgnored) continue;
        
        const currentNodeId = `${entry.kind}-${path}${entry.name}`;
        const currentY = globalTreeYIndex * 80;
        globalTreeYIndex++;
        
        if (entry.kind === 'file') {
          const rawExt = entry.name.includes('.') ? `.${entry.name.split('.').pop()}` : 'unknown';
          const ext = rawExt.toLowerCase();
          
          if (fallbackAll || selectedExts.has(ext)) {
            fileCount++;
            const emoji = extensionEmojiMap[ext] || '📄';
            
            mapTextBuilder += `${'  '.repeat(depth)}├── ${emoji} ${entry.name}\n`;
            
            if (fileCount % 500 === 0) {
              addCrawlLog(`[INFO] Scanned ${fileCount} files so far...`);
            }
            
            graphNodes.push({
              id: currentNodeId,
              position: { x: (depth + 1) * 280, y: currentY },
              data: { label: `${emoji} ${entry.name}`, depth: depth + 1 },
              style: { background: '#1e293b', color: '#fff', border: '2px solid #334155', borderRadius: '8px', padding: '10px' }
            });
            graphEdges.push({
              id: `e-${parentNodeId}-${currentNodeId}`,
              source: parentNodeId,
              target: currentNodeId,
              type: 'smoothstep',
              style: { stroke: '#475569' }
            });

            try {
              const file = await entry.getFile();
              totalSize += file.size;
              extCounts[ext] = (extCounts[ext] || 0) + 1;
              
              try {
                const text = await file.text();
                scrapeTextBuilder += `\n\n# --- File: ${path}${entry.name} ---\n`;
                scrapeTextBuilder += text;
                extractorTextBuilder += extractCommentsAndMarkdown(text, ext, path, entry.name);
              } catch(e) {
                console.error(`Failed reading text from ${entry.name}:`, e);
              }

              if (ext === '.py' && file.size < 1024 * 500) {
                try {
                  const text = await file.text();
                  const metrics = astParser.extractMetrics(text);
                  
                  if (metrics.structures.length > 0) {
                    metrics.structures.forEach((struct: any, idx: number) => {
                      const structId = `${currentNodeId}-${struct.name}-${idx}`;
                      const structY = globalTreeYIndex * 80;
                      globalTreeYIndex++;
                      
                      graphNodes.push({
                        id: structId,
                        position: { x: (depth + 2) * 280, y: structY },
                        data: { label: struct.name, depth: depth + 2 },
                        style: { 
                          background: struct.type === 'class' ? '#f97316' : '#0ea5e9', 
                          color: '#fff', 
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '11px',
                          padding: '6px 10px'
                        }
                      });
                      
                      graphEdges.push({
                        id: `e-${currentNodeId}-${structId}`,
                        source: currentNodeId,
                        target: structId,
                        type: 'smoothstep',
                        style: { stroke: struct.type === 'class' ? '#f97316' : '#0ea5e9', strokeWidth: 2 }
                      });
                    });
                  }
                  
                  if (metrics.classCount > 0 || metrics.functionCount > 0) {
                    addCrawlLog(`[AST] ${file.name} -> ${metrics.classCount} classes, ${metrics.functionCount} functions`);
                  }
                } catch(e) {}
              }
            } catch (e) {}
          }
        } else if (entry.kind === 'directory') {
          dirCount++;
          mapTextBuilder += `${'  '.repeat(depth)}├── 📁 ${entry.name}/\n`;
          
          graphNodes.push({
            id: currentNodeId,
            position: { x: (depth + 1) * 280, y: currentY },
            data: { label: `📁 ${entry.name}`, depth: depth + 1 },
            style: { background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px', fontWeight: 'bold' }
          });
          graphEdges.push({
            id: `e-${parentNodeId}-${currentNodeId}`,
            source: parentNodeId,
            target: currentNodeId,
            type: 'smoothstep',
            style: { stroke: '#3b82f6', strokeWidth: 2 }
          });

          await crawlDirectory(entry, `${path}${entry.name}/`, depth + 1, currentNodeId);
        }
      }
    } catch (e) {
      addCrawlLog(`[ERROR] Permission denied reading directory ${path}`);
    }
  };

  await crawlDirectory(dirHandle, '/');
  
  if (!checkIsCrawling()) return null;

  return {
    mapText: mapTextBuilder,
    scrapeText: scrapeTextBuilder,
    extractorText: extractorTextBuilder,
    graphNodes,
    graphEdges,
    fileCount,
    dirCount,
    totalSize
  };
};
