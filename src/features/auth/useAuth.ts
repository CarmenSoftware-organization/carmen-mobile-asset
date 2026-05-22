import { useAuthStore } from './authStore';

export function useAuth() {
  const status = useAuthStore((s) => s.status);
  const session = useAuthStore((s) => s.session);
  return { status, session };
}
