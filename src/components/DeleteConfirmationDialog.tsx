import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  CircularProgress,
} from '@mui/material';

export interface DeleteConfirmationDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  isDangerous?: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export default function DeleteConfirmationDialog({
  open,
  title,
  description,
  confirmLabel = 'Delete',
  isDangerous = false,
  onClose,
  onConfirm,
}: DeleteConfirmationDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm();
      onClose();
    } catch {
      // caller handles error (e.g. via notification context)
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{description}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          color={isDangerous ? 'error' : 'primary'}
          variant="contained"
          disabled={submitting}
        >
          {submitting ? <CircularProgress size={24} /> : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
