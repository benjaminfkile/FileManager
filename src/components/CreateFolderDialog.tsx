import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Alert,
} from '@mui/material';
import { createFolder } from '../api/folderService';
import { IFolder } from '../types';

export interface CreateFolderDialogProps {
  open: boolean;
  parentFolderId: string | null;
  onClose: () => void;
  onCreated: (folder: IFolder) => void;
}

const INVALID_PATTERN = /[/\\]|^\.{1,2}$/;

function validateName(name: string): string | null {
  if (!name.trim()) {
    return 'Folder name is required';
  }
  if (INVALID_PATTERN.test(name)) {
    return 'Folder name cannot contain / or \\ or be . or ..';
  }
  return null;
}

export default function CreateFolderDialog({
  open,
  parentFolderId,
  onClose,
  onCreated,
}: CreateFolderDialogProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleClose = () => {
    setName('');
    setError(null);
    setApiError(null);
    onClose();
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
      const folder = await createFolder({
        name: name.trim(),
        ...(parentFolderId ? { parentFolderId } : {}),
      });
      handleClose();
      onCreated(folder);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to create folder';
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

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>New Folder</DialogTitle>
      <DialogContent>
        {apiError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {apiError}
          </Alert>
        )}
        <TextField
          autoFocus
          margin="dense"
          label="Folder name"
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
        <Button onClick={handleClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={submitting}>
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}
