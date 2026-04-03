import React from 'react';
import { Box, Button, Container, Typography, Paper } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { ErrorOutline, Home } from '@mui/icons-material';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
      }}
    >
      <Container maxWidth="md">
        <Paper
          elevation={0}
          sx={{
            p: 6,
            textAlign: 'center',
            borderRadius: 4,
            background: 'linear-gradient(135deg, rgba(25,118,210,0.05) 0%, rgba(25,118,210,0.02) 100%)',
          }}
        >
          <ErrorOutline sx={{ fontSize: 80, color: 'error.main', mb: 2 }} />
          <Typography variant="h2" component="h1" gutterBottom fontWeight={700}>
            404
          </Typography>
          <Typography variant="h5" gutterBottom color="text.primary">
            Page Not Found
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 500, mx: 'auto' }}>
            The page you are looking for doesn't exist or has been moved.
          </Typography>
          <Button
            variant="contained"
            size="large"
            startIcon={<Home />}
            onClick={() => navigate('/dashboard')}
            sx={{ px: 4, py: 1.5 }}
          >
            Go to Dashboard
          </Button>
        </Paper>
      </Container>
    </Box>
  );
};

export default NotFound;