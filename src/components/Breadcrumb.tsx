import React from 'react';
import { Breadcrumbs, Link, Typography, useMediaQuery, useTheme } from '@mui/material';

export interface BreadcrumbProps {
  crumbs: Array<{ id: string | null; name: string }>;
  onNavigate: (folderId: string | null) => void;
}

export default function Breadcrumb({ crumbs, onNavigate }: BreadcrumbProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Breadcrumbs
      {...(isMobile ? { maxItems: 2, itemsAfterCollapse: 1 } : {})}
    >
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;

        if (isLast) {
          return (
            <Typography key={crumb.id ?? 'root'} color="text.primary">
              {crumb.name}
            </Typography>
          );
        }

        return (
          <Link
            key={crumb.id ?? 'root'}
            component="button"
            underline="hover"
            color="inherit"
            onClick={() => onNavigate(crumb.id)}
          >
            {crumb.name}
          </Link>
        );
      })}
    </Breadcrumbs>
  );
}
