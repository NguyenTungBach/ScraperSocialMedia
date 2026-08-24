import { useLoadingStore } from '@/store/loading';

/** Global full-screen loading — mirrors Vue `@/utils/handleLoading` `setLoading`. */
export function setLoading(status = true): void {
  useLoadingStore.getState().setLoading(status);
}

/** Loading overlay on shift table area — mirrors Vue `loading/setPaddingShift`. */
export function setPaddingShift(status = true): void {
  useLoadingStore.getState().setPaddingShift(status);
}
