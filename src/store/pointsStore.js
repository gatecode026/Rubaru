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
      const res = await api.get('/v1/wallet');
      if (res.data && res.data.ok && res.data.data) {
        set({
          balance: res.data.data.availableBalance,
          lifetimeEarned: res.data.data.lifetimeEarned,
          lifetimeSpent: res.data.data.lifetimeSpent,
          status: res.data.data.status,
          isLoading: false,
          lastUpdated: new Date(),
        });
        return res.data.data;
      }
    } catch (err) {
      console.warn('[WALLET STORE] Failed to fetch wallet balance:', err.message);
      set({ isLoading: false });
    }
  },

  setBalance: (amount) => set({ balance: amount, lastUpdated: new Date() }),
  addPoints: (amount) => set((state) => ({ balance: state.balance + amount, lastUpdated: new Date() })),
}));
