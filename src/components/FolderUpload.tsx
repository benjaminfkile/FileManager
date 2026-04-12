import React, { useRef, useState } from 'react';
import { Box, Typography, LinearProgress, Alert, Link } from '@mui/material';
import DriveFolderUploadIcon from '@mui/icons-material/DriveFolderUpload';
import { createFolder } from '../api/folderService';
import { uploadFile } from '../api/fileService';
import { IFile } from '../types';

export interface FolderUploadProps {
  folderId: string | null;
  onUploadComplete: (uploadedFiles: IFile[]) => void;
}

export default function FolderUpload({ folderId, onUploadComplete }: FolderUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList) => {
    if (files.length === 0) return;

    setError(null);
    setUploading(true);
    setCompletedCount(0);
    setTotalCount(files.length);

    try {
      // Build a set of unique directory paths from webkitRelativePath
      // e.g. "Photos/2024/img.jpg" -> ["Photos", "Photos/2024"]
      const dirPaths = new Set<string>();
      for (let i = 0; i < files.length; i++) {
        const parts = files[i].webkitRelativePath.split('/');
        // All segments except the last (filename) form directory paths
        for (let depth = 1; depth < parts.length; depth++) {
          dirPaths.add(parts.slice(0, depth).join('/'));
        }
      }

      // Sort by depth so parents are created before children
      const sortedDirs = Array.from(dirPaths).sort(
        (a, b) => a.split('/').length - b.split('/').length,
      );

      // Map from dir path -> created folder id
      const folderMap = new Map<string, string>();

      // Create folders depth-first
      for (const dirPath of sortedDirs) {
        const parts = dirPath.split('/');
        const name = parts[parts.length - 1];
        const parentPath = parts.slice(0, -1).join('/');
        const parentFolderId = parentPath
          ? folderMap.get(parentPath)!
          : folderId ?? undefined;

        const folder = await createFolder({
          name,
          parentFolderId: parentFolderId,
        });
        folderMap.set(dirPath, folder.id);
      }

      // Upload each file into the correct folder
      const uploadedFiles: IFile[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const parts = file.webkitRelativePath.split('/');
        const dirPath = parts.slice(0, -1).join('/');
        const resolvedFolderId = folderMap.get(dirPath);

        const response = await uploadFile({
          file,
          folderId: resolvedFolderId,
        });
        uploadedFiles.push(response.file);
        setCompletedCount(i + 1);
      }

      onUploadComplete(uploadedFiles);
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'response' in err &&
        (err as { response?: { data?: { errorMsg?: string } } }).response
      ) {
        const axiosErr = err as {
          response: { status: number; data?: { errorMsg?: string } };
        };
        if (axiosErr.response.status === 413) {
          setError('File is too large');
        } else {
          setError(axiosErr.response.data?.errorMsg ?? 'Upload failed');
        }
      } else {
        setError(err instanceof Error ? err.message : 'Upload failed');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
    e.target.value = '';
  };

  const handleBrowseClick = () => {
    inputRef.current?.click();
  };

  const progressValue = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <Box>
      <Box
        data-testid="folder-drop-zone"
        onClick={handleBrowseClick}
        sx={{
          border: '2px dashed',
          borderColor: 'grey.400',
          borderRadius: 2,
          p: 4,
          textAlign: 'center',
          cursor: uploading ? 'default' : 'pointer',
          transition: 'border-color 0.2s, background-color 0.2s',
          pointerEvents: uploading ? 'none' : 'auto',
        }}
      >
        <DriveFolderUploadIcon sx={{ fontSize: 48, color: 'grey.500', mb: 1 }} />
        <Typography variant="body1">
          Click to select a folder, or{' '}
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

      {uploading && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Uploading {completedCount} of {totalCount} files...
          </Typography>
          <LinearProgress variant="determinate" value={progressValue} />
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
