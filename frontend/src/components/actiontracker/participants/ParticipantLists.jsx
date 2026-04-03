import React from 'react';
import { Container, Typography, Paper, Box } from '@mui/material';

const ParticipantLists = () => {
  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h4" gutterBottom>Participant Lists</Typography>
        <Typography variant="body2" color="text.secondary">Participant lists management coming soon.</Typography>
      </Paper>
    </Container>
  );
};

export default ParticipantLists;