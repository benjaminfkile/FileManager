import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Alert,
  CircularProgress,
} from '@mui/material';

export interface RenameDialogProps {
  open: boolean;
  currentName: string;
  itemType: 'file' | 'folder';
  onClose: () => void;
  onRename: (newName: string) => Promise<void>;
}

const INVALID_PATTERN = /[/\\]|^\.{1,2}$/;

function validateName(name: string): string | null {
  if (!name.trim()) {
    return 'Name is required';
  }
  if (INVALID_PATTERN.test(name)) {
    return 'Name cannot contain / or \\ or be . or ..';
  }
  return null;
}

export default function RenameDialog({
  open,
  currentName,
  itemType,
  onClose,
  onRename,
}: RenameDialogProps) {
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(currentName);
      setError(null);
      setApiError(null);
    }
  }, [open, currentName]);

  const handleEntered = () => {
    if (inputRef.current) {
      inputRef.current.select();
    }
  };

  const handleClose = () => {
    if (!submitting) {
      onClose();
    }
  };

  const handleSubmit = async () => {
    const validationError = validateName(name);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setApiError(null);
    try {
      await onRename(name.trim());
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to rename';
      setApiError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  const title = itemType === 'file' ? 'Rename File' : 'Rename Folder';

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="xs"
      slotProps={{ transition: { onEntered: handleEntered } }}
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {apiError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {apiError}
          </Alert>
        )}
        <TextField
          autoFocus
          inputRef={inputRef}
          margin="dense"
          label="Name"
          fullWidth
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          onKeyDown={handleKeyDown}
          error={!!error}
          helperText={error}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={submitting}
          startIcon={submitting ? <CircularProgress size={20} /> : undefined}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
