import React from 'react';
import { Box, Container, CssBaseline } from '@mui/material';
import SignUpCard from '../components/auth/SignUpCard';

const SignUp = () => {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        py: 4,
      }}
    >
      <Container maxWidth="sm">
        <SignUpCard />
      </Container>
    </Box>
  );
};

export default SignUp;