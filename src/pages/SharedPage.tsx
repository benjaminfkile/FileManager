import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  List,
  Typography,
} from '@mui/material';
import { useNotification } from '../contexts/NotificationContext';
import { getSharedWithMe } from '../api/sharedService';
import { downloadFolder } from '../api/folderService';
import { downloadFile } from '../api/fileService';
import { IFolder, IFile } from '../types';
import Breadcrumb from '../components/Breadcrumb';
import LoadingSkeleton from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import FolderListItem from '../components/FolderListItem';
import FileListItem from '../components/FileListItem';
import FilePreviewDialog from '../components/FilePreviewDialog';

export default function SharedPage() {
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  const [folders, setFolders] = useState<IFolder[]>([]);
  const [files, setFiles] = useState<IFile[]>([]);
  const [loading, setLoading] = useState(true);

  // Preview dialog
  const [previewTarget, setPreviewTarget] = useState<{ id: string; name: string } | null>(null);

  const fetchShared = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSharedWithMe();
      setFolders(data.folders);
      setFiles(data.files);
    } catch {
      showNotification('Failed to load shared items', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    fetchShared();
  }, [fetchShared]);

  const handleFolderDownload = async (folder: IFolder) => {
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

  const handleFileDownload = async (file: IFile) => {
    try {
      const response = await downloadFile(file.id);
      window.open(response.url, '_blank');
    } catch {
      showNotification('Failed to download file', 'error');
    }
  };

  const isEmpty = folders.length === 0 && files.length === 0;

  return (
    <Box>
      <Breadcrumb
        crumbs={[{ id: null, name: 'Shared with Me' }]}
        onNavigate={() => {}}
      />

      {loading ? (
        <LoadingSkeleton />
      ) : isEmpty ? (
        <EmptyState title="Nothing shared with you yet" />
      ) : (
        <>
          {folders.length > 0 && (
            <>
              <Typography variant="subtitle2" sx={{ px: 2, pt: 2 }}>
                Shared Folders
              </Typography>
              <List>
                {folders.map((folder) => (
                  <FolderListItem
                    key={folder.id}
                    folder={folder}
                    isOwner={false}
                    onClick={() => navigate(`/folder/${folder.id}`)}
                    onDownload={() => handleFolderDownload(folder)}
                  />
                ))}
              </List>
            </>
          )}
          {files.length > 0 && (
            <>
              <Typography variant="subtitle2" sx={{ px: 2, pt: 2 }}>
                Shared Files
              </Typography>
              <List>
                {files.map((file) => (
                  <FileListItem
                    key={file.id}
                    file={file}
                    isOwner={false}
                    onPreview={() => setPreviewTarget({ id: file.id, name: file.name })}
                    onDownload={() => handleFileDownload(file)}
                  />
                ))}
              </List>
            </>
          )}
        </>
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
