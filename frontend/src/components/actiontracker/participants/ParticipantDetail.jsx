import React from 'react';
import { Container, Typography, Paper, Box } from '@mui/material';

const ParticipantDetail = () => {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h4" gutterBottom>Participant Details</Typography>
        <Typography variant="body2" color="text.secondary">Participant details coming soon.</Typography>
      </Paper>
    </Container>
  );
};

export default ParticipantDetail;