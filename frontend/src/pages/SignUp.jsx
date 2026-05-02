import React from 'react';
import { Box, CssBaseline, alpha, useTheme } from '@mui/material';
import SignUpCard from '../components/auth/SignUpCard';

const SignUp = () => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        // Elegant gradient background for Dark/Light mode
        background: theme.palette.mode === 'dark' 
          ? `radial-gradient(circle at 2% 10%, ${alpha(theme.palette.primary.main, 0.15)} 0%, transparent 40%),
             radial-gradient(circle at 98% 90%, ${alpha(theme.palette.secondary.main, 0.15)} 0%, transparent 40%),
             #0f172a` 
          : `radial-gradient(circle at 2% 10%, ${alpha(theme.palette.primary.main, 0.05)} 0%, transparent 40%),
             #f8fafc`,
        // Responsive padding
        p: { xs: 2, sm: 3, md: 4 },
      }}
    >
      <CssBaseline />
      
      {/* REMOVED the restrictive Container and Box wrappers */}
      <SignUpCard />
    </Box>
  );
};

export default SignUp;