import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  CircularProgress,
} from '@mui/material';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import FolderZipOutlinedIcon from '@mui/icons-material/FolderZipOutlined';
import { getPublicShare } from '../api/shareLinkService';
import { IPublicShareResponse } from '../types';
import { formatFileSize } from '../utils/formatters';

function ShareAccessPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [share, setShare] = useState<IPublicShareResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    setLoading(true);

    getPublicShare(token)
      .then((data) => {
        if (!cancelled) {
          setShare(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        const status = err?.response?.status;
        if (status === 404) {
          setError("This link doesn't exist or has been removed.");
        } else if (status === 410) {
          setError('This link has expired.');
        } else {
          setError('Something went wrong. Please try again.');
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleDownload = () => {
    if (!share || !token) return;

    if (share.resourceType === 'file') {
      window.open(share.downloadUrl, '_blank');
    } else {
      window.location.href = `/api/public/share/${token}/download`;
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'grey.100',
        p: 2,
      }}
    >
      <Card sx={{ maxWidth: 440, width: '100%' }}>
        <CardContent
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            py: 4,
            px: 3,
          }}
        >
          {loading && <CircularProgress />}

          {!loading && error && (
            <>
              <Typography variant="h6" gutterBottom>
                {error}
              </Typography>
              <Button href="/login" variant="outlined" sx={{ mt: 2 }}>
                Go to login
              </Button>
            </>
          )}

          {!loading && share && (
            <>
              {share.resourceType === 'file' ? (
                <InsertDriveFileOutlinedIcon
                  sx={{ fontSize: 48, color: 'primary.main', mb: 1 }}
                />
              ) : (
                <FolderZipOutlinedIcon
                  sx={{ fontSize: 48, color: 'primary.main', mb: 1 }}
                />
              )}

              <Typography variant="h6" sx={{ wordBreak: 'break-word', textAlign: 'center' }}>
                {share.name}
              </Typography>

              {share.resourceType === 'file' && share.sizeBytes != null && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {formatFileSize(share.sizeBytes)}
                </Typography>
              )}

              <Button
                variant="contained"
                sx={{ mt: 3 }}
                onClick={handleDownload}
              >
                {share.resourceType === 'file' ? 'Download' : 'Download as ZIP'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

export default ShareAccessPage;
