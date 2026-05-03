import React, { useState, useEffect, useRef } from 'react';
import {
  Badge,
  Box,
  Button,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Popover,
  Tooltip,
  Typography,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import { useDownloads, DownloadJob } from '../contexts/DownloadsContext';
import { formatFileSize } from '../utils/formatters';

const COMPLETED_TTL = 30_000;

export default function DownloadsTray() {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const { jobs, removeJob } = useDownloads();
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
        <Box sx={{ minWidth: 320, maxWidth: 460, p: 1 }}>
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
                <DownloadRow key={job.id} job={job} />
              ))}
            </List>
          )}
        </Box>
      </Popover>
    </>
  );
}

interface DownloadRowProps {
  job: DownloadJob;
}

function DownloadRow({ job }: DownloadRowProps) {
  const inFlight = job.status === 'pending' || job.status === 'processing';
  const ratio =
    job.totalBytes > 0 ? Math.min(1, job.loadedBytes / job.totalBytes) : 0;
  const percent = Math.floor(ratio * 100);

  let statusLine: string;
  if (job.status === 'pending') {
    statusLine = 'Preparing…';
  } else if (job.status === 'processing') {
    if (job.totalBytes > 0) {
      statusLine = `${formatFileSize(job.loadedBytes)} of ${formatFileSize(
        job.totalBytes
      )} (${percent}%)`;
    } else {
      statusLine = `${formatFileSize(job.loadedBytes)} downloaded`;
    }
  } else if (job.status === 'ready') {
    statusLine = `Saved · ${formatFileSize(job.loadedBytes || job.totalBytes)}`;
  } else {
    statusLine = `Failed: ${job.error ?? 'Unknown error'}`;
  }

  return (
    <ListItem
      alignItems="flex-start"
      sx={{ flexDirection: 'column', alignItems: 'stretch', py: 1 }}
      secondaryAction={
        inFlight ? (
          <Button size="small" onClick={() => job.abort?.()}>
            Cancel
          </Button>
        ) : job.status === 'failed' && job.retry ? (
          <Button size="small" onClick={() => job.retry?.()}>
            Retry
          </Button>
        ) : null
      }
    >
      <ListItemText primary={job.folderName} secondary={statusLine} />
      {inFlight && (
        <Box sx={{ mt: 0.5, mr: 6 }}>
          {job.totalBytes > 0 ? (
            <LinearProgress variant="determinate" value={percent} />
          ) : (
            <LinearProgress />
          )}
        </Box>
      )}
    </ListItem>
  );
}
