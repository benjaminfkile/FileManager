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
  FormControl,
  InputLabel,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import { shareFile, unshareFile, getFileShares } from '../api/fileService';
import { shareFolder, unshareFolder, getFolderShares } from '../api/folderService';
import { searchUsers } from '../api/userService';
import { getShareLinks, createShareLink, deleteShareLink } from '../api/shareLinkService';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { ISharedUser, IUser, IPublicShareLink } from '../types';

export interface ShareDialogProps {
  open: boolean;
  itemId: string;
  itemType: 'file' | 'folder';
  itemName: string;
  ownerId: string;
  onClose: () => void;
}

type ExpiryOption = '1_day' | '7_days' | '30_days' | 'never';

function expiryToDate(option: ExpiryOption): string | null {
  const ms: Record<ExpiryOption, number | null> = {
    '1_day': 86400000,
    '7_days': 7 * 86400000,
    '30_days': 30 * 86400000,
    'never': null,
  };
  const offset = ms[option];
  return offset != null ? new Date(Date.now() + offset).toISOString() : null;
}

export default function ShareDialog({
  open,
  itemId,
  itemType,
  itemName,
  ownerId,
  onClose,
}: ShareDialogProps) {
  const { showNotification } = useNotification();
  const { currentUser } = useAuth();
  const [shares, setShares] = useState<ISharedUser[]>([]);
  const [loadingShares, setLoadingShares] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<IUser[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Share link state
  const [shareLink, setShareLink] = useState<IPublicShareLink | null>(null);
  const [loadingLink, setLoadingLink] = useState(false);
  const [creatingLink, setCreatingLink] = useState(false);
  const [expiryOption, setExpiryOption] = useState<ExpiryOption>('7_days');

  const isOwner = currentUser?.id === ownerId;

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
    setLoadingLink(true);
    try {
      const links = await getShareLinks(itemType, itemId);
      if (links.length > 0) {
        const sorted = [...links].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        setShareLink(sorted[0]);
      } else {
        setShareLink(null);
      }
    } catch {
      showNotification('Failed to load share link', 'error');
    } finally {
      setLoadingLink(false);
    }
  }, [itemId, itemType, showNotification]);

  useEffect(() => {
    if (open) {
      fetchShares();
      setSearchQuery('');
      setSearchResults([]);
      if (isOwner) {
        fetchShareLink();
      }
    }
  }, [open, fetchShares, fetchShareLink, isOwner]);

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
    setCreatingLink(true);
    try {
      const link = await createShareLink(itemType, itemId, expiryToDate(expiryOption));
      setShareLink(link);
      showNotification('Share link created', 'success');
    } catch {
      showNotification('Failed to create share link', 'error');
    } finally {
      setCreatingLink(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareLink) return;
    const url = `${window.location.origin}/share/${shareLink.token}`;
    try {
      await navigator.clipboard.writeText(url);
      showNotification('Link copied!', 'success');
    } catch {
      showNotification('Failed to copy link', 'error');
    }
  };

  const handleDeleteLink = async () => {
    if (!shareLink) return;
    try {
      await deleteShareLink(itemType, itemId, shareLink.id);
      setShareLink(null);
      showNotification('Share link removed', 'success');
    } catch {
      showNotification('Failed to remove share link', 'error');
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

        {isOwner && (
          <>
            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" gutterBottom>
              Shareable link
            </Typography>

            {loadingLink ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={24} />
              </Box>
            ) : shareLink ? (
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {`${window.location.origin}/share/${shareLink.token}`}
                  </Typography>
                  <IconButton
                    size="small"
                    aria-label="Copy link"
                    onClick={handleCopyLink}
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label="Delete link"
                    onClick={handleDeleteLink}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {shareLink.expiresAt
                    ? `Expires ${new Date(shareLink.expiresAt).toLocaleDateString()}`
                    : 'Never expires'}
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel id="expiry-select-label">Expiry</InputLabel>
                  <Select
                    labelId="expiry-select-label"
                    label="Expiry"
                    value={expiryOption}
                    onChange={(e) => setExpiryOption(e.target.value as ExpiryOption)}
                  >
                    <MenuItem value="1_day">1 day</MenuItem>
                    <MenuItem value="7_days">7 days</MenuItem>
                    <MenuItem value="30_days">30 days</MenuItem>
                    <MenuItem value="never">No expiry</MenuItem>
                  </Select>
                </FormControl>
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleCreateLink}
                  disabled={creatingLink}
                >
                  {creatingLink ? 'Creating...' : 'Create link'}
                </Button>
              </Box>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
