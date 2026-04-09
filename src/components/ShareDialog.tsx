import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  CircularProgress,
  Box,
  Divider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { shareFile, unshareFile, getFileShares } from '../api/fileService';
import { shareFolder, unshareFolder, getFolderShares } from '../api/folderService';
import { searchUsers } from '../api/userService';
import { useNotification } from '../contexts/NotificationContext';
import { ISharedUser, IUser } from '../types';

export interface ShareDialogProps {
  open: boolean;
  itemId: string;
  itemType: 'file' | 'folder';
  itemName: string;
  onClose: () => void;
}

export default function ShareDialog({
  open,
  itemId,
  itemType,
  itemName,
  onClose,
}: ShareDialogProps) {
  const { showNotification } = useNotification();
  const [shares, setShares] = useState<ISharedUser[]>([]);
  const [loadingShares, setLoadingShares] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<IUser[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchShares = useCallback(async () => {
    setLoadingShares(true);
    try {
      const data =
        itemType === 'file'
          ? await getFileShares(itemId)
          : await getFolderShares(itemId);
      setShares(data.sharedWith);
    } catch {
      showNotification('Failed to load shares', 'error');
    } finally {
      setLoadingShares(false);
    }
  }, [itemId, itemType, showNotification]);

  useEffect(() => {
    if (open) {
      fetchShares();
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [open, fetchShares]);

  useEffect(() => {
    if (!open) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const users = await searchUsers(searchQuery.trim());
        setSearchResults(users);
      } catch {
        showNotification('Failed to search users', 'error');
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchQuery, open, showNotification]);

  const handleAddShare = async (user: IUser) => {
    try {
      if (itemType === 'file') {
        await shareFile(itemId, user.username);
      } else {
        await shareFolder(itemId, user.username);
      }
      showNotification(`Shared with ${user.username}`, 'success');
      setSearchQuery('');
      setSearchResults([]);
      await fetchShares();
    } catch {
      showNotification(`Failed to share with ${user.username}`, 'error');
    }
  };

  const handleRemoveShare = async (sharedUser: ISharedUser) => {
    try {
      if (itemType === 'file') {
        await unshareFile(itemId, sharedUser.id);
      } else {
        await unshareFolder(itemId, sharedUser.id);
      }
      showNotification(`Removed share with ${sharedUser.username}`, 'success');
      await fetchShares();
    } catch {
      showNotification(`Failed to remove share with ${sharedUser.username}`, 'error');
    }
  };

  const handleClose = () => {
    setSearchQuery('');
    setSearchResults([]);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Share &ldquo;{itemName}&rdquo;</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="Search users"
          fullWidth
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Type a username to search..."
        />

        {searching && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        {searchResults.length > 0 && (
          <List dense data-testid="search-results">
            {searchResults.map((user) => (
              <ListItem
                key={user.id}
                component="li"
                onClick={() => handleAddShare(user)}
                sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
              >
                <ListItemText
                  primary={user.username}
                  secondary={`${user.first_name} ${user.last_name}`}
                />
              </ListItem>
            ))}
          </List>
        )}

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" gutterBottom>
          Shared with
        </Typography>

        {loadingShares ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : shares.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Not shared with anyone
          </Typography>
        ) : (
          <List dense data-testid="shares-list">
            {shares.map((sharedUser) => (
              <ListItem key={sharedUser.id} component="li">
                <ListItemText
                  primary={sharedUser.username}
                  secondary={`${sharedUser.first_name} ${sharedUser.last_name}`}
                />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    aria-label={`remove ${sharedUser.username}`}
                    onClick={() => handleRemoveShare(sharedUser)}
                    size="small"
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
    </Dialog>
  );
}
