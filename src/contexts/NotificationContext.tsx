import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';

type NotificationSeverity = 'success' | 'error' | 'info' | 'warning';

interface Notification {
  message: string;
  severity: NotificationSeverity;
}

interface NotificationContextValue {
  showNotification: (message: string, severity?: NotificationSeverity) => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<Notification[]>([]);
  const [current, setCurrent] = useState<Notification | null>(null);
  const [open, setOpen] = useState(false);

  const processNext = useCallback((pendingQueue: Notification[]) => {
    if (pendingQueue.length > 0) {
      const [next, ...rest] = pendingQueue;
      setCurrent(next);
      setQueue(rest);
      setOpen(true);
    }
  }, []);

  const showNotification = useCallback(
    (message: string, severity: NotificationSeverity = 'success') => {
      const notification: Notification = { message, severity };
      if (current && open) {
        setQueue((prev) => [...prev, notification]);
      } else {
        setCurrent(notification);
        setOpen(true);
      }
    },
    [current, open],
  );

  const handleClose = useCallback(
    (_event?: React.SyntheticEvent | Event, reason?: string) => {
      if (reason === 'clickaway') return;
      setOpen(false);
    },
    [],
  );

  const handleExited = useCallback(() => {
    setCurrent(null);
    processNext(queue);
  }, [queue, processNext]);

  const value = useMemo<NotificationContextValue>(
    () => ({ showNotification }),
    [showNotification],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={4000}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        slotProps={{ transition: { onExited: handleExited } }}
      >
        <Alert severity={current?.severity ?? 'success'} onClose={handleClose} variant="filled">
          {current?.message}
        </Alert>
      </Snackbar>
    </NotificationContext.Provider>
  );
}

export function useNotification(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return ctx;
}
