// components/layout/MainLayout.jsx
import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Box, useMediaQuery, useTheme } from '@mui/material';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import MobileBottomNav from './MobileBottomNav';
import { fetchUserProfile } from '../../store/slices/authSlice';

const MainLayout = ({ children }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const dispatch = useDispatch();
  const navigate = useNavigate();
  
  const { isAuthenticated, user, token } = useSelector((state) => state.auth);
  
  const [sidebarOpen, setSidebarOpen] = React.useState(!isMobile);

  // Listen to auth changes and reload components
  useEffect(() => {
    if (isAuthenticated) {
      console.log('User authenticated, reloading components...');
      
      // Optionally fetch fresh user data
      dispatch(fetchUserProfile());
      
      // Force sidebar state reset
      setSidebarOpen(!isMobile);
      
      // You can add any other reload logic here
      // For example, refetch menu items, notifications, etc.
      
    } else {
      // Handle logout
      console.log('User not authenticated');
      navigate('/signin', { replace: true });
    }
  }, [isAuthenticated, dispatch, isMobile, navigate]);

  // Additional effect to handle user data changes
  useEffect(() => {
    if (user) {
      console.log('User data updated:', user);
      // Components will re-render automatically with new user data
    }
  }, [user]);

  if (!isAuthenticated) {
    return null; // Or loading spinner
  }

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Desktop Sidebar */}
      {!isMobile && (
        <Sidebar 
          open={sidebarOpen} 
          onToggle={toggleSidebar}
          key={`sidebar-${isAuthenticated}-${user?.id}`} // Force reload on auth change
        />
      )}
      
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <Navbar 
          onMenuClick={toggleSidebar}
          key={`navbar-${isAuthenticated}-${user?.id}`} // Force reload on auth change
        />
        
        <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, md: 3 } }}>
          {children}
        </Box>
        
        {/* Mobile Bottom Navigation */}
        {isMobile && (
          <MobileBottomNav 
            key={`bottomnav-${isAuthenticated}`} // Force reload on auth change
          />
        )}
      </Box>
    </Box>
  );
};

export default MainLayout;