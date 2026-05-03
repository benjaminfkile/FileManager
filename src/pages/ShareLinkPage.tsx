import React, { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  AppBar,
  Box,
  CircularProgress,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import DownloadIcon from '@mui/icons-material/Download';
import VisibilityIcon from '@mui/icons-material/Visibility';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import {
  resolveShareLink,
  browseFolderViaLink,
  previewFileViaLink,
  downloadFileViaLink,
  downloadFolderViaLink,
  ResolvedFileLinkResponse,
  ResolvedFolderLinkResponse,
} from '../api/shareLinkService';
import { triggerDownloadFromUrl, triggerDownloadFromBlob } from '../utils/downloadHelpers';
import { IFile, IFolder } from '../types';
import { isPreviewable } from '../utils/fileTypeHelpers';
import { formatFileSize, formatDate } from '../utils/formatters';
import FilePreviewDialog from '../components/FilePreviewDialog';
import LoadingSkeleton from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';

interface BreadcrumbItem {
  id: string;
  name: string;
}

export default function ShareLinkPage() {
  const { token } = useParams<{ token: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Root item resolved from the token
  const [rootItemType, setRootItemType] = useState<'file' | 'folder' | null>(null);
  const [rootFile, setRootFile] = useState<IFile | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  // Current folder view
  const [currentFolders, setCurrentFolders] = useState<IFolder[]>([]);
  const [currentFiles, setCurrentFiles] = useState<IFile[]>([]);
  const [currentFolderName, setCurrentFolderName] = useState<string>('');

  // Breadcrumb for folder navigation
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([]);

  // Preview dialog
  const [previewTarget, setPreviewTarget] = useState<{ id: string; name: string } | null>(null);

  // Downloading state per file
  const [downloading, setDownloading] = useState<string | null>(null);

  // Downloading state for folder ZIP
  const [downloadingFolder, setDownloadingFolder] = useState(false);

  const resolveRoot = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await resolveShareLink(token);
      setExpiresAt(result.linkInfo.expires_at);

      if (result.itemType === 'file') {
        const res = result as ResolvedFileLinkResponse;
        setRootItemType('file');
        setRootFile(res.file);
        // Open the preview immediately
        setPreviewTarget({ id: res.file.id, name: res.file.name });
      } else {
        const res = result as ResolvedFolderLinkResponse;
        setRootItemType('folder');
        setCurrentFolderName(res.folder.name);
        setCurrentFolders(res.subFolders);
        setCurrentFiles(res.files);
        setBreadcrumb([{ id: res.folder.id, name: res.folder.name }]);
      }
    } catch {
      setError('This link is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    resolveRoot();
  }, [resolveRoot]);

  const handleFolderClick = async (folder: IFolder) => {
    if (!token) return;
    try {
      const result = await browseFolderViaLink(token, folder.id);
      setCurrentFolderName(result.folder.name);
      setCurrentFolders(result.subFolders);
      setCurrentFiles(result.files);
      setBreadcrumb((prev) => [...prev, { id: result.folder.id, name: result.folder.name }]);
    } catch {
      // Silently ignore navigation errors; item may no longer be accessible
    }
  };

  const handleBreadcrumbClick = async (index: number) => {
    if (!token) return;
    const crumb = breadcrumb[index];
    if (!crumb) return;

    if (index === 0) {
      // Navigate back to root
      setLoading(true);
      try {
        const result = await resolveShareLink(token);
        if (result.itemType === 'folder') {
          const res = result as ResolvedFolderLinkResponse;
          setCurrentFolderName(res.folder.name);
          setCurrentFolders(res.subFolders);
          setCurrentFiles(res.files);
          setBreadcrumb([{ id: res.folder.id, name: res.folder.name }]);
        }
      } catch {
        setError('This link is invalid or has expired.');
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const result = await browseFolderViaLink(token, crumb.id);
      setCurrentFolderName(result.folder.name);
      setCurrentFolders(result.subFolders);
      setCurrentFiles(result.files);
      setBreadcrumb((prev) => prev.slice(0, index + 1));
    } catch {
      // ignore
    }
  };

  const handleDownload = async (file: IFile) => {
    if (!token) return;
    setDownloading(file.id);
    try {
      const { url } = await downloadFileViaLink(token, file.id);
      await triggerDownloadFromUrl(url, file.name);
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadFolder = async () => {
    if (!token) return;
    const folderId = breadcrumb[breadcrumb.length - 1]?.id;
    if (!folderId) return;
    setDownloadingFolder(true);
    try {
      const blob = await downloadFolderViaLink(token, folderId);
      triggerDownloadFromBlob(blob, `${currentFolderName}.zip`);
    } finally {
      setDownloadingFolder(false);
    }
  };

  const previewFetcher = useCallback(
    (fileId: string) => previewFileViaLink(token!, fileId),
    [token]
  );

  const previewDownload = useCallback(() => {
    if (previewTarget && token) {
      handleDownload({ id: previewTarget.id, name: previewTarget.name } as IFile);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewTarget, token]);

  // ---- Error / loading states ----
  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <SharedLinkAppBar />
        <Box sx={{ p: 3 }}>
          <LoadingSkeleton />
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <SharedLinkAppBar />
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            p: 4,
          }}
        >
          <LinkOffIcon sx={{ fontSize: 64, color: 'text.disabled' }} />
          <Typography variant="h6" color="text.secondary">
            {error}
          </Typography>
        </Box>
      </Box>
    );
  }

  // ---- File share: just show a download + preview card ----
  if (rootItemType === 'file' && rootFile) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <SharedLinkAppBar />
        <Box sx={{ p: 3, maxWidth: 600, mx: 'auto', width: '100%' }}>
          {expiresAt && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Expires {formatDate(expiresAt)}
            </Typography>
          )}
          <List disablePadding>
            <ListItem
              sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}
              secondaryAction={
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  {isPreviewable(rootFile.mime_type) && (
                    <Tooltip title="Preview">
                      <IconButton
                        edge="end"
                        onClick={() => setPreviewTarget({ id: rootFile.id, name: rootFile.name })}
                      >
                        <VisibilityIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title="Download">
                    <span>
                      <IconButton
                        edge="end"
                        onClick={() => handleDownload(rootFile)}
                        disabled={downloading === rootFile.id}
                      >
                        {downloading === rootFile.id ? (
                          <CircularProgress size={20} />
                        ) : (
                          <DownloadIcon />
                        )}
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
              }
            >
              <ListItemIcon>
                <InsertDriveFileIcon />
              </ListItemIcon>
              <ListItemText
                primary={rootFile.name}
                secondary={`${formatFileSize(rootFile.size_bytes)} · ${formatDate(rootFile.created_at)}`}
              />
            </ListItem>
          </List>
        </Box>

        <FilePreviewDialog
          open={previewTarget !== null}
          fileId={previewTarget?.id ?? ''}
          fileName={previewTarget?.name ?? ''}
          onClose={() => setPreviewTarget(null)}
          onDownload={previewDownload}
          previewFetcher={previewFetcher}
        />
      </Box>
    );
  }

  // ---- Folder share ----
  const isEmpty = currentFolders.length === 0 && currentFiles.length === 0;

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <SharedLinkAppBar />
      <Box sx={{ p: 2, maxWidth: 900, mx: 'auto', width: '100%' }}>
        {/* Breadcrumb */}
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
          {breadcrumb.map((crumb, i) => (
            <React.Fragment key={crumb.id}>
              {i > 0 && (
                <Typography variant="body2" color="text.disabled">
                  /
                </Typography>
              )}
              <Typography
                variant="body2"
                onClick={() => handleBreadcrumbClick(i)}
                sx={{
                  cursor: i < breadcrumb.length - 1 ? 'pointer' : 'default',
                  fontWeight: i === breadcrumb.length - 1 ? 600 : 400,
                  '&:hover': i < breadcrumb.length - 1 ? { textDecoration: 'underline' } : {},
                }}
              >
                {crumb.name}
              </Typography>
            </React.Fragment>
          ))}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          {expiresAt ? (
            <Typography variant="caption" color="text.secondary">
              Expires {formatDate(expiresAt)}
            </Typography>
          ) : <span />}
          <Tooltip title="Download folder as ZIP">
            <span>
              <IconButton onClick={handleDownloadFolder} disabled={downloadingFolder} size="small">
                {downloadingFolder ? <CircularProgress size={20} /> : <DownloadIcon fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>
        </Box>

        {/* Back button */}
        {breadcrumb.length > 1 && (
          <IconButton
            size="small"
            onClick={() => handleBreadcrumbClick(breadcrumb.length - 2)}
            sx={{ mb: 1 }}
          >
            <ArrowBackIcon fontSize="small" />
          </IconButton>
        )}

        {isEmpty ? (
          <EmptyState title="This folder is empty" />
        ) : (
          <List disablePadding>
            {currentFolders.map((folder) => (
              <ListItem
                key={folder.id}
                onClick={() => handleFolderClick(folder)}
                sx={{
                  cursor: 'pointer',
                  borderRadius: 1,
                  transition: (theme) => theme.transitions.create('background-color', {
                    duration: theme.transitions.duration.shortest,
                  }),
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  },
                }}
              >
                <ListItemIcon>
                  <FolderIcon color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary={folder.name}
                  secondary={formatDate(folder.created_at)}
                />
              </ListItem>
            ))}

            {currentFiles.map((file) => (
              <ListItem
                key={file.id}
                sx={{
                  borderRadius: 1,
                  transition: (theme) => theme.transitions.create('background-color', {
                    duration: theme.transitions.duration.shortest,
                  }),
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  },
                }}
                secondaryAction={
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {isPreviewable(file.mime_type) && (
                      <Tooltip title="Preview">
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={() => setPreviewTarget({ id: file.id, name: file.name })}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Download">
                      <span>
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={() => handleDownload(file)}
                          disabled={downloading === file.id}
                        >
                          {downloading === file.id ? (
                            <CircularProgress size={18} />
                          ) : (
                            <DownloadIcon fontSize="small" />
                          )}
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>
                }
              >
                <ListItemIcon>
                  <InsertDriveFileIcon />
                </ListItemIcon>
                <ListItemText
                  primary={file.name}
                  secondary={`${formatFileSize(file.size_bytes)} · ${formatDate(file.created_at)}`}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Box>

      <FilePreviewDialog
        open={previewTarget !== null}
        fileId={previewTarget?.id ?? ''}
        fileName={previewTarget?.name ?? ''}
        onClose={() => setPreviewTarget(null)}
        onDownload={previewDownload}
        previewFetcher={previewFetcher}
      />
    </Box>
  );
}

function SharedLinkAppBar() {
  return (
    <AppBar position="static" color="default" elevation={1}>
      <Toolbar variant="dense">
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Shared with you
        </Typography>
      </Toolbar>
    </AppBar>
  );
}
