import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Box, CssBaseline, Toolbar, useMediaQuery, useTheme } from '@mui/material';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import MobileBottomNav from './MobileBottomNav';

const drawerWidth = 280;

const Layout = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md')); 
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f9f9f9' }}>
      <CssBaseline />
      
      <Navbar 
        open={!isMobile} 
        handleDrawerToggle={handleDrawerToggle} 
        drawerWidth={drawerWidth}
        isMobile={isMobile}
      />
      
      <Sidebar 
        open={!isMobile ? true : mobileOpen}
        drawerWidth={drawerWidth}
        isMobile={isMobile}
        onClose={handleDrawerToggle}
      />
      
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          // Remove the manual ml and width calculations
          p: { xs: 2, sm: 3, md: 4 },
          width: '100%', 
          display: 'flex',
          flexDirection: 'column',
          // Ensure content stays within viewport but scrolls
          overflowX: 'hidden',
          pb: { xs: 10, md: 4 },
        }}
      >
        <Toolbar /> {/* Spaces content below fixed Navbar */}
        
        {/* Wrap Outlet in a Container to keep dashboard cards centered and tidy */}
        <Box sx={{ maxWidth: '1400px', width: '100%', mx: 'auto' }}>
          <Outlet />
        </Box>
      </Box>
      
      <MobileBottomNav />
    </Box>
  );
};

export default Layout;