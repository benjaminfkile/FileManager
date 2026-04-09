import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  downloadFolder,
} from '../api/folderService';
import {
  downloadFile,
  renameFile,
  deleteFile,
} from '../api/fileService';
import { IFolder, IFile } from '../types';
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

interface BreadcrumbItem {
  id: string | null;
  name: string;
}

export default function FolderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { showNotification } = useNotification();

  const [folder, setFolder] = useState<IFolder | null>(null);
  const [subFolders, setSubFolders] = useState<IFolder[]>([]);
  const [files, setFiles] = useState<IFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

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

    // Prepend "My Files" root
    trail.unshift({ id: null, name: 'My Files' });
    setCrumbs(trail);
  }, []);

  const fetchFolder = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setNotFound(false);
    try {
      const data = await getFolder(id);
      setFolder(data.folder);
      setSubFolders(data.subFolders);
      setFiles(data.files);
      await buildBreadcrumbs(data.folder);
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
      navigate(`/folder/${folderId}`);
    } else {
      navigate('/');
    }
  };

  // Folder actions
  const handleFolderDownload = async (f: IFolder) => {
    try {
      const blob = await downloadFolder(f.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${f.name}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showNotification('Failed to download folder', 'error');
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

  // File actions
  const handleFileDownload = async (file: IFile) => {
    try {
      const response = await downloadFile(file.id);
      window.open(response.url, '_blank');
    } catch {
      showNotification('Failed to download file', 'error');
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
              onClick={() => navigate(`/folder/${sf.id}`)}
              onRename={() => setRenameTarget({ id: sf.id, name: sf.name, type: 'folder' })}
              onDelete={() => setDeleteTarget({ id: sf.id, name: sf.name, type: 'folder' })}
              onDownload={() => handleFolderDownload(sf)}
              onShare={() => setShareTarget({ id: sf.id, name: sf.name, type: 'folder' })}
            />
          ))}
          {files.map((file) => (
            <FileListItem
              key={file.id}
              file={file}
              isOwner={isOwner(file)}
              onPreview={() => setPreviewTarget({ id: file.id, name: file.name })}
              onDownload={() => handleFileDownload(file)}
              onRename={() => setRenameTarget({ id: file.id, name: file.name, type: 'file' })}
              onDelete={() => setDeleteTarget({ id: file.id, name: file.name, type: 'file' })}
              onShare={() => setShareTarget({ id: file.id, name: file.name, type: 'file' })}
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
          onDownload={() => {
            const file = files.find((f) => f.id === previewTarget.id);
            if (file) handleFileDownload(file);
          }}
        />
      )}
    </Box>
  );
}
