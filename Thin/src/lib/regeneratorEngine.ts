export interface RegeneratorOptions {
  logFile: File;
  outputDirHandle: any;
  onLog: (msg: string) => void;
}

export async function restoreFiles(options: RegeneratorOptions): Promise<void> {
  const { logFile, outputDirHandle, onLog } = options;

  onLog(`[INFO] Starting restoration process...`);

  try {
    const text = await logFile.text();
    // Split based on our custom delimiter pattern
    // Pattern: # --- File: /path/to/file.ext ---
    const fileBlocks = text.split('# --- File: ');
    
    let restoredCount = 0;

    for (let i = 1; i < fileBlocks.length; i++) {
      const block = fileBlocks[i];
      const endOfLineIndex = block.indexOf('---');
      if (endOfLineIndex === -1) continue;

      const rawFilePath = block.substring(0, endOfLineIndex).trim();
      let fileContent = block.substring(endOfLineIndex + 3).replace(/^\s+/, '');
      
      // Remove leading slash if present for relative pathing
      const relativePath = rawFilePath.startsWith('/') ? rawFilePath.substring(1) : rawFilePath;
      const pathParts = relativePath.split('/');
      const fileName = pathParts.pop();
      
      if (!fileName) continue;

      let currentHandle = outputDirHandle;

      // Traverse and create directories
      for (const part of pathParts) {
        if (part) {
          currentHandle = await currentHandle.getDirectoryHandle(part, { create: true });
        }
      }

      // Create and write the file
      const fileHandle = await currentHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(fileContent);
      await writable.close();

      restoredCount++;
      if (restoredCount % 10 === 0) {
        onLog(`[INFO] Restored ${restoredCount} files...`);
      }
    }

    onLog(`[SUCCESS] Restoration complete! Unpacked ${restoredCount} files into ${outputDirHandle.name}.`);
  } catch (e) {
    console.error(e);
    onLog(`[ERROR] Failed during restoration. Make sure you granted read/write permissions.`);
  }
}
