import { create } from 'zustand';

interface HamburgerState {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

export const useHamburgerStore = create<HamburgerState>((set) => ({
  isOpen: false,
  setOpen: (open) => set({ isOpen: open }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
}));
