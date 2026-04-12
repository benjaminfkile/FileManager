import React, { useCallback, useRef, useState } from 'react';
import { Box, Typography, LinearProgress, Alert, Link } from '@mui/material';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import { uploadFile } from '../api/fileService';
import { createFolder } from '../api/folderService';

export interface FolderUploadProps {
  folderId: string | null;
  onComplete: (fileCount: number) => void;
}

interface UploadState {
  folderName: string;
  currentFileName: string;
  currentFileIndex: number;
  totalFiles: number;
  fileProgress: number;
}

async function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  const entries: FileSystemEntry[] = [];
  let batch: FileSystemEntry[];
  do {
    batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
      reader.readEntries(resolve, reject),
    );
    entries.push(...batch);
  } while (batch.length > 0);
  return entries;
}

async function traverseEntry(
  entry: FileSystemEntry,
  path: string,
): Promise<File[]> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) =>
      (entry as FileSystemFileEntry).file(resolve, reject),
    );
    // Attach the relative path so we can reconstruct folder hierarchy
    Object.defineProperty(file, 'webkitRelativePath', {
      value: path ? `${path}/${file.name}` : file.name,
      writable: false,
    });
    return [file];
  }

  if (entry.isDirectory) {
    const dirReader = (entry as FileSystemDirectoryEntry).createReader();
    const children = await readAllEntries(dirReader);
    const subPath = path ? `${path}/${entry.name}` : entry.name;
    const files: File[] = [];
    for (const child of children) {
      files.push(...(await traverseEntry(child, subPath)));
    }
    return files;
  }

  return [];
}

function supportsWebkitDirectory(): boolean {
  return typeof HTMLInputElement !== 'undefined' && 'webkitdirectory' in HTMLInputElement.prototype;
}

export default function FolderUpload({ folderId, onComplete }: FolderUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      setUploading(true);
      setErrors([]);

      // Derive the top-level folder name from the first file's path
      const firstPath = files[0].webkitRelativePath;
      const topFolderName = firstPath.split('/')[0] || 'Folder';

      setUploadState({
        folderName: topFolderName,
        currentFileName: '',
        currentFileIndex: 0,
        totalFiles: files.length,
        fileProgress: 0,
      });

      // Extract unique directory paths from all files
      const dirPaths = new Set<string>();
      for (const file of files) {
        const parts = file.webkitRelativePath.split('/');
        // Build each directory level (exclude the filename itself)
        for (let i = 1; i < parts.length; i++) {
          dirPaths.add(parts.slice(0, i).join('/'));
        }
      }

      // Sort by depth (shallow first)
      const sortedPaths = Array.from(dirPaths).sort(
        (a, b) => a.split('/').length - b.split('/').length,
      );

      // Create folders and build path->id map
      const folderMap = new Map<string, string>();
      const collectedErrors: string[] = [];

      for (const dirPath of sortedPaths) {
        const parts = dirPath.split('/');
        const name = parts[parts.length - 1];
        const parentPath = parts.slice(0, -1).join('/');
        const parentFolderId = parentPath
          ? folderMap.get(parentPath)
          : folderId ?? undefined;

        try {
          const folder = await createFolder({
            name,
            parentFolderId: parentFolderId,
          });
          folderMap.set(dirPath, folder.id);
        } catch {
          collectedErrors.push(`Failed to create folder: ${dirPath}`);
        }
      }

      // Upload each file sequentially
      let successCount = 0;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileParts = file.webkitRelativePath.split('/');
        const fileDirPath = fileParts.slice(0, -1).join('/');
        const targetFolderId = folderMap.get(fileDirPath) ?? folderId ?? undefined;

        setUploadState((prev) =>
          prev
            ? {
                ...prev,
                currentFileName: file.name,
                currentFileIndex: i + 1,
                fileProgress: 0,
              }
            : prev,
        );

        try {
          await uploadFile({
            file,
            folderId: targetFolderId,
            onUploadProgress: (event) => {
              if (event.total) {
                setUploadState((prev) =>
                  prev
                    ? {
                        ...prev,
                        fileProgress: Math.min(
                          99,
                          Math.round((event.loaded * 100) / event.total!),
                        ),
                      }
                    : prev,
                );
              }
            },
          });
          successCount++;
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : 'Upload failed';
          collectedErrors.push(`${file.name}: ${message}`);
        }
      }

      setErrors(collectedErrors);
      setUploading(false);
      setUploadState(null);
      onComplete(successCount);
    },
    [folderId, onComplete],
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);

      const items = e.dataTransfer.items;
      if (!items || items.length === 0) return;

      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry?.();
        if (entry) {
          files.push(...(await traverseEntry(entry, '')));
        }
      }

      if (files.length > 0) {
        processFiles(files);
      }
    },
    [processFiles],
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (fileList && fileList.length > 0) {
      processFiles(Array.from(fileList));
    }
    e.target.value = '';
  };

  const handleBrowseClick = () => {
    inputRef.current?.click();
  };

  if (!supportsWebkitDirectory()) {
    return (
      <Alert severity="warning" data-testid="no-webkitdirectory">
        Your browser does not support folder uploads.
      </Alert>
    );
  }

  return (
    <Box>
      <Box
        data-testid="folder-drop-zone"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleBrowseClick}
        sx={{
          border: '2px dashed',
          borderColor: dragOver ? 'primary.main' : 'grey.400',
          borderRadius: 2,
          p: 4,
          textAlign: 'center',
          cursor: 'pointer',
          bgcolor: dragOver ? 'action.hover' : 'transparent',
          transition: 'border-color 0.2s, background-color 0.2s',
        }}
      >
        <CreateNewFolderIcon sx={{ fontSize: 48, color: 'grey.500', mb: 1 }} />
        <Typography variant="body1">
          Drag and drop a folder here, or{' '}
          <Link component="span" sx={{ cursor: 'pointer' }}>
            Browse
          </Link>
        </Typography>
        <input
          ref={inputRef}
          type="file"
          hidden
          data-testid="folder-input"
          onChange={handleInputChange}
          {...({ webkitdirectory: '', multiple: true } as React.InputHTMLAttributes<HTMLInputElement>)}
        />
      </Box>

      {uploading && uploadState && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
            Uploading folder: {uploadState.folderName}
          </Typography>
          {uploadState.currentFileName && (
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              Uploading {uploadState.currentFileName} ({uploadState.currentFileIndex} of{' '}
              {uploadState.totalFiles})
            </Typography>
          )}
          <LinearProgress
            variant="determinate"
            value={uploadState.fileProgress}
          />
          <Typography variant="caption" sx={{ mt: 0.5, display: 'block' }}>
            {uploadState.currentFileIndex} / {uploadState.totalFiles} files
          </Typography>
        </Box>
      )}

      {errors.length > 0 && (
        <Alert severity="error" sx={{ mt: 2 }} onClose={() => setErrors([])}>
          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
            {errors.length} error{errors.length > 1 ? 's' : ''} occurred:
          </Typography>
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            {errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </Alert>
      )}
    </Box>
  );
}
