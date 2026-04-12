import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  List,
  Typography,
} from '@mui/material';
import { useNotification } from '../contexts/NotificationContext';
import { getSharedWithMe } from '../api/sharedService';
import { downloadFile } from '../api/fileService';
import { triggerDownloadFromBlob } from '../utils/downloadHelpers';
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
  const initialLoadDone = useRef(false);

  // Preview dialog
  const [previewTarget, setPreviewTarget] = useState<{ id: string; name: string } | null>(null);

  const fetchShared = useCallback(async () => {
    if (!initialLoadDone.current) setLoading(true);
    try {
      const data = await getSharedWithMe();
      setFolders(data.folders);
      setFiles(data.files);
      initialLoadDone.current = true;
    } catch {
      showNotification('Failed to load shared items', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    fetchShared();
  }, [fetchShared]);

  const handleFileDownload = async (file: IFile) => {
    try {
      const blob = await downloadFile(file.id);
      triggerDownloadFromBlob(blob, file.name);
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
                    isSharedWithMe
                    onClick={() => navigate(`/folder/${folder.id}`)}
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
