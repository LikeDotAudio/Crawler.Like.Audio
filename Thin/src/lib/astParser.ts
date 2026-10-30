import type { Parser, Language, Node } from 'web-tree-sitter';
import { BASE_PATH } from './basePath';

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

  extractMetrics(code: string) {
    const tree = this.parse(code);
    let classCount = 0;
    let functionCount = 0;
    const structures: { type: 'class' | 'function'; name: string }[] = [];

    // Traverse the syntax tree for specific nodes
    const walk = (node: Node) => {
      if (node.type === 'class_definition') {
        classCount++;
        const nameNode = node.childForFieldName('name');
        if (nameNode) structures.push({ type: 'class', name: nameNode.text });
      } else if (node.type === 'function_definition') {
        functionCount++;
        const nameNode = node.childForFieldName('name');
        if (nameNode) structures.push({ type: 'function', name: nameNode.text });
      }
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child) walk(child);
      }
    };
    
    walk(tree.rootNode);
    return { classCount, functionCount, structures };
  }
}

export const astParser = new AstParserService();
