import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Divider, Menu, MenuItem, Typography } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

interface UserProfileMenuProps {
  anchorEl: HTMLElement | null;
  onClose: () => void;
}

export default function UserProfileMenu({ anchorEl, onClose }: UserProfileMenuProps) {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    onClose();
    navigate('/register');
  };

  return (
    <Menu
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
    >
      <Box sx={{ px: 2, py: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
          {currentUser?.first_name} {currentUser?.last_name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {currentUser?.username}
        </Typography>
      </Box>
      <Divider />
      <MenuItem onClick={handleLogout}>Logout</MenuItem>
    </Menu>
  );
}
