import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  Alert,
  Breadcrumbs,
  Link,
  Typography,
  Box,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { getRootFolders, getFolder } from '../api/folderService';
import { IFolder } from '../types';

export interface MoveDialogProps {
  open: boolean;
  itemId: string;
  itemType: 'file' | 'folder';
  itemName: string;
  currentFolderId: string | null;
  onClose: () => void;
  onMove: (targetFolderId: string | null) => Promise<void>;
}

interface BreadcrumbEntry {
  id: string | null;
  name: string;
}

export default function MoveDialog({
  open,
  itemId,
  itemType,
  itemName,
  currentFolderId,
  onClose,
  onMove,
}: MoveDialogProps) {
  const [folders, setFolders] = useState<IFolder[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbEntry[]>([
    { id: null, name: 'My Files' },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);

  const currentBrowsingFolderId = breadcrumbs[breadcrumbs.length - 1].id;

  const fetchRoot = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rootFolders = await getRootFolders();
      setFolders(rootFolders);
    } catch {
      setError('Failed to load folders');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFolder = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getFolder(id);
      setFolders(result.subFolders);
    } catch {
      setError('Failed to load folders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchRoot();
    }
  }, [open, fetchRoot]);

  const handleFolderClick = (folder: IFolder) => {
    setBreadcrumbs((prev) => [...prev, { id: folder.id, name: folder.name }]);
    fetchFolder(folder.id);
  };

  const handleBreadcrumbClick = (index: number) => {
    const entry = breadcrumbs[index];
    setBreadcrumbs(breadcrumbs.slice(0, index + 1));
    if (entry.id === null) {
      fetchRoot();
    } else {
      fetchFolder(entry.id);
    }
  };

  const handleClose = () => {
    setBreadcrumbs([{ id: null, name: 'My Files' }]);
    setFolders([]);
    setError(null);
    setMoveError(null);
    onClose();
  };

  const handleMove = async () => {
    setMoving(true);
    setMoveError(null);
    try {
      await onMove(currentBrowsingFolderId);
      handleClose();
    } catch (err: unknown) {
      const msg =
        err &&
        typeof err === 'object' &&
        'response' in err
          ? (err as { response?: { data?: { errorMsg?: string } } }).response?.data?.errorMsg
          : undefined;
      setMoveError(msg ?? 'Failed to move');
    } finally {
      setMoving(false);
    }
  };

  const displayedFolders =
    itemType === 'folder'
      ? folders.filter((f) => f.id !== itemId)
      : folders;

  const moveDisabled =
    moving || currentBrowsingFolderId === currentFolderId;

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>Move &quot;{itemName}&quot;</DialogTitle>
      <DialogContent>
        <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} sx={{ mb: 1 }}>
          {breadcrumbs.map((entry, index) =>
            index < breadcrumbs.length - 1 ? (
              <Link
                key={entry.id ?? 'root'}
                component="button"
                underline="hover"
                onClick={() => handleBreadcrumbClick(index)}
              >
                {entry.name}
              </Link>
            ) : (
              <Typography key={entry.id ?? 'root'} color="text.primary">
                {entry.name}
              </Typography>
            )
          )}
        </Breadcrumbs>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {error}
          </Alert>
        )}

        {moveError && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {moveError}
          </Alert>
        )}

        {!loading && !error && (
          <List dense>
            {displayedFolders.map((folder) => (
              <ListItemButton
                key={folder.id}
                onClick={() => handleFolderClick(folder)}
              >
                <ListItemIcon>
                  <FolderIcon />
                </ListItemIcon>
                <ListItemText primary={folder.name} />
              </ListItemButton>
            ))}
            {displayedFolders.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                No subfolders
              </Typography>
            )}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          onClick={handleMove}
          variant="contained"
          disabled={moveDisabled}
        >
          Move here
        </Button>
      </DialogActions>
    </Dialog>
  );
}
