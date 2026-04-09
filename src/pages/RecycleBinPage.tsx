import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  List,
  Typography,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Menu,
  MenuItem,
  Button,
  Toolbar,
} from '@mui/material';
import {
  MoreVert,
  Folder,
  RestoreFromTrash,
  DeleteForever,
  DeleteSweep,
} from '@mui/icons-material';
import { useNotification } from '../contexts/NotificationContext';
import { getRecycleBin, restoreAll, emptyRecycleBin } from '../api/recycleBinService';
import { restoreFile, permanentDeleteFile } from '../api/fileService';
import { restoreFolder, permanentDeleteFolder } from '../api/folderService';
import { IFolder, IFile } from '../types';
import { formatDate } from '../utils/formatters';
import { formatFileSize } from '../utils/formatters';
import { getMimeIconName } from '../utils/fileTypeHelpers';
import Breadcrumb from '../components/Breadcrumb';
import LoadingSkeleton from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import DeleteConfirmationDialog from '../components/DeleteConfirmationDialog';
import {
  Image,
  VideoFile,
  AudioFile,
  PictureAsPdf,
  FolderZip,
  TableChart,
  Description,
  Code,
  InsertDriveFile,
} from '@mui/icons-material';
import axios from 'axios';

const iconMap: Record<string, React.ElementType> = {
  Image,
  VideoFile,
  AudioFile,
  PictureAsPdf,
  FolderZip,
  TableChart,
  Description,
  Code,
  InsertDriveFile,
};

