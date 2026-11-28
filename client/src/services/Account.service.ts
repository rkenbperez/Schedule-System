// client/src/services/Account.service.ts
import type { User } from '../types/Types';
import { authStorage } from './authStorage';
import { apiJson } from './http';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

type SignInResult = {
  access: string;
  refresh: string;
  user: User;
};

class AccountService {
  async signIn(email: string, password: string) {
    const response = await fetch(`${BASE_URL}/api/auth/jwt/login/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error('Invalid email or password');
    }

    const data: SignInResult = await response.json();

    // Persist tokens so subsequent API calls can authenticate.
    authStorage.setTokens(data.access, data.refresh);

    return data;
  }

  async getCurrentUser() {
    return apiJson<User>(`${BASE_URL}/api/auth/jwt/me/`);
  }

  async signOut() {
    const refreshToken = authStorage.getRefreshToken();

    if (refreshToken) {
      // Blacklist the refresh token on the server.
      await fetch(`${BASE_URL}/api/auth/jwt/logout/`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authStorage.getAccessToken() ?? ''}`,
        },
        body: JSON.stringify({ refresh: refreshToken }),
      });
    }

    // Always clear client-side tokens.
    authStorage.clearTokens();
  }

  async forgotPassword(email: string) {
    const response = await fetch(`${BASE_URL}/api/auth/password-reset/request/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to send reset link');
    }

    return response.json();
  }

  async changePassword(oldPassword: string, newPassword: string) {
    return apiJson<{ detail: string }>(`${BASE_URL}/api/auth/change-password/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        old_password: oldPassword,
        new_password: newPassword,
      }),
    });
  }

  async resetPassword(token: string, newPassword: string) {
    const response = await fetch(
      `${BASE_URL}/api/auth/password-reset/confirm/${token}/`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ new_password: newPassword }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to reset password');
    }

    return response.json();
  }
}

export const accountService = new AccountService();
