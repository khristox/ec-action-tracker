import React from 'react';
import CssBaseline from '@mui/material/CssBaseline';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import { useMediaQuery, useTheme } from '@mui/material';

import ColorModeSelect from '../components/shared-theme/ColorModeSelect';
import SignInCard from '../components/auth/SignInCard';
import Content from '../components/auth/Content';

const SignInSide = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <>
      <CssBaseline enableColorScheme />

      {/* Theme Toggle */}
      <ColorModeSelect 
        sx={{ 
          position: 'fixed', 
          top: '1rem', 
          right: '1rem', 
          zIndex: 1000 
        }} 
      />

      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'auto',
          p: { xs: 2, sm: 3 },
          '&::before': {
            content: '""',
            display: 'block',
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: -1,
            backgroundImage: 
              theme.palette.mode === 'dark'
                ? 'radial-gradient(at 50% 50%, hsla(210, 100%, 16%, 0.6), hsl(220, 30%, 6%))'
                : 'radial-gradient(ellipse at 50% 50%, hsl(210, 100%, 97%), hsl(0, 0%, 100%))',
            backgroundRepeat: 'no-repeat',
            backgroundSize: 'cover',
          },
        }}
      >       
          
          <SignInCard />
        
      </Box>
    </>
  );
};

export default SignInSide;