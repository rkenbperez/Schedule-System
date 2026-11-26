import type { User } from '../types/Types';

/**
 * Resolve the canonical dashboard for a signed-in user.
 *
 * Keep this as the single source of truth so login, the 404 page, and the
 * role guards cannot drift apart again.
 */
export function dashboardPathFor(user: User | null | undefined): string {
  if (!user) return '/';
  if (user.role === 'registrar') return '/registrar';
  if (user.role === 'department_head') return '/department-head';
  if (user.role === 'professor') {
    return `/teacher/${encodeURIComponent(user.username)}`;
  }
  if (user.role === 'student') return '/student';
  return '/';
}
