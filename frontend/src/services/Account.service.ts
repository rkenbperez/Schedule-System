import type { RegisterCredentials, User } from '../types/Types';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

type SignInResult = {
  user: User;
};

class AccountService {
  async signIn(username: string, password: string) {
    const response = await fetch(`${BASE_URL}/api/auth/login/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      throw new Error('Invalid email or password');
    }

    const data: SignInResult = await response.json();

    return data;
  }

  async signUp(credentials: RegisterCredentials) {
    const response = await fetch(`${BASE_URL}/api/auth/register/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      throw new Error('Unable to create account');
    }

    const data: SignInResult = await response.json();

    return data;
  }

  async getCurrentUser() {
    const response = await fetch(`${BASE_URL}/api/auth/me/`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Not authenticated');
    }

    const data: User = await response.json();

    return data;
  }

  async signOut() {
    await fetch(`${BASE_URL}/api/auth/logout/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async refreshToken(userId: string) {
    const response = await fetch(`${BASE_URL}/api/auth/logout/`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id: { userId } }),
    });

    if (!response.ok) {
      throw new Error('Invalid userId cannot refresh the token');
    }

    const data = await response.json();

    //either return true or the userInfo again
    // the token is saved in the cookies in the backend let the backend handle the token and
    //verifation, just let the frontend send a request to refresh if the authstate change fails
    return data;
  }
}

export const accountService = new AccountService();
