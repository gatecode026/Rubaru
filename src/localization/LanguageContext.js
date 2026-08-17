import React, { createContext, useContext, useState } from 'react';
import { translations } from './translations';

const LanguageContext = createContext({
  language: 'en',
  isHindi: false,
  setLanguage: () => {},
  t: (key, fallback) => fallback || key,
});

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState('en'); // 'en' or 'hi'

  const t = (key, fallback) => {
    const currentDict = translations[language] || translations.en;
    if (currentDict && currentDict[key] !== undefined) {
      return currentDict[key];
    }
    return fallback || translations.en[key] || key;
  };

  const isHindi = language === 'hi';

  return (
    <LanguageContext.Provider
      value={{
        language,
        isHindi,
        setLanguage,
        t,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    return {
      language: 'en',
      isHindi: false,
      setLanguage: () => {},
      t: (key, fallback) => fallback || key,
    };
  }
  return context;
};

export default LanguageContext;
