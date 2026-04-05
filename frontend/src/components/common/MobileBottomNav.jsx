import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BottomNavigation, BottomNavigationAction, Paper } from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Event as EventIcon,
  Assignment as AssignmentIcon,
  People as PeopleIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';

const MobileBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const getValue = () => {
    if (location.pathname.startsWith('/dashboard')) return 0;
    if (location.pathname.startsWith('/meetings')) return 1;
    if (location.pathname.startsWith('/actions')) return 2;
    if (location.pathname.startsWith('/participants')) return 3;
    if (location.pathname.startsWith('/settings')) return 4;
    return 0;
  };

  return (
    <Paper
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: (theme) => theme.zIndex.drawer + 1,
        borderTop: '1px solid',
        borderColor: 'divider',
      }}
      elevation={3}
    >
      <BottomNavigation
        showLabels
        value={getValue()}
        onChange={(_, newValue) => {
          switch (newValue) {
            case 0:
              navigate('/dashboard');
              break;
            case 1:
              navigate('/meetings');
              break;
            case 2:
              navigate('/actions');
              break;
            case 3:
              navigate('/participants');
              break;
            case 4:
              navigate('/settings');
              break;
            default:
              break;
          }
        }}
      >
        <BottomNavigationAction label="Home" icon={<DashboardIcon />} />
        <BottomNavigationAction label="Meetings" icon={<EventIcon />} />
        <BottomNavigationAction label="Actions" icon={<AssignmentIcon />} />
        <BottomNavigationAction label="People" icon={<PeopleIcon />} />
        <BottomNavigationAction label="Settings" icon={<SettingsIcon />} />
      </BottomNavigation>
    </Paper>
  );
};

export default MobileBottomNav;