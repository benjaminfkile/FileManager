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
} from '@mui/icons-material';
import { IFile } from '../types';
import { getMimeIconName, isPreviewable } from '../utils/fileTypeHelpers';
import { formatFileSize, formatDate } from '../utils/formatters';

export interface FileListItemProps {
  file: IFile;
  isOwner: boolean;
  onPreview?: () => void;
  onDownload?: () => void;
  onRename?: () => void;
  onDelete?: () => void;
  onShare?: () => void;
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
  onDownload,
  onRename,
  onDelete,
  onShare,
}: FileListItemProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

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

  const iconName = getMimeIconName(file.mime_type);
  const FileIcon = iconMap[iconName] || InsertDriveFile;
  const previewable = isPreviewable(file.mime_type);

  return (
    <ListItem
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
        <MenuItem onClick={() => handleAction(onDownload)}>
          <ListItemIcon><Download fontSize="small" /></ListItemIcon>
          Download
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
