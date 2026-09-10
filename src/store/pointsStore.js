import { create } from 'zustand';
import api from '../services/api';

export const usePointsStore = create((set, get) => ({
  balance: 0,
  lifetimeEarned: 0,
  lifetimeSpent: 0,
  status: 'ACTIVE',
  isLoading: false,
  lastUpdated: null,

  fetchBalance: async () => {
    try {
      set({ isLoading: true });
      try {
        const res = await api.get('/v1/wallet');
        if (res.data && res.data.ok && res.data.data) {
          const bal = res.data.data.availableBalance ?? res.data.data.balance ?? 0;
          set({
            balance: bal,
            lifetimeEarned: res.data.data.lifetimeEarned ?? 0,
            lifetimeSpent: res.data.data.lifetimeSpent ?? 0,
            status: res.data.data.status || 'ACTIVE',
            isLoading: false,
            lastUpdated: new Date(),
          });
          return bal;
        }
      } catch (wErr) {
        // Fallback to /profiles/me
      }

      const pRes = await api.get('/profiles/me');
      const userPoints = pRes.data?.user?.points ?? pRes.data?.points ?? get().balance;
      set({
        balance: userPoints,
        isLoading: false,
        lastUpdated: new Date(),
      });
      return userPoints;
    } catch (err) {
      console.warn('[WALLET STORE] Failed to fetch balance:', err.message);
      set({ isLoading: false });
    }
  },

  setBalance: (amount) => set({ balance: amount, lastUpdated: new Date() }),
  addPoints: (amount) => set((state) => ({ balance: state.balance + amount, lastUpdated: new Date() })),
}));
