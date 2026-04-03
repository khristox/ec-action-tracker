import React, { useState, useEffect } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { theme, darkTheme } from '../../theme';

const AppTheme = ({ children, disableCustomTheme = false }) => {
  const [mode, setMode] = useState(() => {
    const savedMode = localStorage.getItem('theme-mode');
    return savedMode || 'light';
  });

  useEffect(() => {
    localStorage.setItem('theme-mode', mode);
  }, [mode]);

  const handleThemeChange = () => {
    setMode(prev => prev === 'light' ? 'dark' : 'light');
  };

  const currentTheme = mode === 'light' ? theme : darkTheme;

  if (disableCustomTheme) {
    return <>{children}</>;
  }

  // Pass theme control through React context instead of props
  const childrenWithTheme = React.Children.map(children, child => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child, { 
        onThemeChange: handleThemeChange,
        mode: mode
      });
    }
    return child;
  });

  return (
    <ThemeProvider theme={currentTheme}>
      {childrenWithTheme}
    </ThemeProvider>
  );
};

export default AppTheme;