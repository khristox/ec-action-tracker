// src/components/ui/CustomTree.jsx
import React from 'react';
import { Box } from '@mui/material';

// Custom TreeNode component
export const TreeNode = ({ children, label }) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Box sx={{ mb: 1 }}>{label}</Box>
      {children && (
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, position: 'relative' }}>
          {/* Connecting lines */}
          <Box sx={{ 
            position: 'absolute', 
            top: -10, 
            left: 0, 
            right: 0, 
            height: 20,
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 2,
              height: 10,
              bgcolor: '#1890ff'
            }
          }} />
          <Box sx={{ display: 'flex', gap: 4, position: 'relative', pt: 3 }}>
            {React.Children.map(children, (child, index) => (
              <Box key={index} sx={{ position: 'relative' }}>
                {/* Vertical line to parent */}
                <Box sx={{ 
                  position: 'absolute', 
                  top: -20, 
                  left: '50%', 
                  transform: 'translateX(-50%)',
                  width: 2, 
                  height: 20, 
                  bgcolor: '#1890ff' 
                }} />
                {/* Horizontal connector */}
                {React.Children.count(children) > 1 && (
                  <Box sx={{ 
                    position: 'absolute', 
                    top: -20, 
                    left: 0, 
                    right: 0, 
                    height: 2, 
                    bgcolor: '#1890ff',
                    display: 'flex'
                  }} />
                )}
                {child}
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
};

// Custom Tree component
export const Tree = ({ children, lineColor = '#1890ff', lineWidth = '2px', lineBorderRadius = '10px' }) => {
  return (
    <Box sx={{ 
      display: 'flex', 
      justifyContent: 'center',
      '& .org-tree-node': {
        position: 'relative'
      }
    }}>
      {children}
    </Box>
  );
};