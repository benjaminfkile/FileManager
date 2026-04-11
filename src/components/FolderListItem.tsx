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
  Folder,
  FolderOpen,
  Download,
  DriveFileRenameOutline,
  Share,
  Delete,
  DriveFileMove,
} from '@mui/icons-material';
import { IFolder } from '../types';
import { formatDate } from '../utils/formatters';
import { downloadFolder } from '../api/folderService';
import { triggerDownloadFromBlob } from '../utils/downloadHelpers';
import { useNotification } from '../contexts/NotificationContext';

export interface FolderListItemProps {
  folder: IFolder;
  isOwner: boolean;
  onClick: () => void;
  onRename?: () => void;
  onDelete?: () => void;
  onShare?: () => void;
  onMove?: () => void;
  onItemDropped?: (draggedId: string, draggedType: 'file' | 'folder') => void;
}

export default function FolderListItem({
  folder,
  isOwner,
  onClick,
  onRename,
  onDelete,
  onShare,
  onMove,
  onItemDropped,
}: FolderListItemProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const [downloading, setDownloading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
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
      const blob = await downloadFolder(folder.id);
      triggerDownloadFromBlob(blob, `${folder.name}.zip`);
    } catch {
      showNotification('Failed to download folder', 'error');
    } finally {
      setDownloading(false);
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ id: folder.id, type: 'folder' }));
    e.dataTransfer.effectAllowed = 'move';
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json')) as {
        id: string;
        type: 'file' | 'folder';
      };
      // Prevent dropping a folder onto itself
      if (data.type === 'folder' && data.id === folder.id) return;
      onItemDropped?.(data.id, data.type);
    } catch {
      // Invalid drag data — ignore
    }
  };

  return (
    <ListItem
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={onClick}
      sx={{
        opacity: isDragging ? 0.5 : 1,
        outline: isDragOver ? '2px solid' : 'none',
        outlineColor: 'primary.main',
        borderRadius: 1,
        cursor: 'pointer',
      }}
      secondaryAction={
        <IconButton
          edge="end"
          aria-label="actions"
          onClick={(e) => {
            e.stopPropagation();
            handleOpen(e);
          }}
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
        secondary={formatDate(folder.created_at)}
      />
      <Menu anchorEl={anchorEl} open={open} onClose={handleClose} onClick={(e) => e.stopPropagation()}>
        <MenuItem onClick={() => handleAction(onClick)}>
          <ListItemIcon><FolderOpen fontSize="small" /></ListItemIcon>
          Open
        </MenuItem>
        <MenuItem onClick={handleDownload} disabled={downloading}>
          <ListItemIcon><Download fontSize="small" /></ListItemIcon>
          {downloading ? 'Downloading…' : 'Download as zip'}
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
