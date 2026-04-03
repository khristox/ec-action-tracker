import React from 'react';
import { Container, Typography, Paper, Box } from '@mui/material';

const CreateParticipant = () => {
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h4" gutterBottom>Create Participant</Typography>
        <Typography variant="body2" color="text.secondary">Create participant form coming soon.</Typography>
      </Paper>
    </Container>
  );
};

export default CreateParticipant;