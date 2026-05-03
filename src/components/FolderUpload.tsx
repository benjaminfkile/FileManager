import React, { useCallback, useRef, useState } from 'react';
import { Box, Typography, LinearProgress, Alert, Link } from '@mui/material';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import {
  initiateUpload,
  getPartUrls,
  uploadPartToUrl,
  completeUpload,
  abortUpload,
} from '../api/chunkedUploadService';
import { chunkFile } from '../utils/chunkFile';
import { createFolder } from '../api/folderService';
import { formatFileSize } from '../utils/formatters';

export interface FolderUploadProps {
  folderId: string | null;
  onCompleted: () => void;
}

interface FileEntry {
  file: File;
  /** e.g. "MyProject/src/index.ts" — always relative to the drop root */
  relativePath: string;
}

// readEntries returns at most 100 items per call, so loop until empty.
async function readAllEntries(
  reader: FileSystemDirectoryReader,
): Promise<FileSystemEntry[]> {
  const all: FileSystemEntry[] = [];
  let batch: FileSystemEntry[];
  do {
    batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });
    all.push(...batch);
  } while (batch.length > 0);
  return all;
}

async function walkDirectory(
  dirEntry: FileSystemDirectoryEntry,
  pathPrefix: string,
): Promise<FileEntry[]> {
  const result: FileEntry[] = [];
  const entries = await readAllEntries(dirEntry.createReader());
  for (const entry of entries) {
    const entryPath = `${pathPrefix}/${entry.name}`;
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) =>
        (entry as FileSystemFileEntry).file(resolve, reject),
      );
      result.push({ file, relativePath: entryPath });
    } else if (entry.isDirectory) {
      const sub = await walkDirectory(entry as FileSystemDirectoryEntry, entryPath);
      result.push(...sub);
    }
  }
  return result;
}

async function entriesFromDataTransfer(items: DataTransferItemList): Promise<FileEntry[]> {
  const result: FileEntry[] = [];
  for (let i = 0; i < items.length; i++) {
    const entry = items[i].webkitGetAsEntry?.();
    if (!entry) continue;
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) =>
        (entry as FileSystemFileEntry).file(resolve, reject),
      );
      result.push({ file, relativePath: entry.name });
    } else if (entry.isDirectory) {
      const sub = await walkDirectory(entry as FileSystemDirectoryEntry, entry.name);
      result.push(...sub);
    }
  }
  return result;
}

function entriesFromFileList(files: FileList): FileEntry[] {
  return Array.from(files).map((file) => ({
    file,
    relativePath: file.webkitRelativePath || file.name,
  }));
}

export interface UploadProgress {
  /** Files fully completed so far. */
  filesCompleted: number;
  /** Total file count. */
  totalFiles: number;
  /** Bytes uploaded across all files (sums completed chunks of the in-flight file too). */
  bytesUploaded: number;
  /** Sum of all entries' file sizes — fixed for the whole upload. */
  totalBytes: number;
  /** Name of the file currently uploading, or null when between files. */
  currentFile: string | null;
}

async function orchestrateUpload(
  entries: FileEntry[],
  parentFolderId: string | null,
  onProgress: (progress: UploadProgress) => void,
): Promise<void> {
  // Collect all unique folder paths and sort shallow-first so parents are
  // always created before their children.
  const folderPathSet = new Set<string>();
  for (const entry of entries) {
    const parts = entry.relativePath.split('/');
    for (let depth = 1; depth < parts.length; depth++) {
      folderPathSet.add(parts.slice(0, depth).join('/'));
    }
  }
  const sortedFolderPaths = Array.from(folderPathSet).sort(
    (a, b) => a.split('/').length - b.split('/').length,
  );

  // Create each folder, tracking "relative path" → API-assigned id.
  const folderIdMap = new Map<string, string>();
  for (const folderPath of sortedFolderPaths) {
    const parts = folderPath.split('/');
    const name = parts[parts.length - 1];
    const parentPath = parts.slice(0, -1).join('/');
    const parentId = parentPath === '' ? parentFolderId : folderIdMap.get(parentPath)!;
    const folder = await createFolder({
      name,
      parentFolderId: parentId ?? undefined,
    });
    folderIdMap.set(folderPath, folder.id);
  }

  const totalBytes = entries.reduce((sum, e) => sum + e.file.size, 0);
  let bytesUploaded = 0;
  let filesCompleted = 0;

  onProgress({
    filesCompleted: 0,
    totalFiles: entries.length,
    bytesUploaded: 0,
    totalBytes,
    currentFile: null,
  });

  for (const entry of entries) {
    const parts = entry.relativePath.split('/');
    const folderPath = parts.slice(0, -1).join('/');
    const folderId =
      folderPath === '' ? parentFolderId : (folderIdMap.get(folderPath) ?? null);

    onProgress({
      filesCompleted,
      totalFiles: entries.length,
      bytesUploaded,
      totalBytes,
      currentFile: entry.file.name,
    });

    const { fileId } = await initiateUpload({
      filename: entry.file.name,
      mimeType: entry.file.type,
      size: entry.file.size,
      folderId,
    });
    try {
      const chunks = chunkFile(entry.file);
      // Bytes flow browser → S3 directly via these presigned PUT URLs.
      const urlEntries = chunks.length
        ? await getPartUrls(fileId, chunks.map((c) => c.partNumber))
        : [];
      const urlMap = new Map(urlEntries.map((u) => [u.partNumber, u.url]));

      const completedParts = [];
      for (const chunk of chunks) {
        const url = urlMap.get(chunk.partNumber);
        if (!url) throw new Error(`Missing presigned URL for part ${chunk.partNumber}`);
        const part = await uploadPartToUrl({
          url,
          partNumber: chunk.partNumber,
          chunk: chunk.blob,
        });
        completedParts.push(part);
        bytesUploaded += chunk.end - chunk.start;
        onProgress({
          filesCompleted,
          totalFiles: entries.length,
          bytesUploaded,
          totalBytes,
          currentFile: entry.file.name,
        });
      }
      await completeUpload(fileId, completedParts);
    } catch (err) {
      await abortUpload(fileId);
      throw err;
    }
    filesCompleted++;
    onProgress({
      filesCompleted,
      totalFiles: entries.length,
      bytesUploaded,
      totalBytes,
      currentFile: filesCompleted < entries.length ? entry.file.name : null,
    });
  }
}

