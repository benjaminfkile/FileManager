import React, { useCallback, useRef, useState } from 'react';
import { Box, Typography, LinearProgress, Alert, Link } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { uploadFile } from '../api/fileService';
import { IFile } from '../types';

export interface FileUploadProps {
  folderId: string | null;
  onUploaded: (file: IFile) => void;
}

export default function FileUpload({ folderId, onUploaded }: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setFileName(file.name);
      setProgress(0);
      setError(null);
      setUploading(true);

      try {
        const response = await uploadFile({
          file,
          folderId: folderId ?? undefined,
          onUploadProgress: (event) => {
            if (event.total) {
              const pct = Math.round((event.loaded * 100) / event.total);
              setProgress(pct);
              if (pct === 100) {
                setIsProcessing(true);
              }
            }
          },
        });
        onUploaded(response.file);
        setFileName(null);
        setProgress(0);
      } catch (err: unknown) {
        if (
          err &&
          typeof err === 'object' &&
          'response' in err &&
          (err as { response?: { status?: number; data?: { errorMsg?: string } } }).response
        ) {
          const axiosErr = err as {
            response: { status: number; data?: { errorMsg?: string } };
          };
          if (axiosErr.response.status === 413) {
            setError('File is too large');
          } else {
            setError(
              axiosErr.response.data?.errorMsg ?? 'Upload failed',
            );
          }
        } else {
          const message =
            err instanceof Error ? err.message : 'Upload failed';
          setError(message);
        }
      } finally {
        setUploading(false);
        setIsProcessing(false);
      }
    },
    [folderId, onUploaded],
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

      {uploading && fileName && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {fileName}
          </Typography>
          {isProcessing ? (
            <>
              <LinearProgress variant="indeterminate" />
              <Typography variant="body2" sx={{ mt: 1 }} data-testid="processing-label">
                Processing…
              </Typography>
            </>
          ) : (
            <LinearProgress variant="determinate" value={progress} />
          )}
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
