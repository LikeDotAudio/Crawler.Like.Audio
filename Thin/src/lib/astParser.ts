import type { Parser, Language } from 'web-tree-sitter';
import { BASE_PATH } from './basePath';
import { metricsFromTree, type AstMetrics } from './corpusFormat';

// layout.tsx loads public/web-tree-sitter.js and sets window.TreeSitter = Parser
// with Parser.Language = Language. Type-only import: the bundle is never imported.
declare const TreeSitter: typeof Parser & { Language: typeof Language };

class AstParserService {
  private parser: Parser | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  async init() {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        if (typeof TreeSitter === 'undefined') {
          throw new Error('TreeSitter global is not defined. Ensure web-tree-sitter.js is loaded.');
        }

        await TreeSitter.init({
          locateFile(path: string) {
            if (path.endsWith('tree-sitter.wasm')) {
              return `${BASE_PATH}/web-tree-sitter.wasm`;
            }
            return `${BASE_PATH}/` + path;
          },
        });
        
        this.parser = new TreeSitter();
        
        // public/tree-sitter-python.wasm is tree-sitter-python 0.25.0's own build
        // (npm tarball, MIT). The tree-sitter-wasms 0.1.13 copy it replaced has the
        // old 'dylink' section this web-tree-sitter (0.26) refuses, so the AST
        // pass never ran; test/corpus-contract.test.mjs now loads it.
        const pythonLanguage = await TreeSitter.Language.load(`${BASE_PATH}/tree-sitter-python.wasm`);
        this.parser.setLanguage(pythonLanguage);
        
        this.isInitialized = true;
      } catch (err) {
        this.initPromise = null;
        throw err;
      }
    })();
    
    return this.initPromise;
  }

  parse(code: string) {
    if (!this.parser || !this.isInitialized) {
      throw new Error('AST Parser not initialized. Call init() first.');
    }
    const tree = this.parser.parse(code);
    if (!tree) throw new Error('AST Parser returned no tree.');
    return tree;
  }

  /** crawler-corpus v1 AST metrics (corpusFormat.metricsFromTree). */
  extractMetrics(code: string): AstMetrics {
    return metricsFromTree(this.parse(code).rootNode);
  }
}

export const astParser = new AstParserService();
