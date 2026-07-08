import React from 'react';
import { Box, Typography, Button, Container, Paper } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Lock as LockIcon } from '@mui/icons-material';

const Forbidden = () => {
  const navigate = useNavigate();

  return (
    <Container maxWidth="sm" sx={{ height: '100vh', display: 'flex', alignItems: 'center' }}>
      <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
        <LockIcon sx={{ fontSize: 80, color: 'error.main', mb: 2 }} />
        <Typography variant="h4" fontWeight="bold" gutterBottom>Access Denied</Typography>
        <Typography variant="body1" color="text.secondary" paragraph>You don't have permission to access this page.</Typography>
        <Button variant="contained" onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
      </Paper>
    </Container>
  );
};

export default Forbidden;