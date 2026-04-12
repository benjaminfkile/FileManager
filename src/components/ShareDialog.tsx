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
  Button,
  Select,
  MenuItem,
  InputAdornment,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopy from '@mui/icons-material/ContentCopy';
import { shareFile, unshareFile, getFileShares } from '../api/fileService';
import { shareFolder, unshareFolder, getFolderShares } from '../api/folderService';
import {
  createFileShareLink,
  createFolderShareLink,
  revokeFileShareLink,
  revokeFolderShareLink,
  getFileShareLink,
  getFolderShareLink,
} from '../api/shareLinkService';
import { searchUsers } from '../api/userService';
import { useNotification } from '../contexts/NotificationContext';
import { ISharedUser, IUser, IShareLink } from '../types';

const EXPIRY_OPTIONS = [
  { label: '1 hour',   value: 3600 },
  { label: '24 hours', value: 86400 },
  { label: '7 days',   value: 604800 },
  { label: '30 days',  value: 2592000 },
  { label: 'Never',    value: null },
];

export interface ShareDialogProps {
  open: boolean;
  itemId: string;
  itemType: 'file' | 'folder';
  itemName: string;
  isOwner: boolean;
  onClose: () => void;
}

export default function ShareDialog({
  open,
  itemId,
  itemType,
  itemName,
  isOwner,
  onClose,
}: ShareDialogProps) {
  const { showNotification } = useNotification();
  const [shares, setShares] = useState<ISharedUser[]>([]);
  const [loadingShares, setLoadingShares] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<IUser[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Shareable link state
  const [shareLink, setShareLink] = useState<IShareLink | null>(null);
  const [loadingLink, setLoadingLink] = useState(false);
  const [expiresInSeconds, setExpiresInSeconds] = useState<number | null>(604800); // default: 7 days

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

  const fetchShareLink = useCallback(async () => {
    if (!isOwner) return;
    setLoadingLink(true);
    try {
      const link =
        itemType === 'file'
          ? await getFileShareLink(itemId)
          : await getFolderShareLink(itemId);
      setShareLink(link);
    } catch {
      // No link exists or failed to fetch — leave as null
      setShareLink(null);
    } finally {
      setLoadingLink(false);
    }
  }, [itemId, itemType, isOwner]);

  useEffect(() => {
    if (open) {
      fetchShares();
      fetchShareLink();
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [open, fetchShares, fetchShareLink]);

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

  const handleCreateLink = async () => {
    setLoadingLink(true);
    try {
      const link =
        itemType === 'file'
          ? await createFileShareLink(itemId, expiresInSeconds)
          : await createFolderShareLink(itemId, expiresInSeconds);
      setShareLink(link);
      showNotification('Link created', 'success');
    } catch {
      showNotification('Failed to create link', 'error');
    } finally {
      setLoadingLink(false);
    }
  };

  const handleRevokeLink = async () => {
    try {
      if (itemType === 'file') {
        await revokeFileShareLink(itemId);
      } else {
        await revokeFolderShareLink(itemId);
      }
      setShareLink(null);
      showNotification('Link revoked', 'success');
    } catch {
      showNotification('Failed to revoke link', 'error');
    }
  };

  const handleCopyLink = async () => {
    if (!shareLink) return;
    const url = `${window.location.origin}/s/${shareLink.token}`;
    await navigator.clipboard.writeText(url);
    showNotification('Link copied to clipboard', 'success');
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

        {isOwner && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom>Shareable Link</Typography>

            {loadingLink ? (
              <CircularProgress size={20} />
            ) : shareLink ? (
              <Box>
                <TextField
                  fullWidth
                  size="small"
                  value={`${window.location.origin}/s/${shareLink.token}`}
                  slotProps={{
                    input: {
                      readOnly: true,
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={handleCopyLink} aria-label="copy link">
                            <ContentCopy fontSize="small" />
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  {shareLink.expires_at
                    ? `Expires ${new Date(shareLink.expires_at).toLocaleDateString()}`
                    : 'Never expires'}
                </Typography>
                <Button
                  size="small"
                  color="error"
                  onClick={handleRevokeLink}
                  sx={{ mt: 1 }}
                >
                  Revoke link
                </Button>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Select
                  size="small"
                  value={expiresInSeconds}
                  onChange={(e) => setExpiresInSeconds(e.target.value as number | null)}
                >
                  {EXPIRY_OPTIONS.map((opt) => (
                    <MenuItem key={String(opt.value)} value={opt.value as any}>{opt.label}</MenuItem>
                  ))}
                </Select>
                <Button variant="outlined" size="small" onClick={handleCreateLink}>
                  Create link
                </Button>
              </Box>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
