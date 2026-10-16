import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { I18nManager, Platform } from 'react-native';

import { settingsStorage } from '@/storage';
import { translate, type Language, type TranslationKey } from '@/i18n';
import type { AppTheme } from '@/theme';

interface SettingsContextValue {
  language: Language;
  theme: AppTheme;
  direction: 'ltr' | 'rtl';
  t: (key: TranslationKey) => string;
  setLanguage: (language: Language) => Promise<void>;
  setTheme: (theme: AppTheme) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: React.PropsWithChildren) {
  const [language, setLanguageState] = useState<Language>('ar');
  const [theme, setThemeState] = useState<AppTheme>('light');

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.lang = language;
      document.documentElement.classList.toggle('dark', theme === 'dark');
      document.body.classList.toggle('dark', theme === 'dark');
    } else if (Platform.OS !== 'web') {
      I18nManager.allowRTL(true);
    }
  }, [language, theme]);

  useEffect(() => {
    let active = true;
    void settingsStorage.get().then((raw) => {
      if (active && raw) {
        try {
          const settings = JSON.parse(raw) as { language?: Language; theme?: AppTheme };
          if (settings.language === 'ar' || settings.language === 'en') setLanguageState(settings.language);
          if (settings.theme === 'dark' || settings.theme === 'light') setThemeState(settings.theme);
        } catch {
          if (Platform.OS === 'web') localStorage.removeItem('pharmacydb-mobile-settings');
        }
      }
    }).catch((error: unknown) => console.error('Failed to load mobile settings:', error));
    return () => { active = false; };
  }, []);

  const save = useCallback(async (next: { language: Language; theme: AppTheme }) => {
    await settingsStorage.set(JSON.stringify(next));
  }, []);

  const setLanguage = useCallback(async (next: Language) => {
    setLanguageState(next);
    await save({ language: next, theme });
  }, [save, theme]);

  const setTheme = useCallback(async (next: AppTheme) => {
    setThemeState(next);
    await save({ language, theme: next });
  }, [language, save]);

  const value = useMemo<SettingsContextValue>(() => ({
    language,
    theme,
    direction: language === 'ar' ? 'rtl' : 'ltr',
    t: (key) => translate(language, key),
    setLanguage,
    setTheme,
  }), [language, theme, setLanguage, setTheme]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export const useSettings = () => {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('useSettings must be used inside SettingsProvider');
  return value;
};
