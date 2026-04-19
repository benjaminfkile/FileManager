import React, { useCallback, useRef, useState } from 'react';
import { Box, Typography, LinearProgress, Alert, Link } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { useChunkedUpload } from '../hooks/useChunkedUpload';
import { IFile } from '../types';

export const MAX_FILE_SIZE_BYTES = 50 * 1024 ** 3; // 50 GB

export interface FileUploadProps {
  folderId: string | null;
  onUploaded: (file: IFile) => void;
}

export default function FileUpload({ folderId, onUploaded }: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [sizeError, setSizeError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload, progress, isUploading, error } = useChunkedUpload();

  const handleFile = useCallback(
    async (file: File) => {
      setSizeError(null);

      if (file.size > MAX_FILE_SIZE_BYTES) {
        setSizeError('File exceeds the maximum upload size of 50 GB');
        return;
      }

      setFileName(file.name);

      try {
        const result = await upload({ file, folderId: folderId ?? undefined });
        onUploaded(result);
        setFileName(null);
      } catch {
        // error is surfaced via the hook's error state
      }
    },
    [folderId, onUploaded, upload],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile],
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
    // Reset so re-selecting the same file still triggers onChange
    e.target.value = '';
  };

  const handleBrowseClick = () => {
    inputRef.current?.click();
  };

  const displayError = sizeError ?? error;

  return (
    <Box>
      <Box
        data-testid="drop-zone"
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
        <CloudUploadIcon sx={{ fontSize: 48, color: 'grey.500', mb: 1 }} />
        <Typography variant="body1">
          Drag and drop a file here, or{' '}
          <Link component="span" sx={{ cursor: 'pointer' }}>
            Browse
          </Link>
        </Typography>
        <input
          ref={inputRef}
          type="file"
          hidden
          data-testid="file-input"
          onChange={handleInputChange}
        />
      </Box>

      {isUploading && fileName && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {fileName}
          </Typography>
          <LinearProgress variant="determinate" value={progress} />
        </Box>
      )}

      {displayError && (
        <Alert severity="error" sx={{ mt: 2 }} onClose={() => setSizeError(null)}>
          {displayError}
        </Alert>
      )}
    </Box>
  );
}
