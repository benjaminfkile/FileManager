import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  List,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { getRootFolders, renameFolder, deleteFolder } from '../api/folderService';
import { IFolder } from '../types';
import Breadcrumb from '../components/Breadcrumb';
import LoadingSkeleton from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import FolderListItem from '../components/FolderListItem';
import DriveSpeedDial from '../components/DriveSpeedDial';
import RenameDialog from '../components/RenameDialog';
import DeleteConfirmationDialog from '../components/DeleteConfirmationDialog';
import ShareDialog from '../components/ShareDialog';

export default function DrivePage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { showNotification } = useNotification();

  const [folders, setFolders] = useState<IFolder[]>([]);
  const [loading, setLoading] = useState(true);

  // Rename dialog
  const [renameTarget, setRenameTarget] = useState<IFolder | null>(null);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<IFolder | null>(null);

  // Share dialog
  const [shareTarget, setShareTarget] = useState<IFolder | null>(null);

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
              onShare={() => setShareTarget(folder)}
            />
          ))}
        </List>
      )}

      {/* SpeedDial FAB */}
      <DriveSpeedDial
        folderId={null}
        onFolderCreated={() => {
          showNotification('Folder created');
          fetchFolders();
        }}
        onFileUploaded={() => {
          showNotification('File uploaded');
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
