import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  CircularProgress,
  Box,
  Typography,
  Button,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import { previewFile } from '../api/fileService';

export interface FilePreviewDialogProps {
  open: boolean;
  fileId: string;
  fileName: string;
  onClose: () => void;
  onDownload: () => void;
}

export default function FilePreviewDialog({
  open,
  fileId,
  fileName,
  onClose,
  onDownload,
}: FilePreviewDialogProps) {
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setUrl(null);
      setMimeType(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    previewFile(fileId)
      .then((res) => {
        if (!cancelled) {
          setUrl(res.url);
          setMimeType(res.mimeType);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Failed to load preview.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, fileId]);

  const renderPreview = () => {
    if (loading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
          <CircularProgress />
        </Box>
      );
    }

    if (error) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
          <Typography color="error">{error}</Typography>
        </Box>
      );
    }

    if (!url || !mimeType) {
      return null;
    }

    if (mimeType.startsWith('image/')) {
      return (
        <img
          src={url}
          alt={fileName}
          style={{ width: '100%', height: 'auto', display: 'block' }}
        />
      );
    }

    if (mimeType.startsWith('video/')) {
      return (
        <video controls src={url} style={{ width: '100%', display: 'block' }}>
          Your browser does not support the video tag.
        </video>
      );
    }

    if (mimeType === 'application/pdf') {
      return (
        <iframe
          src={url}
          title={fileName}
          style={{ width: '100%', height: '70vh', border: 'none' }}
        />
      );
    }

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 4 }}>
        <Typography>Preview not available</Typography>
        <Button variant="contained" startIcon={<DownloadIcon />} onClick={onDownload}>
          Download
        </Button>
      </Box>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', pr: 1 }}>
        <Box sx={{ flexGrow: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {fileName}
        </Box>
        <IconButton aria-label="download" onClick={onDownload} sx={{ mr: 0.5 }}>
          <DownloadIcon />
        </IconButton>
        <IconButton aria-label="close" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>{renderPreview()}</DialogContent>
    </Dialog>
  );
}
