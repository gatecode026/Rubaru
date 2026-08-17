import React, { createContext, useContext, useState } from 'react';
import { lightColors, darkColors } from './colors';

const ThemeContext = createContext({
  isDarkMode: false,
  colors: lightColors,
  toggleTheme: () => {},
  setDarkMode: (value) => {},
});

export const ThemeProvider = ({ children }) => {
  // Default mode is OFF (false -> Light Theme)
  const [isDarkMode, setIsDarkMode] = useState(false);

  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  const setDarkMode = (value) => {
    setIsDarkMode(!!value);
  };

  const currentColors = isDarkMode ? darkColors : lightColors;

  return (
    <ThemeContext.Provider
      value={{
        isDarkMode,
        colors: currentColors,
        toggleTheme,
        setDarkMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      isDarkMode: false,
      colors: lightColors,
      toggleTheme: () => {},
      setDarkMode: () => {},
    };
  }
  return context;
};

export default ThemeContext;
