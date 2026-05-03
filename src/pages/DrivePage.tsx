import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  List,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { getRootFolders, renameFolder, deleteFolder, moveFolder } from '../api/folderService';
import { getRootFiles, downloadFile, renameFile, deleteFile, moveFile } from '../api/fileService';
import { getSharedWithMe } from '../api/sharedService';
import { triggerDownloadFromUrl } from '../utils/downloadHelpers';
import { IFolder, IFile, ISharedByUser } from '../types';
import Breadcrumb from '../components/Breadcrumb';
import LoadingSkeleton from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import FolderListItem from '../components/FolderListItem';
import FileListItem from '../components/FileListItem';
import DriveSpeedDial from '../components/DriveSpeedDial';
import RenameDialog from '../components/RenameDialog';
import DeleteConfirmationDialog from '../components/DeleteConfirmationDialog';
import ShareDialog from '../components/ShareDialog';
import FilePreviewDialog from '../components/FilePreviewDialog';
import MoveDialog from '../components/MoveDialog';

export default function DrivePage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { showNotification } = useNotification();

  const [folders, setFolders] = useState<IFolder[]>([]);
  const [files, setFiles] = useState<IFile[]>([]);
  const [sharedByMap, setSharedByMap] = useState<Record<string, ISharedByUser>>({});
  const [loading, setLoading] = useState(true);
  const initialLoadDone = useRef(false);

  // Rename dialog
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string; type: 'file' | 'folder' } | null>(null);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; type: 'file' | 'folder' } | null>(null);

  // Share dialog
  const [shareTarget, setShareTarget] = useState<{ id: string; name: string; type: 'file' | 'folder' } | null>(null);

  // Preview dialog
  const [previewTarget, setPreviewTarget] = useState<{ id: string; name: string } | null>(null);

  // Move dialog
  const [moveTarget, setMoveTarget] = useState<{
    id: string;
    name: string;
    type: 'file' | 'folder';
    currentFolderId: string | null;
  } | null>(null);

  const fetchData = useCallback(async () => {
    if (!initialLoadDone.current) setLoading(true);
    try {
      const [fetchedFolders, fetchedFiles, sharedData] = await Promise.all([
        getRootFolders(),
        getRootFiles(),
        getSharedWithMe(),
      ]);
      setFolders(fetchedFolders);
      setFiles(fetchedFiles);
      const map: Record<string, ISharedByUser> = {};
      for (const f of sharedData.folders) map[f.id] = f.shared_by;
      for (const f of sharedData.files) map[f.id] = f.shared_by;
      setSharedByMap(map);
      initialLoadDone.current = true;
    } catch {
      showNotification('Failed to load files', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleNavigate = (folderId: string | null) => {
    if (folderId) {
      navigate(`/folder/${folderId}`);
    } else {
      navigate('/');
    }
  };

  const handleRename = async (newName: string) => {
    if (!renameTarget) return;
    try {
      if (renameTarget.type === 'folder') {
        await renameFolder(renameTarget.id, newName);
      } else {
        await renameFile(renameTarget.id, newName);
      }
      showNotification(`${renameTarget.type === 'folder' ? 'Folder' : 'File'} renamed`);
      fetchData();
    } catch {
      showNotification('Failed to rename', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === 'folder') {
        await deleteFolder(deleteTarget.id);
      } else {
        await deleteFile(deleteTarget.id);
      }
      showNotification(`${deleteTarget.type === 'folder' ? 'Folder' : 'File'} moved to recycle bin`);
      fetchData();
    } catch {
      showNotification('Failed to delete', 'error');
    }
  };

  const handleMove = async (targetFolderId: string | null) => {
    if (!moveTarget) return;
    try {
      if (moveTarget.type === 'file') {
        await moveFile(moveTarget.id, targetFolderId);
      } else {
        await moveFolder(moveTarget.id, targetFolderId);
      }
      showNotification('Moved successfully');
      setMoveTarget(null);
      fetchData();
    } catch {
      showNotification('Failed to move', 'error');
    }
  };

  const handleItemDropped = async (
    targetFolderId: string,
    draggedId: string,
    draggedType: 'file' | 'folder',
  ) => {
    try {
      if (draggedType === 'file') {
        await moveFile(draggedId, targetFolderId);
      } else {
        await moveFolder(draggedId, targetFolderId);
      }
      showNotification('Moved successfully');
      fetchData();
    } catch {
      showNotification('Failed to move', 'error');
    }
  };

  const isOwner = (item: IFolder | IFile) => item.user_id === currentUser?.id;

  return (
    <Box>
      <Breadcrumb
        crumbs={[{ id: null, name: 'My Files' }]}
        onNavigate={handleNavigate}
      />

      {loading ? (
        <LoadingSkeleton />
      ) : folders.length === 0 && files.length === 0 ? (
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
              sharedBy={sharedByMap[folder.id]}
              onClick={() => navigate(`/folder/${folder.id}`)}
              onRename={() => setRenameTarget({ id: folder.id, name: folder.name, type: 'folder' })}
              onDelete={() => setDeleteTarget({ id: folder.id, name: folder.name, type: 'folder' })}
              onShare={() => setShareTarget({ id: folder.id, name: folder.name, type: 'folder' })}
              onMove={() => setMoveTarget({ id: folder.id, name: folder.name, type: 'folder', currentFolderId: null })}
              onItemDropped={(draggedId, draggedType) =>
                handleItemDropped(folder.id, draggedId, draggedType)
              }
            />
          ))}
          {files.map((file) => (
            <FileListItem
              key={file.id}
              file={file}
              isOwner={isOwner(file)}
              sharedBy={sharedByMap[file.id]}
              onPreview={() => setPreviewTarget({ id: file.id, name: file.name })}
              onRename={() => setRenameTarget({ id: file.id, name: file.name, type: 'file' })}
              onDelete={() => setDeleteTarget({ id: file.id, name: file.name, type: 'file' })}
              onShare={() => setShareTarget({ id: file.id, name: file.name, type: 'file' })}
              onMove={() => setMoveTarget({ id: file.id, name: file.name, type: 'file', currentFolderId: file.folder_id })}
            />
          ))}
        </List>
      )}

      {/* SpeedDial FAB */}
      <DriveSpeedDial
        folderId={null}
        onFolderCreated={() => {
          showNotification('Folder created');
          fetchData();
        }}
        onFileUploaded={() => {
          showNotification('File uploaded');
          fetchData();
        }}
        onFolderUploaded={() => {
          showNotification('Folder uploaded');
          fetchData();
        }}
      />

      {/* Rename Dialog */}
      <RenameDialog
        open={!!renameTarget}
        currentName={renameTarget?.name ?? ''}
        itemType={renameTarget?.type ?? 'folder'}
        onClose={() => setRenameTarget(null)}
        onRename={handleRename}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={!!deleteTarget}
        title={`Delete ${deleteTarget?.type ?? 'item'}`}
        description={`Are you sure you want to delete "${deleteTarget?.name ?? ''}"? It will be moved to the recycle bin.`}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />

      {/* Share Dialog */}
      {shareTarget && (
        <ShareDialog
          open={!!shareTarget}
          itemId={shareTarget.id}
          itemType={shareTarget.type}
          itemName={shareTarget.name}
          onClose={() => setShareTarget(null)}
        />
      )}

      {/* Move Dialog */}
      {moveTarget && (
        <MoveDialog
          open={!!moveTarget}
          itemId={moveTarget.id}
          itemType={moveTarget.type}
          itemName={moveTarget.name}
          currentFolderId={moveTarget.currentFolderId}
          onClose={() => setMoveTarget(null)}
          onMove={handleMove}
        />
      )}

      {/* File Preview Dialog */}
      {previewTarget && (
        <FilePreviewDialog
          open={!!previewTarget}
          fileId={previewTarget.id}
          fileName={previewTarget.name}
          onClose={() => setPreviewTarget(null)}
          onDownload={async () => {
            const file = files.find((f) => f.id === previewTarget.id);
            if (!file) return;
            try {
              const { url } = await downloadFile(file.id);
              await triggerDownloadFromUrl(url, file.name);
            } catch {
              showNotification('Failed to download file', 'error');
            }
          }}
        />
      )}
    </Box>
  );
}
