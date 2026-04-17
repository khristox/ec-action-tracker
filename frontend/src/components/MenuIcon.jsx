// src/components/MenuIcon.jsx
import React from 'react';
import * as MuiIcons from '@mui/icons-material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Icon } from '@mui/material';

const MenuIcon = ({ icon, type = 'mui', library = 'fas', color = 'inherit', size = 'medium', animation = null }) => {
  
  // MUI Icons
  if (type === 'mui') {
    const IconComponent = MuiIcons[`${icon}Icon`] || MuiIcons.CircleIcon;
    return <IconComponent sx={{ color, fontSize: size === 'small' ? 20 : size === 'large' ? 32 : 24 }} />;
  }
  
  // Font Awesome Icons
  if (type === 'fontawesome') {
    const iconName = icon.replace('fa-', '');
    return (
      <FontAwesomeIcon 
        icon={[library, iconName]} 
        color={color}
        size={size === 'small' ? 'sm' : size === 'large' ? 'lg' : '1x'}
        spin={animation === 'spin'}
        pulse={animation === 'pulse'}
        bounce={animation === 'bounce'}
      />
    );
  }
  
  // Material Symbols (Google Fonts)
  if (type === 'material_symbols') {
    return (
      <Icon 
        className="material-symbols-outlined"
        sx={{ 
          color, 
          fontSize: size === 'small' ? 20 : size === 'large' ? 32 : 24,
          fontVariationSettings: `'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24`
        }}
      >
        {icon}
      </Icon>
    );
  }
  
  // Custom image icon
  if (type === 'custom') {
    return <img src={icon} alt="menu icon" width={24} height={24} />;
  }
  
  return null;
};

export default MenuIcon;