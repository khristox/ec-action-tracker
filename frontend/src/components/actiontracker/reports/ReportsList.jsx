import React from 'react';
import { Container, Typography, Paper, Box } from '@mui/material';

const ReportsList = () => {
  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h4" gutterBottom>Reports</Typography>
        <Typography variant="body2" color="text.secondary">Reports and analytics coming soon.</Typography>
      </Paper>
    </Container>
  );
};

export default ReportsList;