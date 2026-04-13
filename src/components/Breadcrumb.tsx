import React from 'react';
import { Box, ButtonBase, Typography, useMediaQuery, useTheme } from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';

export interface BreadcrumbProps {
  crumbs: Array<{ id: string | null; name: string }>;
  onNavigate: (folderId: string | null) => void;
}

export default function Breadcrumb({ crumbs, onNavigate }: BreadcrumbProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // On mobile collapse to last 2 segments
  const visible = isMobile && crumbs.length > 2 ? crumbs.slice(-2) : crumbs;
  const truncated = visible.length < crumbs.length;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1.5,
        py: 0.75,
        mb: 2,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
        overflowX: 'auto',
        whiteSpace: 'nowrap',
        '&::-webkit-scrollbar': { display: 'none' },
        scrollbarWidth: 'none',
      }}
    >
      <FolderIcon sx={{ fontSize: 18, color: 'primary.main', flexShrink: 0 }} />

      {truncated && (
        <>
          <Typography variant="body2" sx={{ color: 'text.disabled', px: 0.5 }}>
            …
          </Typography>
          <NavigateNextIcon sx={{ fontSize: 16, color: 'text.disabled', flexShrink: 0 }} />
        </>
      )}

      {visible.map((crumb, index) => {
        const isLast = index === visible.length - 1;
        return (
          <React.Fragment key={crumb.id ?? 'root'}>
            {index > 0 && (
              <NavigateNextIcon sx={{ fontSize: 16, color: 'text.disabled', flexShrink: 0 }} />
            )}
            {isLast ? (
              <Typography
                variant="body2"
                sx={{ fontWeight: 600, color: 'text.primary', px: 0.5 }}
              >
                {crumb.name}
              </Typography>
            ) : (
              <ButtonBase
                onClick={() => onNavigate(crumb.id)}
                sx={{
                  px: 0.5,
                  py: 0.25,
                  borderRadius: 0.5,
                  typography: 'body2',
                  color: 'text.secondary',
                  '&:hover': {
                    bgcolor: 'action.hover',
                    color: 'text.primary',
                  },
                }}
              >
                {crumb.name}
              </ButtonBase>
            )}
          </React.Fragment>
        );
      })}
    </Box>
  );
}
