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
  const mode = theme.palette.mode;
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <>
      <CssBaseline enableColorScheme />
      <ColorModeSelect sx={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 1000 }} />

      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'auto',
          py: { xs: 4, md: 0 },
          '&::before': {
            content: '""',
            display: 'block',
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            zIndex: -1,
            backgroundImage: mode === 'dark'
              ? 'radial-gradient(at 50% 50%, hsla(210, 100%, 16%, 0.5), hsl(220, 30%, 5%))'
              : 'radial-gradient(ellipse at 50% 50%, hsl(210, 100%, 97%), hsl(0, 0%, 100%))',
            backgroundRepeat: 'no-repeat',
          },
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          sx={{
            justifyContent: 'center',
            alignItems: 'center',
            gap: { xs: 4, md: 8, lg: 12 },
            p: { xs: 2, sm: 3, md: 4 },
            width: '100%',
            maxWidth: '1400px',
            mx: 'auto',
          }}
        >
          {!isMobile && <Content />}
          <SignInCard />
        </Stack>
      </Box>
    </>
  );
};

export default SignInSide;