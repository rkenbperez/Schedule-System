import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AuthCredentials,
  RegisterCredentials,
  User,
} from '../types/Types';
import { accountService } from '../services/Account.service';

export const authKeys = {
  all: ['auth'] as const,
  me: ['auth', 'me'] as const,
};

export function useSignIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ email, password }: AuthCredentials) =>
      accountService.signIn(email, password),
    onSuccess: (data) => {
      queryClient.setQueryData(authKeys.me, data.user);
    },
  });
}

export function useSignUp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentials: RegisterCredentials) =>
      accountService.signUp(credentials),
    onSuccess: (data) => {
      queryClient.setQueryData(authKeys.me, data.user);
    },
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => accountService.signOut(),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: authKeys.all });
      queryClient.clear();
    },
  });
}

export function useMe(opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: authKeys.me,
    queryFn: () => accountService.getCurrentUser(),
    enabled: opts?.enabled ?? true,
    retry: false,
  });
}

export type { User };
