// src/components/meetings/MeetingForm/components/LoadingOverlay.jsx
import React from 'react';
import { Backdrop, CircularProgress, Typography, LinearProgress } from '@mui/material';

export const LoadingOverlay = ({ open, message = 'Processing...' }) => {
  if (!open) return null;
  
  return (
    <Backdrop 
      open={open} 
      sx={{ 
        zIndex: 9999, 
        color: '#fff', 
        flexDirection: 'column', 
        gap: 2, 
        backgroundColor: 'rgba(0,0,0,0.8)' 
      }}
    >
      <CircularProgress color="primary" size={60} />
      <Typography variant="h6" sx={{ color: 'white', textAlign: 'center' }}>
        {message}
      </Typography>
      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>
        Please do not close this window
      </Typography>
      <LinearProgress 
        sx={{ 
          width: '200px', 
          mt: 2, 
          backgroundColor: 'rgba(255,255,255,0.2)', 
          '& .MuiLinearProgress-bar': { backgroundColor: 'white' } 
        }} 
      />
    </Backdrop>
  );
};