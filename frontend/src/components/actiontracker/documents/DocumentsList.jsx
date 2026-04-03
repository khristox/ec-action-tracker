import React from 'react';
import { Container, Typography, Paper, Box } from '@mui/material';

const DocumentsList = () => {
  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h4" gutterBottom>Documents</Typography>
        <Typography variant="body2" color="text.secondary">Documents management coming soon.</Typography>
      </Paper>
    </Container>
  );
};

export default DocumentsList;