const INITIAL_PROGRESS: UploadProgress = {
  filesCompleted: 0,
  totalFiles: 0,
  bytesUploaded: 0,
  totalBytes: 0,
  currentFile: null,
};

function renderUploadHeadline(p: UploadProgress): string {
  if (p.totalFiles === 1) {
    return p.currentFile
      ? `Uploading ${p.currentFile}…`
      : 'Uploading…';
  }
  return p.currentFile
    ? `Uploading ${p.filesCompleted} of ${p.totalFiles} files · ${p.currentFile}`
    : `Uploading ${p.filesCompleted} of ${p.totalFiles} files…`;
}

function renderUploadSubline(p: UploadProgress): string {
  if (p.totalBytes === 0) return '';
  const percent = Math.floor((p.bytesUploaded / p.totalBytes) * 100);
  return `${formatFileSize(p.bytesUploaded)} of ${formatFileSize(p.totalBytes)} (${percent}%)`;
}

export default function FolderUpload({ folderId, onCompleted }: FolderUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress>(INITIAL_PROGRESS);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleEntries = useCallback(
    async (entries: FileEntry[]) => {
      if (entries.length === 0) {
        setError('No files found in the selected folder');
        return;
      }
      setError(null);
      setUploading(true);
      setProgress({
        ...INITIAL_PROGRESS,
        totalFiles: entries.length,
        totalBytes: entries.reduce((sum, e) => sum + e.file.size, 0),
      });
      try {
        await orchestrateUpload(entries, folderId, (next) => setProgress(next));
        onCompleted();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [folderId, onCompleted],
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      try {
        const entries = await entriesFromDataTransfer(e.dataTransfer.items);
        await handleEntries(entries);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to read dropped folder');
      }
    },
    [handleEntries],
  );

  const handleInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        await handleEntries(entriesFromFileList(files));
      }
      e.target.value = '';
    },
    [handleEntries],
  );

  return (
    <Box>
      <Box
        data-testid="folder-drop-zone"
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => !uploading && inputRef.current?.click()}
        sx={{
          border: '2px dashed',
          borderColor: dragOver ? 'primary.main' : 'grey.400',
          borderRadius: 2,
          p: 4,
          textAlign: 'center',
          cursor: uploading ? 'default' : 'pointer',
          bgcolor: dragOver ? 'action.hover' : 'transparent',
          transition: 'border-color 0.2s, background-color 0.2s',
        }}
      >
        <FolderOpenIcon sx={{ fontSize: 48, color: 'grey.500', mb: 1 }} />
        <Typography variant="body1">
          Drag and drop a folder here, or{' '}
          <Link component="span" sx={{ cursor: 'pointer' }}>
            Browse
          </Link>
        </Typography>
        {/* webkitdirectory is non-standard but supported by all major browsers */}
        <input
          ref={inputRef}
          type="file"
          hidden
          data-testid="folder-input"
          // @ts-ignore
          webkitdirectory=""
          multiple
          onChange={handleInputChange}
        />
      </Box>

      {uploading && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            {renderUploadHeadline(progress)}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mb: 1 }}
          >
            {renderUploadSubline(progress)}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={
              progress.totalBytes > 0
                ? Math.min(100, (progress.bytesUploaded / progress.totalBytes) * 100)
                : 0
            }
          />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
    </Box>
  );
}
