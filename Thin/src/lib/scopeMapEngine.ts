import * as d3 from "d3-hierarchy";

export interface TreeNode {
  name: string;
  value?: number;
  type?: "file" | "directory";
  extension?: string;
  path?: string;
  children?: TreeNode[];
}

export interface ScanResult {
  root: TreeNode;
  totalFiles: number;
  totalFolders: number;
}

export async function scanDirectory(
  dirHandle: any,
  onProgress?: (scannedFiles: number) => void
): Promise<ScanResult> {
  const root: TreeNode = {
    name: dirHandle.name,
    type: "directory",
    path: dirHandle.name,
    children: []
  };

  let count = 0;
  let folderCount = 0;

  const scanDir = async (handle: any, node: TreeNode, currentPath: string) => {
    const children: TreeNode[] = [];
    for await (const entry of handle.values()) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;

      if (entry.kind === "file") {
        try {
          const file = await entry.getFile();
          count++;
          if (count % 100 === 0 && onProgress) onProgress(count);
          
          const ext = entry.name.includes('.') ? "." + entry.name.split('.').pop()?.toLowerCase() : "";
          children.push({
            name: entry.name,
            value: file.size,
            type: "file",
            extension: ext,
            path: `${currentPath}/${entry.name}`
          });
        } catch (e) {
          // ignore locked files
        }
      } else if (entry.kind === "directory") {
        folderCount++;
        const dirNode: TreeNode = {
          name: entry.name,
          type: "directory",
          path: `${currentPath}/${entry.name}`,
          children: []
        };
        await scanDir(entry, dirNode, `${currentPath}/${entry.name}`);
        // Only add directory if it has files
        if (dirNode.children && dirNode.children.length > 0) {
          children.push(dirNode);
        }
      }
    }
    node.children = children;
  };

  await scanDir(dirHandle, root, dirHandle.name);
  if (onProgress) onProgress(count);

  if (root.children?.length === 0) {
    root.value = 1; // dummy value to prevent crash
  }

  return { root, totalFiles: count, totalFolders: folderCount + 1 };
}

export function computeTreemapLayout(treeData: TreeNode) {
  if (!treeData) return null;

  const hierarchy = d3.hierarchy<TreeNode>(treeData)
    .sum(d => d.value || 0)
    .sort((a, b) => (b.value || 0) - (a.value || 0));

  const treemap = d3.treemap<TreeNode>()
    .size([100, 100])
    .paddingInner(0)
    .paddingOuter(0)
    .paddingTop(0)
    .round(false);

  return treemap(hierarchy);
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function getSizeColor(val: number, maxVal: number): string {
  const ratio = Math.min(val / (maxVal * 0.1 || 1), 1);
  const r = Math.round(ratio * 255);
  const b = Math.round((1 - ratio) * 255);
  return `rgb(${r}, 0, ${b})`;
}
