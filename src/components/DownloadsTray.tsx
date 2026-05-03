import React, { useState, useEffect, useRef } from 'react';
import {
  Badge,
  Box,
  Button,
  CircularProgress,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Popover,
  Tooltip,
  Typography,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import { useDownloads, DownloadJob } from '../contexts/DownloadsContext';
import { useFolderDownload } from '../hooks/useFolderDownload';
import { triggerDownloadFromUrl } from '../utils/downloadHelpers';

const COMPLETED_TTL = 30_000;

export default function DownloadsTray() {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const { jobs, removeJob } = useDownloads();
  const { start } = useFolderDownload();
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const isOpen = Boolean(anchorEl);
  const inFlightCount = jobs.filter(
    (j) => j.status === 'pending' || j.status === 'processing'
  ).length;

  // When tray is open, start 30s auto-remove timers for completed jobs
  useEffect(() => {
    if (!isOpen) return;

    const completedJobs = jobs.filter((j) => j.status === 'ready' || j.status === 'failed');
    completedJobs.forEach((job) => {
      if (!timersRef.current.has(job.id)) {
        const timerId = setTimeout(() => {
          removeJob(job.id);
          timersRef.current.delete(job.id);
        }, COMPLETED_TTL);
        timersRef.current.set(job.id, timerId);
      }
    });
  }, [isOpen, jobs, removeJob]);

  // Clear all timers on unmount
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((id) => clearTimeout(id));
    };
  }, []);

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const handleRetry = (job: DownloadJob) => {
    removeJob(job.id);
    start(job.folderId, job.folderName, {
      prepareFn: job.prepareFn,
      statusFn: job.statusFn,
    });
  };

  const handleOpenDownload = (url: string, folderName: string) => {
    triggerDownloadFromUrl(url, `${folderName}.zip`);
  };

  return (
    <>
      <Tooltip title="Downloads">
        <IconButton color="inherit" onClick={handleOpen} aria-label="downloads">
          <Badge badgeContent={inFlightCount || undefined} color="error">
            <DownloadIcon />
          </Badge>
        </IconButton>
      </Tooltip>
      <Popover
        open={isOpen}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Box sx={{ minWidth: 300, maxWidth: 420, p: 1 }}>
          <Typography variant="subtitle2" sx={{ px: 1, py: 0.5 }}>
            Downloads
          </Typography>
          {jobs.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ px: 1, py: 1 }}>
              No downloads
            </Typography>
          ) : (
            <List dense disablePadding>
              {jobs.map((job) => (
                <ListItem
                  key={job.id}
                  secondaryAction={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {(job.status === 'pending' || job.status === 'processing') && (
                        <CircularProgress size={16} />
                      )}
                      {job.status === 'failed' && (
                        <Button size="small" onClick={() => handleRetry(job)}>
                          Retry
                        </Button>
                      )}
                      {job.status === 'ready' && job.url && (
                        <Button
                          size="small"
                          onClick={() => handleOpenDownload(job.url!, job.folderName)}
                        >
                          Open
                        </Button>
                      )}
                    </Box>
                  }
                >
                  <ListItemText
                    primary={job.folderName}
                    secondary={
                      job.status === 'pending'
                        ? 'Preparing...'
                        : job.status === 'processing'
                        ? 'Downloading...'
                        : job.status === 'ready'
                        ? 'Ready'
                        : `Failed: ${job.error ?? 'Unknown error'}`
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      </Popover>
    </>
  );
}
