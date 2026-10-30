// lib.dom types FileSystemDirectoryHandle.values() as plain FileSystemHandle
// (kind is not a discriminant there), so walking a directory needs guards.

export const isFileHandle = (h: FileSystemHandle): h is FileSystemFileHandle => h.kind === 'file';

export const isDirectoryHandle = (h: FileSystemHandle): h is FileSystemDirectoryHandle => h.kind === 'directory';
