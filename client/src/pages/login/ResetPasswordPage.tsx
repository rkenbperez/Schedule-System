import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Mail } from 'lucide-react';
import { accountService } from '../../services/Account.service';
import {
  Alert,
  Button,
  Card,
  LinkButton,
  TextField,
} from '../../components/ui';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
  }

  return (
    <div className='flex min-h-dvh items-center justify-center bg-surface-secondary px-4 py-10'>
      <div className='w-full max-w-md'>
        <div className='mb-7 flex flex-col items-center gap-3 text-center'>
          <span className='grid h-12 w-12 place-items-center rounded-card bg-apple-green-600 text-white'>
            {done ? (
              <CheckCircle2 size={24} aria-hidden='true' />
            ) : (
              <Mail size={24} aria-hidden='true' />
            )}
          </span>
          <div>
            <h1 className='text-h1 text-text-primary'>
              {done ? 'Password reset' : 'Reset password'}
            </h1>
            <p className='mt-1 text-body text-text-secondary'>
              {done
                ? 'Your password has been reset successfully.'
                : 'Choose a new password for your account.'}
            </p>
          </div>
        </div>

        <Card className='p-5 sm:p-7'>
          {done ? (
            <div className='space-y-5 text-center'>
              <p className='text-body text-text-secondary'>
                You can now sign in with your new password.
              </p>
              <LinkButton to='/' variant='primary' className='w-full'>
                <ArrowLeft size={16} aria-hidden='true' />
                Back to sign in
              </LinkButton>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className='flex flex-col gap-4' noValidate>
              {error && (
                <Alert tone='danger' title='Unable to reset password'>
                  {error}
                </Alert>
              )}

              <TextField
                id='new-password'
                label='New password'
                type='password'
                autoComplete='new-password'
                required
                minLength={8}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder='At least 8 characters'
                hint='Use at least 8 characters.'
              />

              <TextField
                id='confirm-password'
                label='Confirm password'
                type='password'
                autoComplete='new-password'
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder='Re-enter your new password'
              />

              <Button type='submit' className='w-full' loading={isPending}>
                Reset password
              </Button>

              <LinkButton to='/' variant='ghost' className='w-full'>
                <ArrowLeft size={16} aria-hidden='true' />
                Back to sign in
              </LinkButton>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
