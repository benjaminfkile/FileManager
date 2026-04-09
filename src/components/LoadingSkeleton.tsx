import React from 'react';
import { Box, Skeleton, ListItem, List } from '@mui/material';

export interface LoadingSkeletonProps {
  count?: number;
}

export default function LoadingSkeleton({ count = 5 }: LoadingSkeletonProps) {
  return (
    <List disablePadding>
      {Array.from({ length: count }, (_, i) => (
        <ListItem key={i} sx={{ gap: 2, py: 1 }}>
          <Skeleton variant="rectangular" width={40} height={40} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="60%" />
            <Skeleton variant="text" width="40%" />
          </Box>
        </ListItem>
      ))}
    </List>
  );
}
