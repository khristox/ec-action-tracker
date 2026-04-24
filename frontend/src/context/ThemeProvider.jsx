import React, { createContext, useState, useContext, useMemo } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

const ColorModeContext = createContext({ toggleColorMode: () => {}, toggleTheme: () => {}, mode: 'light' });

export const useColorMode = () => {
  const context = useContext(ColorModeContext);
  if (!context) throw new Error('useColorMode must be used within ThemeContextProvider');
  return context;
};

export const ThemeContextProvider = ({ children }) => {
  const [mode, setMode] = useState(() => {
    const savedMode = localStorage.getItem('theme');
    if (savedMode) return savedMode;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const colorMode = useMemo(() => ({
    mode,
    toggleColorMode: () => {
      setMode((prev) => {
        const next = prev === 'light' ? 'dark' : 'light';
        localStorage.setItem('theme', next);
        return next;
      });
    },
    toggleTheme: () => {
      setMode((prev) => {
        const next = prev === 'light' ? 'dark' : 'light';
        localStorage.setItem('theme', next);
        return next;
      });
    },
  }), [mode]);

  const theme = useMemo(() => createTheme({
    palette: {
      mode,
      primary: { main: '#1976d2', light: '#42a5f5', dark: '#1565c0' },
      secondary: { main: '#9c27b0' },
      background: {
        default: mode === 'light' ? '#f5f5f5' : '#121212',
        paper:   mode === 'light' ? '#ffffff' : '#1e1e1e',
      },
    },
    shape: { borderRadius: 8 },
  }), [mode]);

  return (
    <ColorModeContext.Provider value={colorMode}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ColorModeContext.Provider>
  );
};