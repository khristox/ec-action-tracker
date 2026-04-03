import React from 'react';
import { Container, Typography, Paper, Box } from '@mui/material';

const ActionDetail = () => {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h4" gutterBottom>Action Details</Typography>
        <Typography variant="body2" color="text.secondary">Action details coming soon.</Typography>
      </Paper>
    </Container>
  );
};

export default ActionDetail;