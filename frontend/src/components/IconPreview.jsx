// src/components/IconPreview.jsx
import React from 'react';
import { Box, Paper, Typography, Grid, ToggleButton, ToggleButtonGroup } from '@mui/material';
import MenuIcon from './MenuIcon';

const IconPreview = ({ onSelect }) => {
  const [library, setLibrary] = useState('mui');
  const [color, setColor] = useState('#1976d2');
  
  const iconSets = {
    mui: ['Dashboard', 'Assignment', 'Event', 'People', 'Settings', 'Warning', 'CheckCircle'],
    fontawesome: ['fa-home', 'fa-tasks', 'fa-calendar', 'fa-users', 'fa-cog', 'fa-bell', 'fa-chart-line'],
    material_symbols: ['dashboard', 'assignment', 'event', 'group', 'settings', 'warning', 'check_circle']
  };
  
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>Select Icon</Typography>
      
      <ToggleButtonGroup
        value={library}
        exclusive
        onChange={(e, val) => val && setLibrary(val)}
        sx={{ mb: 2 }}
      >
        <ToggleButton value="mui">MUI</ToggleButton>
        <ToggleButton value="fontawesome">Font Awesome</ToggleButton>
        <ToggleButton value="material_symbols">Material Symbols</ToggleButton>
      </ToggleButtonGroup>
      
      <Grid container spacing={1}>
        {iconSets[library].map(icon => (
          <Grid item key={icon}>
            <Box
              onClick={() => onSelect({ icon, type: library })}
              sx={{
                p: 1,
                cursor: 'pointer',
                borderRadius: 1,
                '&:hover': { bgcolor: 'action.hover' }
              }}
            >
              <MenuIcon icon={icon} type={library} color={color} />
            </Box>
          </Grid>
        ))}
      </Grid>
    </Paper>
  );
};