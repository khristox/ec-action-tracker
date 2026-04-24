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
            bgcolor: 'background.paper'  // ✅ theme-aware
          }}>
            <Sidebar isMobile={false} isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
          </Box>
        )}

        {/* Main Content Column */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            overflowY: 'auto',
            bgcolor: 'background.default',  // ✅ was '#f8fafc' — THIS was the bug
            ...(isMobile && { pb: `${BOTTOM_NAV_HEIGHT}px` }),
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