import React, { useEffect, useState } from 'react';
import { Alert, Box } from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

interface Props {
  expiresAt: string;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function SessionExpiryBanner({ expiresAt }: Props) {
  const [remainingMs, setRemainingMs] = useState(
    () => new Date(expiresAt).getTime() - Date.now(),
  );

  useEffect(() => {
    const id = setInterval(() => {
      setRemainingMs(new Date(expiresAt).getTime() - Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const isExpired = remainingMs <= 0;
  const isUrgent = remainingMs > 0 && remainingMs < 5 * 60 * 1000;
  const severity = isExpired || isUrgent ? 'error' : 'info';

  return (
    <Box sx={{ mb: 2 }}>
      <Alert severity={severity} icon={<AccessTimeIcon fontSize="inherit" />}>
        {isExpired
          ? 'Demo session expired — refresh the page to start a new one.'
          : `Demo account — your data will be wiped in ${formatRemaining(remainingMs)}.`}
      </Alert>
    </Box>
  );
}
