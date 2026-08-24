import { redirect } from 'next/navigation';
import { DEFAULT_AFTER_LOGIN } from '@/lib/config/navigation';
import { isAuthRequired } from '@/lib/config/auth';

export default function RootPage() {
  redirect(isAuthRequired() ? '/login' : DEFAULT_AFTER_LOGIN);
}
