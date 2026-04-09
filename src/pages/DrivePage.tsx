import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  List,
  Fab,
  Menu,
  MenuItem,
  ListItemIcon,
  Snackbar,
  Alert,
} from '@mui/material';
import {
  Add,
  CreateNewFolder,
  UploadFile,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { getRootFolders, renameFolder, deleteFolder, downloadFolder } from '../api/folderService';
import { IFolder } from '../types';
import Breadcrumb from '../components/Breadcrumb';
import LoadingSkeleton from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import FolderListItem from '../components/FolderListItem';
import CreateFolderDialog from '../components/CreateFolderDialog';
import RenameDialog from '../components/RenameDialog';
import DeleteConfirmationDialog from '../components/DeleteConfirmationDialog';
import ShareDialog from '../components/ShareDialog';

export default function DrivePage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { showNotification } = useNotification();

  const [folders, setFolders] = useState<IFolder[]>([]);
  const [loading, setLoading] = useState(true);

  // FAB menu
  const [fabAnchor, setFabAnchor] = useState<null | HTMLElement>(null);

  // Create folder dialog
  const [createOpen, setCreateOpen] = useState(false);

  // Rename dialog
  const [renameTarget, setRenameTarget] = useState<IFolder | null>(null);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<IFolder | null>(null);

  // Share dialog
  const [shareTarget, setShareTarget] = useState<IFolder | null>(null);

  // Upload info snackbar
  const [uploadInfoOpen, setUploadInfoOpen] = useState(false);

  const fetchFolders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getRootFolders();
      setFolders(data);
    } catch {
      showNotification('Failed to load folders', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  const handleNavigate = (folderId: string | null) => {
    if (folderId) {
      navigate(`/folder/${folderId}`);
    } else {
      navigate('/');
    }
  };

  const handleDownload = async (folder: IFolder) => {
    try {
      const blob = await downloadFolder(folder.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${folder.name}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showNotification('Failed to download folder', 'error');
    }
  };

  const handleRename = async (newName: string) => {
    if (!renameTarget) return;
    await renameFolder(renameTarget.id, newName);
    showNotification('Folder renamed');
    fetchFolders();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteFolder(deleteTarget.id);
    showNotification('Folder moved to recycle bin');
    fetchFolders();
  };

  const isOwner = (folder: IFolder) => folder.user_id === currentUser?.id;

  return (
    <Box>
      <Breadcrumb
        crumbs={[{ id: null, name: 'My Files' }]}
        onNavigate={handleNavigate}
      />

      {loading ? (
        <LoadingSkeleton />
      ) : folders.length === 0 ? (
        <EmptyState
          title="No folders yet"
          description="Create a folder to get started"
        />
      ) : (
        <List>
          {folders.map((folder) => (
            <FolderListItem
              key={folder.id}
              folder={folder}
              isOwner={isOwner(folder)}
              onClick={() => navigate(`/folder/${folder.id}`)}
              onRename={() => setRenameTarget(folder)}
              onDelete={() => setDeleteTarget(folder)}
              onDownload={() => handleDownload(folder)}
              onShare={() => setShareTarget(folder)}
            />
          ))}
        </List>
      )}

      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="add"
        onClick={(e) => setFabAnchor(e.currentTarget)}
        sx={{ position: 'fixed', bottom: 24, right: 24 }}
      >
        <Add />
      </Fab>

      <Menu
        anchorEl={fabAnchor}
        open={Boolean(fabAnchor)}
        onClose={() => setFabAnchor(null)}
      >
        <MenuItem
          onClick={() => {
            setFabAnchor(null);
            setUploadInfoOpen(true);
          }}
        >
          <ListItemIcon><UploadFile fontSize="small" /></ListItemIcon>
          Upload file
        </MenuItem>
        <MenuItem
          onClick={() => {
            setFabAnchor(null);
            setCreateOpen(true);
          }}
        >
          <ListItemIcon><CreateNewFolder fontSize="small" /></ListItemIcon>
          Create folder
        </MenuItem>
      </Menu>

      {/* Upload info snackbar */}
      <Snackbar
        open={uploadInfoOpen}
        autoHideDuration={4000}
        onClose={() => setUploadInfoOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="info" onClose={() => setUploadInfoOpen(false)}>
          Open a folder first to upload files
        </Alert>
      </Snackbar>

      {/* Create Folder Dialog */}
      <CreateFolderDialog
        open={createOpen}
        parentFolderId={null}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          showNotification('Folder created');
          fetchFolders();
        }}
      />

      {/* Rename Dialog */}
      <RenameDialog
        open={!!renameTarget}
        currentName={renameTarget?.name ?? ''}
        itemType="folder"
        onClose={() => setRenameTarget(null)}
        onRename={handleRename}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={!!deleteTarget}
        title="Delete folder"
        description={`Are you sure you want to delete "${deleteTarget?.name ?? ''}"? It will be moved to the recycle bin.`}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />

      {/* Share Dialog */}
      {shareTarget && (
        <ShareDialog
          open={!!shareTarget}
          itemId={shareTarget.id}
          itemType="folder"
          itemName={shareTarget.name}
          onClose={() => setShareTarget(null)}
        />
      )}
    </Box>
  );
}
