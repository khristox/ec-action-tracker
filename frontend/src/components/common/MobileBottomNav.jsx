import React from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { Paper, Tabs, Tab, Badge, Box } from '@mui/material';
import { selectMenus } from '../../store/slices/menuSlice';

// Icon imports (same as above)
import {
  Dashboard as DashboardIcon,
  Business as BusinessIcon,
  People as PeopleIcon,
  Payments as PaymentsIcon,
  Event as CalendarIcon,
  // ... other icons
} from '@mui/icons-material';

const iconMap = {
  'Dashboard': <DashboardIcon />,
  'Business': <BusinessIcon />,
  'People': <PeopleIcon />,
  'Payments': <PaymentsIcon />,
  'Calendar': <CalendarIcon />,
  // ... other mappings
};

const MobileBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const menus = useSelector(selectMenus);

  const getMobileNavItems = (items) => {
    let results = [];
    items.forEach((item) => {
      if (item.can_show_mb_bottom) {
        results.push(item);
      }
      if (item.children && item.children.length > 0) {
        results = [...results, ...getMobileNavItems(item.children)];
      }
    });
    return results.sort((a, b) => a.sort_order - b.sort_order);
  };

  const navItems = getMobileNavItems(menus);

  if (navItems.length === 0) return null;

  const currentIndex = navItems.findIndex(item => 
    item.path && (location.pathname === item.path || location.pathname.startsWith(item.path + '/'))
  );

  const handleChange = (event, newValue) => {
    const targetPath = navItems[newValue].path;
    if (targetPath) navigate(targetPath);
  };

  return (
    <Paper 
      sx={{ 
        position: 'fixed', 
        bottom: 0, 
        left: 0, 
        right: 0,
        display: { xs: 'block', md: 'none' }, 
        zIndex: 1100,
        pb: 'env(safe-area-inset-bottom)'
      }} 
      elevation={3}
    >
      <Tabs
        value={currentIndex === -1 ? 0 : currentIndex}
        onChange={handleChange}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        sx={{
          '& .MuiTabs-scrollButtons': {
            '&.Mui-disabled': {
              opacity: 0.3
            }
          }
        }}
      >
        {navItems.map((item) => (
          <Tab
            key={item.id}
            label={item.title}
            icon={
              <Badge badgeContent={item.badge} color="error">
                {iconMap[item.icon] || <DashboardIcon />}
              </Badge>
            }
            sx={{
              minHeight: 56,
              '& .MuiTab-iconOnly': {
                marginBottom: 0
              }
            }}
          />
        ))}
      </Tabs>
    </Paper>
  );
};

export default MobileBottomNav;