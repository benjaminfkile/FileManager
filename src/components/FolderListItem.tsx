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
}

export default function FolderListItem({
  folder,
  isOwner,
  onClick,
  onRename,
  onDelete,
  onShare,
}: FolderListItemProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const [downloading, setDownloading] = useState(false);
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

  return (
    <ListItem
      onClick={onClick}
      sx={{ cursor: 'pointer' }}
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
