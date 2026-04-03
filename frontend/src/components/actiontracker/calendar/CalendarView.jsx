import React from 'react';
import { Container, Typography, Paper, Box } from '@mui/material';
import { CalendarMonth as CalendarIcon } from '@mui/icons-material';

const CalendarView = () => {
  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
        <CalendarIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          Calendar
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Meeting calendar and schedule view coming soon.
        </Typography>
      </Paper>
    </Container>
  );
};

export default CalendarView;