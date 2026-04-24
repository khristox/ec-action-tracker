import { useColorMode } from '../context/ThemeProvider';

// Drop-in replacement — same API as before (mode, toggleTheme, toggleColorMode)
export const useTheme = () => useColorMode();