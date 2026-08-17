import { create } from 'zustand';

export const usePointsStore = create((set) => ({
  balance: 250,
  addPoints: (amount) => set((state) => ({ balance: state.balance + amount })),
  setBalance: (amount) => set({ balance: amount }),
}));
