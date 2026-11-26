import { describe, expect, it } from 'vitest';
import type { User } from '../types/Types';
import { dashboardPathFor } from './dashboardRoute';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    username: 'demo_prof1',
    email: 'demo_prof1@school.edu',
    role: 'professor',
    is_staff: false,
    ...overrides,
  };
}

describe('dashboardPathFor', () => {
  it('sends registrars to the canonical registrar dashboard', () => {
    expect(
      dashboardPathFor(makeUser({ role: 'registrar', is_staff: true }))
    ).toBe('/registrar');
  });

  it('sends professors to their username-scoped dashboard', () => {
    expect(dashboardPathFor(makeUser({ username: 'demo_prof 1' }))).toBe(
      '/teacher/demo_prof%201'
    );
  });

  it('sends students to the public student lookup', () => {
    expect(dashboardPathFor(makeUser({ role: 'student' }))).toBe('/student');
  });

  it('falls back to login for missing or unknown users', () => {
    expect(dashboardPathFor(undefined)).toBe('/');
    expect(dashboardPathFor(null)).toBe('/');
    expect(dashboardPathFor(makeUser({ role: 'user' }))).toBe('/');
  });
});
