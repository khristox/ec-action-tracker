import React from 'react';
import { Card, CardContent, Typography, Box, Avatar } from '@mui/material';

const StatCard = ({ title, value, icon, color, subtitle }) => (
  <Card sx={{ 
    height: '100%', 
    transition: 'transform 0.2s', 
    '&:hover': { transform: 'translateY(-4px)' }, 
    borderRadius: 3 
  }}>
    <CardContent>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ flex: 1 }}>
          <Typography 
            color="textSecondary" 
            gutterBottom 
            variant="subtitle2"
            sx={{ fontSize: { xs: '0.7rem', md: '0.875rem' }, fontWeight: 600, letterSpacing: 0.5 }}
          >
            {title}
          </Typography>
          <Typography 
            variant="h4" 
            fontWeight="bold"
            sx={{ fontSize: { xs: '1.5rem', md: '2rem' }, mb: 0.5 }}
          >
            {value}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        <Avatar 
          sx={{ 
            bgcolor: color, 
            width: { xs: 48, md: 60 }, 
            height: { xs: 48, md: 60 },
            boxShadow: '0 4px 12px 0 rgba(0,0,0,0.1)'
          }}
        >
          {icon}
        </Avatar>
      </Box>
    </CardContent>
  </Card>
);

export default StatCard;