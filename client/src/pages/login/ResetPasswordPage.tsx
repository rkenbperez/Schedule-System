// pages/login/ResetPasswordPage.tsx
import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { accountService } from '../../services/Account.service';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Invalid or missing reset link.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsPending(true);
    try {
      await accountService.resetPassword(token, newPassword);
      setDone(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to reset password'
      );
    } finally {
      setIsPending(false);
    }
  };

  if (done) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-surface-secondary px-4'>
        <div className='w-full max-w-sm rounded-2xl border border-border bg-surface p-6 sm:p-8 text-center'>
          <div className='mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-apple-green-50 text-apple-green-600 mb-4'>
            <CheckCircle size={22} />
          </div>
          <h2 className='text-lg font-semibold text-text-primary'>Password reset</h2>
          <p className='mt-1 text-sm text-text-secondary'>
            Your password has been reset successfully.
          </p>
          <div className='mt-6'>
            <Link
              to='/'
              className='flex w-full h-10 items-center justify-center gap-2 rounded-lg bg-apple-green-600 text-sm font-medium text-white shadow-sm transition hover:bg-apple-green-700 active:scale-[0.98]'
            >
              <ArrowLeft size={14} /> Sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='flex min-h-screen items-center justify-center bg-surface-secondary px-4'>
      <div className='w-full max-w-sm rounded-2xl border border-border bg-surface p-6 sm:p-8'>
        <div className='mb-6 flex flex-col items-center gap-3'>
          <span className='grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-apple-green-300 to-apple-green-600 text-white shadow-lg shadow-apple-green-400/20'>
            <Mail size={22} />
          </span>
          <div className='text-center'>
            <h1 className='text-xl font-semibold tracking-tight text-text-primary'>
              Reset password
            </h1>
            <p className='mt-1 text-sm text-text-secondary'>
              Enter your new password below.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
          {error && (
            <p className='rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700'>
              {error}
            </p>
          )}

          <div className='flex flex-col gap-1.5'>
            <label
              htmlFor='new-password'
              className='text-sm font-medium text-text-primary'
            >
              New password
            </label>
            <input
              id='new-password'
              type='password'
              autoComplete='new-password'
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder='••••••••'
              className='h-10 rounded-lg border border-border bg-surface-tertiary px-3 text-sm text-text-primary placeholder-text-tertiary outline-none transition focus:border-apple-green-400 focus:ring-2 focus:ring-apple-green-100'
            />
          </div>

          <div className='flex flex-col gap-1.5'>
            <label
              htmlFor='confirm-password'
              className='text-sm font-medium text-text-primary'
            >
              Confirm password
            </label>
            <input
              id='confirm-password'
              type='password'
              autoComplete='new-password'
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder='••••••••'
              className='h-10 rounded-lg border border-border bg-surface-tertiary px-3 text-sm text-text-primary placeholder-text-tertiary outline-none transition focus:border-apple-green-400 focus:ring-2 focus:ring-apple-green-100'
            />
          </div>

          <button
            type='submit'
            disabled={isPending}
            className='flex h-10 items-center justify-center gap-2 rounded-lg bg-apple-green-600 text-sm font-medium text-white shadow-sm transition hover:bg-apple-green-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60'
          >
            {isPending ? 'Resetting…' : 'Reset password'}
          </button>
        </form>
      </div>
    </div>
  );
}
