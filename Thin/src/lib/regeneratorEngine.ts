import { parseEverything, UnsupportedCorpusVersionError } from './corpusFormat';

export interface RegeneratorOptions {
  logFile: File;
  outputDirHandle: FileSystemDirectoryHandle;
  onLog: (msg: string) => void;
}

/** Unpacks an EVERYTHING.LOG into a folder. Reads crawler-corpus v1 and the
 *  unversioned logs both halves wrote before it; refuses a newer version
 *  rather than guessing at it, and never writes outside the chosen folder. */
export async function restoreFiles(options: RegeneratorOptions): Promise<void> {
  const { logFile, outputDirHandle, onLog } = options;

  onLog(`[INFO] Starting restoration process...`);

  try {
    const parsed = parseEverything(await logFile.text());
    onLog(`[INFO] Corpus format version ${parsed.version || '0 (unversioned)'}: ${parsed.files.length} files.`);
    for (const path of parsed.skipped) onLog(`[WARN] Skipped unsafe path: ${path}`);

    let restoredCount = 0;
    for (const { path, content } of parsed.files) {
      const pathParts = path.split('/');
      const fileName = pathParts.pop();
      if (!fileName) continue;

      let currentHandle = outputDirHandle;
      for (const part of pathParts) {
        if (part) currentHandle = await currentHandle.getDirectoryHandle(part, { create: true });
      }

      const fileHandle = await currentHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();

      restoredCount++;
      if (restoredCount % 10 === 0) {
        onLog(`[INFO] Restored ${restoredCount} files...`);
      }
    }

    onLog(`[SUCCESS] Restoration complete! Unpacked ${restoredCount} files into ${outputDirHandle.name}.`);
  } catch (e) {
    console.error(e);
    if (e instanceof UnsupportedCorpusVersionError) {
      onLog(`[ERROR] ${e.message}`);
      return;
    }
    onLog(`[ERROR] Failed during restoration. Make sure you granted read/write permissions.`);
  }
}
