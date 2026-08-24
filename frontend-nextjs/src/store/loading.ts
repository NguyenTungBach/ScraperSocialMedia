import { create } from 'zustand';

/** Mirrors Vue `loading` module overlay / paddingShift config. */
export interface LoadingOverlayState {
  show: boolean;
  variant: 'light' | 'white';
  opacity: number;
  blur: string;
  rounded: string;
}

interface LoadingState {
  overlay: LoadingOverlayState;
  paddingShift: LoadingOverlayState;
  setLoading: (status?: boolean) => void;
  setPaddingShift: (status?: boolean) => void;
}

const defaultOverlay: LoadingOverlayState = {
  show: false,
  variant: 'light',
  opacity: 1,
  blur: '1rem',
  rounded: 'sm',
};

const defaultPaddingShift: LoadingOverlayState = {
  show: false,
  variant: 'white',
  opacity: 1,
  blur: '1rem',
  rounded: 'sm',
};

export const useLoadingStore = create<LoadingState>((set) => ({
  overlay: { ...defaultOverlay },
  paddingShift: { ...defaultPaddingShift },

  setLoading: (status = true) =>
    set((state) => ({
      overlay: {
        ...state.overlay,
        show: status,
      },
    })),

  setPaddingShift: (status = true) =>
    set((state) => ({
      paddingShift: {
        ...state.paddingShift,
        show: status,
      },
    })),
}));
