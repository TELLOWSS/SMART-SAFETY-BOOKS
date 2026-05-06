import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark' | 'high-contrast';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

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
    { name: 'safetycore-theme' }
  )
);