export default function RecycleBinPage() {
  const { showNotification } = useNotification();

  const [folders, setFolders] = useState<IFolder[]>([]);
  const [files, setFiles] = useState<IFile[]>([]);
  const [loading, setLoading] = useState(true);

  const [emptyDialogOpen, setEmptyDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'file' | 'folder'; id: string; name: string } | null>(null);

  // Menu anchor for individual items
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; type: 'file' | 'folder'; id: string } | null>(null);

  const fetchBin = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getRecycleBin();
      setFolders(data.folders);
      setFiles(data.files);
    } catch {
      showNotification('Failed to load recycle bin', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    fetchBin();
  }, [fetchBin]);

  const handleRestoreAll = async () => {
    try {
      await restoreAll();
      showNotification('All items restored');
      await fetchBin();
    } catch {
      showNotification('Failed to restore items', 'error');
    }
  };

  const handleEmptyBin = async () => {
    await emptyRecycleBin();
    showNotification('Recycle bin emptied');
    await fetchBin();
  };

  const handleRestoreFolder = async (folder: IFolder) => {
    try {
      await restoreFolder(folder.id);
      showNotification(`Restored "${folder.name}"`);
      await fetchBin();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        const message = err.response.data?.message || err.response.data?.error || 'Cannot restore folder — parent is also in recycle bin';
        showNotification(message, 'error');
      } else {
        showNotification('Failed to restore folder', 'error');
      }
    }
  };

  const handleRestoreFile = async (file: IFile) => {
    try {
      await restoreFile(file.id);
      showNotification(`Restored "${file.name}"`);
      await fetchBin();
    } catch {
      showNotification('Failed to restore file', 'error');
    }
  };

  const handlePermanentDeleteFolder = async (id: string) => {
    await permanentDeleteFolder(id);
    showNotification('Folder permanently deleted');
    await fetchBin();
  };

  const handlePermanentDeleteFile = async (id: string) => {
    await permanentDeleteFile(id);
    showNotification('File permanently deleted');
    await fetchBin();
  };

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>, type: 'file' | 'folder', id: string) => {
    e.stopPropagation();
    setMenuAnchor({ el: e.currentTarget, type, id });
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const isEmpty = folders.length === 0 && files.length === 0;

  return (
    <Box>
      <Breadcrumb
        crumbs={[{ id: null, name: 'Recycle Bin' }]}
        onNavigate={() => {}}
      />

      {loading ? (
        <LoadingSkeleton />
      ) : isEmpty ? (
        <EmptyState title="Recycle Bin is empty" />
      ) : (
        <>
          <Toolbar sx={{ gap: 1, px: 2, justifyContent: 'flex-end' }}>
            <Button
              startIcon={<RestoreFromTrash />}
              onClick={handleRestoreAll}
            >
              Restore All
            </Button>
            <Button
              startIcon={<DeleteSweep />}
              color="error"
              variant="outlined"
              onClick={() => setEmptyDialogOpen(true)}
            >
              Empty Bin
            </Button>
          </Toolbar>

          {folders.length > 0 && (
            <>
              <Typography variant="subtitle2" sx={{ px: 2, pt: 2 }}>
                Deleted Folders
              </Typography>
              <List>
                {folders.map((folder) => (
                  <ListItem
                    key={folder.id}
                    secondaryAction={
                      <IconButton
                        edge="end"
                        aria-label="actions"
                        onClick={(e) => handleMenuOpen(e, 'folder', folder.id)}
                      >
                        <MoreVert />
                      </IconButton>
                    }
                  >
                    <ListItemIcon>
                      <Folder sx={{ color: 'amber.A700' }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={folder.name}
                      secondary={`Deleted ${formatDate(folder.deleted_at ?? folder.updated_at)}`}
                    />
                  </ListItem>
                ))}
              </List>
            </>
          )}

          {files.length > 0 && (
            <>
              <Typography variant="subtitle2" sx={{ px: 2, pt: 2 }}>
                Deleted Files
              </Typography>
              <List>
                {files.map((file) => {
                  const iconName = getMimeIconName(file.mime_type);
                  const FileIcon = iconMap[iconName] || InsertDriveFile;
                  return (
                    <ListItem
                      key={file.id}
                      secondaryAction={
                        <IconButton
                          edge="end"
                          aria-label="actions"
                          onClick={(e) => handleMenuOpen(e, 'file', file.id)}
                        >
                          <MoreVert />
                        </IconButton>
                      }
                    >
                      <ListItemIcon>
                        <FileIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary={file.name}
                        secondary={`${formatFileSize(file.size_bytes)} — Deleted ${formatDate(file.deleted_at ?? file.updated_at)}`}
                      />
                    </ListItem>
                  );
                })}
              </List>
            </>
          )}

          {/* Item action menu */}
          <Menu
            anchorEl={menuAnchor?.el ?? null}
            open={Boolean(menuAnchor)}
            onClose={handleMenuClose}
          >
            <MenuItem
              onClick={() => {
                if (!menuAnchor) return;
                handleMenuClose();
                if (menuAnchor.type === 'folder') {
                  const folder = folders.find((f) => f.id === menuAnchor.id);
                  if (folder) handleRestoreFolder(folder);
                } else {
                  const file = files.find((f) => f.id === menuAnchor.id);
                  if (file) handleRestoreFile(file);
                }
              }}
            >
              <ListItemIcon><RestoreFromTrash fontSize="small" /></ListItemIcon>
              Restore
            </MenuItem>
            <MenuItem
              onClick={() => {
                if (!menuAnchor) return;
                const { type, id } = menuAnchor;
                const name = type === 'folder'
                  ? folders.find((f) => f.id === id)?.name ?? ''
                  : files.find((f) => f.id === id)?.name ?? '';
                handleMenuClose();
                setDeleteTarget({ type, id, name });
              }}
              sx={{ color: 'error.main' }}
            >
              <ListItemIcon><DeleteForever fontSize="small" sx={{ color: 'error.main' }} /></ListItemIcon>
              Delete permanently
            </MenuItem>
          </Menu>

          {/* Empty bin confirmation dialog */}
          <DeleteConfirmationDialog
            open={emptyDialogOpen}
            isDangerous
            title="Empty Recycle Bin?"
            description="This will permanently delete all items. This action cannot be undone."
            confirmLabel="Empty Bin"
            onClose={() => setEmptyDialogOpen(false)}
            onConfirm={handleEmptyBin}
          />

          {/* Permanent delete single item dialog */}
          <DeleteConfirmationDialog
            open={!!deleteTarget}
            isDangerous
            title={`Permanently delete "${deleteTarget?.name}"?`}
            description="This action cannot be undone."
            onClose={() => setDeleteTarget(null)}
            onConfirm={async () => {
              if (!deleteTarget) return;
              if (deleteTarget.type === 'folder') {
                await handlePermanentDeleteFolder(deleteTarget.id);
              } else {
                await handlePermanentDeleteFile(deleteTarget.id);
              }
              setDeleteTarget(null);
            }}
          />
        </>
      )}
    </Box>
  );
}
