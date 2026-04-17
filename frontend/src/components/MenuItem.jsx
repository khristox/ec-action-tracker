// src/components/MenuItem.jsx
import React from 'react';
import { ListItem, ListItemIcon, ListItemText, Chip, Tooltip, Badge } from '@mui/material';
import { Link } from 'react-router-dom';
import MenuIcon from './MenuIcon';

const MenuItemComponent = ({ menu, hasBadge = false }) => {
  
  const getBadgeColor = () => {
    if (!menu.badge) return 'default';
    if (menu.badge === 'new') return 'info';
    if (menu.badge === 'hot') return 'error';
    if (menu.badge === 'beta') return 'secondary';
    if (!isNaN(parseInt(menu.badge)) && parseInt(menu.badge) > 0) return 'error';
    return 'default';
  };
  
  return (
    <ListItem
      button
      component={Link}
      to={menu.path}
      target={menu.target}
      sx={{ 
        borderRadius: 2,
        mb: 0.5,
        '&:hover': { bgcolor: 'action.hover' }
      }}
    >
      <ListItemIcon>
        <MenuIcon 
          icon={menu.icon}
          type={menu.icon_type}
          library={menu.icon_library}
          color={menu.icon_color}
          size={menu.icon_size}
          animation={menu.icon_animation}
        />
      </ListItemIcon>
      
      <ListItemText 
        primary={menu.title}
        primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
      />
      
      {menu.badge && (
        <Chip 
          label={menu.badge} 
          size="small" 
          color={getBadgeColor()}
          sx={{ height: 20, fontSize: '0.7rem' }}
        />
      )}
    </ListItem>
  );
};

export default MenuItemComponent;