import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark' | 'high-contrast';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const LEGACY_THEME_KEYS = ['safetycore-theme', 'safety-journal-theme'] as const;
const THEME_KEY = 'safe-log-theme';

function migrateLegacyThemeStorage() {
  if (typeof window === 'undefined') return;

  try {
    const hasNewKey = window.localStorage.getItem(THEME_KEY);
    if (hasNewKey) return;

    for (const legacyKey of LEGACY_THEME_KEYS) {
      const legacyValue = window.localStorage.getItem(legacyKey);
      if (!legacyValue) continue;

      window.localStorage.setItem(THEME_KEY, legacyValue);
      break;
    }
  } catch {
    // localStorage 접근 제한 환경에서는 무시
  }
}

migrateLegacyThemeStorage();

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'light',
      setTheme: (theme) => {
        set({ theme });
        if (typeof document !== 'undefined') {
          document.documentElement.classList.remove('theme-light', 'theme-dark', 'theme-hc');
          
          if (theme === 'dark') {
            document.documentElement.classList.add('theme-dark', 'dark');
          } else if (theme === 'high-contrast') {
            document.documentElement.classList.add('theme-hc');
            document.documentElement.classList.remove('dark');
          } else {
            document.documentElement.classList.add('theme-light');
            document.documentElement.classList.remove('dark');
          }
        }
      },
    }),
    { name: THEME_KEY }
  )
);
