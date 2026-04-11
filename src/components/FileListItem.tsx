import React, { useState } from 'react';
import {
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  MoreVert,
  Image,
  VideoFile,
  AudioFile,
  PictureAsPdf,
  FolderZip,
  TableChart,
  Description,
  Code,
  InsertDriveFile,
  Visibility,
  Download,
  DriveFileRenameOutline,
  Share,
  Delete,
  DriveFileMove,
} from '@mui/icons-material';
import { IFile } from '../types';
import { getMimeIconName, isPreviewable } from '../utils/fileTypeHelpers';
import { formatFileSize, formatDate } from '../utils/formatters';
import { downloadFile } from '../api/fileService';
import { triggerDownloadFromBlob } from '../utils/downloadHelpers';
import { useNotification } from '../contexts/NotificationContext';

export interface FileListItemProps {
  file: IFile;
  isOwner: boolean;
  onPreview?: () => void;
  onRename?: () => void;
  onDelete?: () => void;
  onShare?: () => void;
  onMove?: () => void;
}

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

export default function FileListItem({
  file,
  isOwner,
  onPreview,
  onRename,
  onDelete,
  onShare,
  onMove,
}: FileListItemProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const [downloading, setDownloading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ id: file.id, type: 'file' }));
    e.dataTransfer.effectAllowed = 'move';
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };
  const { showNotification } = useNotification();

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleAction = (callback?: () => void) => {
    handleClose();
    callback?.();
  };

  const handleDownload = async () => {
    handleClose();
    setDownloading(true);
    try {
      const blob = await downloadFile(file.id);
      triggerDownloadFromBlob(blob, file.name);
    } catch {
      showNotification('Failed to download file', 'error');
    } finally {
      setDownloading(false);
    }
  };

  const iconName = getMimeIconName(file.mime_type);
  const FileIcon = iconMap[iconName] || InsertDriveFile;
  const previewable = isPreviewable(file.mime_type);

  return (
    <ListItem
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      sx={{ opacity: isDragging ? 0.5 : 1, cursor: 'grab' }}
      secondaryAction={
        <IconButton edge="end" aria-label="actions" onClick={handleOpen}>
          <MoreVert />
        </IconButton>
      }
    >
      <ListItemIcon>
        <FileIcon />
      </ListItemIcon>
      <ListItemText
        primary={file.name}
        secondary={`${formatFileSize(file.size_bytes)} — ${formatDate(file.updated_at)}`}
      />
      <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
        {previewable && (
          <MenuItem onClick={() => handleAction(onPreview)}>
            <ListItemIcon><Visibility fontSize="small" /></ListItemIcon>
            Preview
          </MenuItem>
        )}
        <MenuItem onClick={handleDownload} disabled={downloading}>
          <ListItemIcon><Download fontSize="small" /></ListItemIcon>
          {downloading ? 'Downloading…' : 'Download'}
        </MenuItem>
        {isOwner && (
          <MenuItem onClick={() => handleAction(onRename)}>
            <ListItemIcon><DriveFileRenameOutline fontSize="small" /></ListItemIcon>
            Rename
          </MenuItem>
        )}
        {isOwner && onMove && (
          <MenuItem onClick={() => handleAction(onMove)}>
            <ListItemIcon><DriveFileMove fontSize="small" /></ListItemIcon>
            Move to...
          </MenuItem>
        )}
        {isOwner && (
          <MenuItem onClick={() => handleAction(onShare)}>
            <ListItemIcon><Share fontSize="small" /></ListItemIcon>
            Share
          </MenuItem>
        )}
        {isOwner && (
          <MenuItem onClick={() => handleAction(onDelete)} sx={{ color: 'error.main' }}>
            <ListItemIcon><Delete fontSize="small" sx={{ color: 'error.main' }} /></ListItemIcon>
            Delete
          </MenuItem>
        )}
      </Menu>
    </ListItem>
  );
}
