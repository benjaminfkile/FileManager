import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  List,
  Alert,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import {
  getFolder,
  GetFolderResponse,
  renameFolder,
  deleteFolder,
  moveFolder,
} from '../api/folderService';
import {
  downloadFile,
  renameFile,
  deleteFile,
  moveFile,
} from '../api/fileService';
import { triggerDownloadFromBlob } from '../utils/downloadHelpers';
import { IFolder, IFile, ISharedByUser } from '../types';
import { getSharedWithMe } from '../api/sharedService';
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

interface BreadcrumbItem {
  id: string | null;
  name: string;
}

export default function FolderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const fromShared = (location.state as { from?: string } | null)?.from === 'shared';
  const { currentUser } = useAuth();
  const { showNotification } = useNotification();

  const [, setFolder] = useState<IFolder | null>(null);
  const [subFolders, setSubFolders] = useState<IFolder[]>([]);
  const [files, setFiles] = useState<IFile[]>([]);
  const [sharedByMap, setSharedByMap] = useState<Record<string, ISharedByUser>>({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const initialLoadDone = useRef(false);

  // Breadcrumb state
  const [crumbs, setCrumbs] = useState<BreadcrumbItem[]>([]);

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

  const buildBreadcrumbs = useCallback(async (currentFolder: IFolder) => {
    const trail: BreadcrumbItem[] = [];
    let f: IFolder | null = currentFolder;

    // Walk up parent chain
    while (f && f.parent_folder_id) {
      trail.unshift({ id: f.id, name: f.name });
      try {
        const parentData: GetFolderResponse = await getFolder(f.parent_folder_id);
        f = parentData.folder;
      } catch {
        break;
      }
    }

    // Add the topmost folder if it has no parent
    if (f && !f.parent_folder_id) {
      trail.unshift({ id: f.id, name: f.name });
    }

    // Prepend root crumb — context-aware
    trail.unshift({ id: null, name: fromShared ? 'Shared with Me' : 'My Files' });
    setCrumbs(trail);
  }, [fromShared]);

  const fetchFolder = useCallback(async () => {
    if (!id) return;
    if (!initialLoadDone.current) setLoading(true);
    setNotFound(false);
    try {
      const [data, sharedData] = await Promise.all([
        getFolder(id),
        getSharedWithMe(),
      ]);
      setFolder(data.folder);
      setSubFolders(data.subFolders);
      setFiles(data.files);
      const map: Record<string, ISharedByUser> = {};
      for (const f of sharedData.folders) map[f.id] = f.shared_by;
      for (const f of sharedData.files) map[f.id] = f.shared_by;
      setSharedByMap(map);
      await buildBreadcrumbs(data.folder);
      initialLoadDone.current = true;
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'response' in err &&
        (err as { response?: { status?: number } }).response?.status === 404
      ) {
        setNotFound(true);
      } else {
        showNotification('Failed to load folder', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [id, showNotification, buildBreadcrumbs]);

  useEffect(() => {
    fetchFolder();
  }, [fetchFolder]);

  const handleBreadcrumbNavigate = (folderId: string | null) => {
    if (folderId) {
      navigate(`/folder/${folderId}`, { state: fromShared ? { from: 'shared' } : undefined });
    } else {
      navigate(fromShared ? '/shared' : '/');
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
      fetchFolder();
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
      fetchFolder();
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
      fetchFolder();
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
      fetchFolder();
    } catch {
      showNotification('Failed to move', 'error');
    }
  };

  const isOwner = (item: IFolder | IFile) => item.user_id === currentUser?.id;

  if (notFound) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">Folder not found</Alert>
      </Box>
    );
  }

  return (
    <Box>
      {!loading && crumbs.length > 0 && (
        <Breadcrumb crumbs={crumbs} onNavigate={handleBreadcrumbNavigate} />
      )}

      {loading ? (
        <LoadingSkeleton />
      ) : subFolders.length === 0 && files.length === 0 ? (
        <EmptyState
          title="This folder is empty"
          description="Upload a file or create a sub-folder to get started"
        />
      ) : (
        <List>
          {subFolders.map((sf) => (
            <FolderListItem
              key={sf.id}
              folder={sf}
              isOwner={isOwner(sf)}
              sharedBy={sharedByMap[sf.id]}
              onClick={() => navigate(`/folder/${sf.id}`, { state: fromShared ? { from: 'shared' } : undefined })}
              onRename={() => setRenameTarget({ id: sf.id, name: sf.name, type: 'folder' })}
              onDelete={() => setDeleteTarget({ id: sf.id, name: sf.name, type: 'folder' })}
              onShare={() => setShareTarget({ id: sf.id, name: sf.name, type: 'folder' })}
              onMove={() => setMoveTarget({ id: sf.id, name: sf.name, type: 'folder', currentFolderId: id ?? null })}
              onItemDropped={(draggedId, draggedType) =>
                handleItemDropped(sf.id, draggedId, draggedType)
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
        folderId={id ?? null}
        onFolderCreated={() => {
          showNotification('Folder created');
          fetchFolder();
        }}
        onFileUploaded={() => {
          showNotification('File uploaded');
          fetchFolder();
        }}
        onFolderUploaded={() => {
          showNotification('Folder uploaded');
          fetchFolder();
        }}
      />

      {/* Rename Dialog */}
      <RenameDialog
        open={!!renameTarget}
        currentName={renameTarget?.name ?? ''}
        itemType={renameTarget?.type ?? 'file'}
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
              const blob = await downloadFile(file.id);
              triggerDownloadFromBlob(blob, file.name);
            } catch {
              showNotification('Failed to download file', 'error');
            }
          }}
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
    </Box>
  );
}
