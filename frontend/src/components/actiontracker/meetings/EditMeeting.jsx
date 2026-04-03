import React from 'react';
import { Container, Typography, Paper, Box } from '@mui/material';

const EditMeeting = () => {
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h4" gutterBottom>Edit Meeting</Typography>
        <Typography variant="body2" color="text.secondary">Edit meeting functionality coming soon.</Typography>
      </Paper>
    </Container>
  );
};

export default EditMeeting;