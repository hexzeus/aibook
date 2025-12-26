import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  licenseKey: string | null;
  isAuthenticated: boolean;
  setLicenseKey: (key: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      licenseKey: null,
      isAuthenticated: false,
      setLicenseKey: (key) => {
        localStorage.setItem('license_key', key);
        set({ licenseKey: key, isAuthenticated: true });
      },
      logout: () => {
        localStorage.removeItem('license_key');
        set({ licenseKey: null, isAuthenticated: false });
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
