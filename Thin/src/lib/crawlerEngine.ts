import ignore from 'ignore';
import { extensionEmojiMap, type GraphNode, type GraphEdge } from '@/store/useAppStore';
import { isFileHandle, isDirectoryHandle } from '@/lib/fsAccess';
import { astParser } from '@/lib/astParser';
import { errorMessage } from "@/lib/utils";
import { buildCorpus, extOf, isSkippedDir, isTextFile, wantsAst, type CorpusEntry, type AstMetrics } from '@/lib/corpusFormat';

export interface CrawlOptions {
  dirHandle: FileSystemDirectoryHandle;
  respectGitIgnore: boolean;
  selectedExts: Set<string>;
  fallbackAll: boolean;
  addCrawlLog: (msg: string) => void;
  checkIsCrawling: () => boolean;
}

export interface CrawlResult {
  /** MAP.txt (crawler-corpus v1). */
  mapText: string;
  /** EVERYTHING.LOG (crawler-corpus v1): the map, then every text file. */
  scrapeText: string;
  extractorText: string;
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
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
  } catch (e) {
    console.error(e);
    addCrawlLog(`[ERROR] Failed to load WASM engine: ${errorMessage(e)}`);
  }
  
  let fileCount = 0;
  let dirCount = 0;
  const extCounts: Record<string, number> = {};
  let totalSize = 0;
  
  const graphNodes: GraphNode[] = [];
  const graphEdges: GraphEdge[] = [];
  
  const created = new Date().toLocaleString();
  const corpusEntries: CorpusEntry[] = [];
  let extractorTextBuilder = `# ====================================================================================\n# COMMENTS AND MARKDOWN EXTRACTION\n# Log started at: ${created}\n# ====================================================================================\n\n`;

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

  const ig = ignore();
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
  // The folders every crawl skips are corpusFormat.isSkippedDir — the same
  // rule Thick applies (Contract/corpus.v1.json).

  let globalTreeYIndex = 0;
  const rootNodeId = `dir-root`;
  
  graphNodes.push({
    id: rootNodeId,
    position: { x: 0, y: globalTreeYIndex * 80 },
    data: { label: `📁 ${dirHandle.name}`, depth: 0 },
    style: { background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px', fontWeight: 'bold' }
  });
  globalTreeYIndex++;

  const crawlDirectory = async (handle: FileSystemDirectoryHandle, path: string, depth = 0, parentNodeId: string = rootNodeId) => {
    if (!checkIsCrawling()) return;
    
    try {
      // Sorted (dirs first, then by name) so the graph and the corpus come out
      // the same on every run and in the same order as Thick's.
      const children: FileSystemHandle[] = [];
      for await (const entry of handle.values()) children.push(entry);
      children.sort((a, b) => a.kind !== b.kind ? (a.kind === 'directory' ? -1 : 1) : a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

      for (const entry of children) {
        if (!checkIsCrawling()) break;
        
        const relativePath = path === '/' ? entry.name : path.substring(1) + entry.name;
        if (entry.kind === 'directory' && isSkippedDir(entry.name)) continue;
        const isIgnored = ig.ignores(entry.kind === 'directory' ? relativePath + '/' : relativePath);
        
        if (isIgnored) continue;
        
        const currentNodeId = `${entry.kind}-${path}${entry.name}`;
        const currentY = globalTreeYIndex * 80;
        globalTreeYIndex++;
        
        if (isFileHandle(entry)) {
          const ext = extOf(entry.name);
          
          if (fallbackAll || selectedExts.has(ext)) {
            fileCount++;
            const emoji = extensionEmojiMap[ext] || '📄';
            
            const corpusEntry: CorpusEntry = { path: relativePath, kind: 'file', content: null, metrics: null };
            corpusEntries.push(corpusEntry);

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
              
              if (isTextFile(entry.name)) {
                try {
                  const text = await file.text();
                  corpusEntry.content = text;
                  extractorTextBuilder += extractCommentsAndMarkdown(text, ext, path, entry.name);
                } catch(e) {
                  console.error(`Failed reading text from ${entry.name}:`, e);
                }
              }

              if (corpusEntry.content != null && wantsAst(entry.name, file.size)) {
                try {
                  const metrics: AstMetrics = astParser.extractMetrics(corpusEntry.content);
                  corpusEntry.metrics = metrics;
                  
                  if (metrics.structures.length > 0) {
                    metrics.structures.forEach((struct, idx: number) => {
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
                } catch(e) {
                  // WASM not booted or the file would not parse: no metrics for it
                }
              }
            } catch (e) {}
          }
        } else if (isDirectoryHandle(entry)) {
          dirCount++;
          corpusEntries.push({ path: relativePath, kind: 'dir' });
          
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

  const corpus = buildCorpus(dirHandle.name, corpusEntries, created);

  return {
    mapText: corpus.mapText,
    scrapeText: corpus.everythingText,
    extractorText: extractorTextBuilder,
    graphNodes,
    graphEdges,
    fileCount,
    dirCount,
    totalSize
  };
};
