import React, { useCallback, useRef, useState } from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  Alert,
  Link,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { useChunkedUpload } from '../hooks/useChunkedUpload';
import { IFile } from '../types';

export const MAX_FILE_SIZE_BYTES = 5 * 1024 ** 4; // 5 TB

export interface FileUploadProps {
  folderId: string | null;
  onUploaded: (file: IFile) => void;
}

export default function FileUpload({ folderId, onUploaded }: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [sizeError, setSizeError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    upload,
    resume,
    discardResume,
    progress,
    isUploading,
    error,
    pendingResume,
  } = useChunkedUpload();

  const startUpload = useCallback(
    async (file: File) => {
      try {
        const result = await upload({ file, folderId: folderId ?? undefined });
        if (result) {
          onUploaded(result);
          setFileName(null);
          setPendingFile(null);
        }
      } catch {
        // error is surfaced via the hook's error state
      }
    },
    [folderId, onUploaded, upload],
  );

  const handleFile = useCallback(
    async (file: File) => {
      setSizeError(null);

      if (file.size > MAX_FILE_SIZE_BYTES) {
        setSizeError('File exceeds the maximum upload size of 5 TB');
        return;
      }

      setFileName(file.name);
      setPendingFile(file);

      await startUpload(file);
    },
    [startUpload],
  );

  const handleResume = useCallback(async () => {
    try {
      const result = await resume();
      onUploaded(result);
      setFileName(null);
      setPendingFile(null);
    } catch {
      // error is surfaced via the hook's error state
    }
  }, [onUploaded, resume]);

  const handleStartOver = useCallback(async () => {
    discardResume();
    if (pendingFile) {
      await startUpload(pendingFile);
    }
  }, [discardResume, pendingFile, startUpload]);

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
  const showProgress = isUploading && fileName && !pendingResume;
  const promptedFileName = pendingFile?.name ?? fileName ?? '';

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

      <Dialog
        open={Boolean(pendingResume)}
        aria-labelledby="resume-upload-title"
        data-testid="resume-upload-dialog"
      >
        <DialogTitle id="resume-upload-title">
          Resume previous upload of {promptedFileName}?
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            We found an interrupted upload for this file. Resume where you left off, or start over from the beginning.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleStartOver} data-testid="resume-start-over">
            Start over
          </Button>
          <Button onClick={handleResume} variant="contained" data-testid="resume-confirm">
            Resume
          </Button>
        </DialogActions>
      </Dialog>

      {showProgress && (
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
