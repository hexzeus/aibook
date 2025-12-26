import { create } from 'zustand';

interface RateLimitState {
  isRateLimited: boolean;
  resetTime: Date | null;
  setRateLimited: (resetTime: Date) => void;
  clearRateLimit: () => void;
}

export const useRateLimitStore = create<RateLimitState>((set) => ({
  isRateLimited: false,
  resetTime: null,
  setRateLimited: (resetTime: Date) => set({ isRateLimited: true, resetTime }),
  clearRateLimit: () => set({ isRateLimited: false, resetTime: null }),
}));
