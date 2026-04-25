import React from 'react';
import { Box, Container, CssBaseline, alpha, useTheme } from '@mui/material';
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
        // On mobile (xs), remove padding to allow the card to feel more integrated
        py: { xs: 0, sm: 4 },
        px: { xs: 0, sm: 2 },
      }}
    >
      <CssBaseline />
      
      <Container 
        maxWidth="sm" 
        disableGutters // Removes default padding on mobile to "fill the screen"
        sx={{ 
          display: 'flex', 
          justifyContent: 'center',
          // Ensure the container itself fills height on tiny screens if needed
          minHeight: { xs: '100vh', sm: 'auto' } 
        }}
      >
        <Box sx={{ width: '100%', maxWidth: { xs: '100%', sm: 450 } }}>
          <SignUpCard />
        </Box>
      </Container>
    </Box>
  );
};

export default SignUp;