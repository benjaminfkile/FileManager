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
  Tab,
  Tabs,
  Button,
  Chip,
  Tooltip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddLinkIcon from '@mui/icons-material/AddLink';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import { shareFile, unshareFile, getFileShares } from '../api/fileService';
import { shareFolder, unshareFolder, getFolderShares } from '../api/folderService';
import { searchUsers } from '../api/userService';
import {
  createShareLink,
  revokeShareLink,
  getShareLinksForItem,
} from '../api/shareLinkService';
import { useNotification } from '../contexts/NotificationContext';
import { IShareLink, ISharedUser, IUser } from '../types';
import { formatDate } from '../utils/formatters';

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
  const [tab, setTab] = useState(0);

  // ---- People tab state ----
  const [shares, setShares] = useState<ISharedUser[]>([]);
  const [loadingShares, setLoadingShares] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<IUser[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Links tab state ----
  const [links, setLinks] = useState<IShareLink[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [creatingLink, setCreatingLink] = useState(false);

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

  const fetchLinks = useCallback(async () => {
    setLoadingLinks(true);
    try {
      const data = await getShareLinksForItem(itemType, itemId);
      setLinks(data.links);
    } catch {
      showNotification('Failed to load share links', 'error');
    } finally {
      setLoadingLinks(false);
    }
  }, [itemId, itemType, showNotification]);

  useEffect(() => {
    if (open) {
      fetchShares();
      fetchLinks();
      setSearchQuery('');
      setSearchResults([]);
      setExpiresAt('');
      setTab(0);
    }
  }, [open, fetchShares, fetchLinks]);

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
      await createShareLink({
        itemType,
        itemId,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      });
      setExpiresAt('');
      await fetchLinks();
      showNotification('Share link created', 'success');
    } catch {
      showNotification('Failed to create share link', 'error');
    } finally {
      setCreatingLink(false);
    }
  };

  const handleRevokeLink = async (token: string) => {
    try {
      await revokeShareLink(token);
      await fetchLinks();
      showNotification('Share link revoked', 'success');
    } catch {
      showNotification('Failed to revoke share link', 'error');
    }
  };

  const handleCopyLink = (token: string) => {
    const url = `${window.location.origin}/share/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      showNotification('Link copied to clipboard', 'success');
    }).catch(() => {
      showNotification('Failed to copy link', 'error');
    });
  };

  const handleClose = () => {
    setSearchQuery('');
    setSearchResults([]);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Share &ldquo;{itemName}&rdquo;</DialogTitle>
      <DialogContent sx={{ pb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab label="People" />
          <Tab label="Links" />
        </Tabs>

        {tab === 0 && (
          <>
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
          </>
        )}

        {tab === 1 && (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Anyone with the link can view and download — but cannot edit or delete.
            </Typography>

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', mb: 2 }}>
              <TextField
                label="Expiry (optional)"
                type="datetime-local"
                size="small"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: new Date().toISOString().slice(0, 16) } }}
                sx={{ flex: 1 }}
              />
              <Button
                variant="contained"
                startIcon={creatingLink ? <CircularProgress size={16} color="inherit" /> : <AddLinkIcon />}
                onClick={handleCreateLink}
                disabled={creatingLink}
              >
                Create link
              </Button>
            </Box>

            <Divider sx={{ mb: 2 }} />

            {loadingLinks ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={24} />
              </Box>
            ) : links.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No active share links
              </Typography>
            ) : (
              <List dense data-testid="links-list">
                {links.map((link) => (
                  <ListItem key={link.id} component="li" sx={{ px: 0 }}>
                    <ListItemText
                      primary={
                        <Typography
                          variant="body2"
                          noWrap
                          sx={{ maxWidth: 280, fontFamily: 'monospace', fontSize: '0.75rem' }}
                        >
                          {`${window.location.origin}/share/${link.token}`}
                        </Typography>
                      }
                      slotProps={{ secondary: { component: 'span' } }}
                      secondary={
                        link.expires_at ? (
                          <Chip
                            size="small"
                            label={`Expires ${formatDate(link.expires_at)}`}
                            sx={{ mt: 0.5, height: 20, fontSize: '0.7rem' }}
                          />
                        ) : (
                          <Chip
                            size="small"
                            label="No expiry"
                            sx={{ mt: 0.5, height: 20, fontSize: '0.7rem' }}
                          />
                        )
                      }
                    />
                    <ListItemSecondaryAction>
                      <Tooltip title="Copy link">
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={() => handleCopyLink(link.token)}
                          sx={{ mr: 0.5 }}
                        >
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Revoke link">
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={() => handleRevokeLink(link.token)}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
