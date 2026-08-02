declare const TreeSitter: any;

class AstParserService {
  private parser: any = null;
  private isInitialized = false;

  async init() {
    if (this.isInitialized) return;
    
    await TreeSitter.init({
      locateFile() {
        return '/web-tree-sitter.wasm';
      },
    });
    
    this.parser = new TreeSitter();
    
    const pythonLanguage = await TreeSitter.Language.load('/tree-sitter-python.wasm');
    this.parser.setLanguage(pythonLanguage);
    
    this.isInitialized = true;
  }

  parse(code: string) {
    if (!this.parser || !this.isInitialized) {
      throw new Error('AST Parser not initialized. Call init() first.');
    }
    return this.parser.parse(code);
  }

  extractMetrics(code: string, fileName?: string) {
    const tree = this.parse(code);
    let classCount = 0;
    let functionCount = 0;
    const structures: { type: 'class' | 'function'; name: string }[] = [];

    // Traverse the syntax tree for specific nodes
    const walk = (node: any) => {
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
