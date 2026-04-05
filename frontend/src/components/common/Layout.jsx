import React, { useState, useMemo } from 'react';
import { Outlet } from 'react-router-dom';
import { Box, CssBaseline, useMediaQuery, useTheme } from '@mui/material';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import MobileBottomNav from './MobileBottomNav';

const NAVBAR_HEIGHT = 64;
const BOTTOM_NAV_HEIGHT = 56;

const Layout = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [mobileOpen, setMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const sidebarWidth = useMemo(() => {
    if (isMobile) return 0;
    return isCollapsed ? 72 : 280;
  }, [isMobile, isCollapsed]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <CssBaseline />

      {/* Row 1: Navbar */}
      <Box sx={{ height: NAVBAR_HEIGHT, zIndex: 1300, flexShrink: 0 }}>
        <Navbar 
          handleDrawerToggle={() => setMobileOpen(!mobileOpen)} 
          isMobile={isMobile} 
          sidebarWidth={sidebarWidth} 
        />
      </Box>

      {/* Row 2: Body Container */}
      <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
        
        {/* Sidebar Column */}
        {!isMobile && (
          <Box sx={{ 
            width: sidebarWidth, 
            flexShrink: 0, 
            borderRight: `1px solid ${theme.palette.divider}`,
            transition: theme.transitions.create('width', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
            bgcolor: 'background.paper'
          }}>
            <Sidebar isMobile={false} isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
          </Box>
        )}

        {/* ✅ Main Content Column with responsive padding */}
        <Box 
          component="main" 
          sx={{ 
            flexGrow: 1, 
            overflowY: 'auto', 
            bgcolor: '#f8fafc',
            // 🟢 PADDING ADDED HERE:
            // p: 3 is standard (24px). Adjust to 2 for tighter layout.
            p: { xs: 2, sm: 3, md: 4 }, 
            // Ensures space at the bottom for the mobile nav bar
            pb: isMobile ? `${BOTTOM_NAV_HEIGHT + 16}px` : 4,
            width: '100%',
            minWidth: 0,
          }}
        >
          <Outlet />
        </Box>
      </Box>

      {/* Mobile Elements */}
      {isMobile && (
        <>
          <Sidebar isMobile={true} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
          <MobileBottomNav />
        </>
      )}
    </Box>
  );
};

export default Layout;