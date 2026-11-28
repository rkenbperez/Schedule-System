// pages/settings/AccountSettingsPage.tsx
// Account summary and self-service password change for every signed-in role.
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, KeyRound, Mail, Shield, User } from 'lucide-react';
import { useMe } from '../../hooks/useAuth';
import type { User as AppUser } from '../../types/Types';
import { useToast } from '../../hooks/useToast';
import { accountService } from '../../services/Account.service';
import { dashboardPathFor } from '../../utils/dashboardRoute';

const ROLE_LABELS: Record<string, string> = {
  registrar: 'Registrar',
  department_head: 'Department Head',
  professor: 'Professor',
  student: 'Student',
  user: 'User',
};

function accountDepartment(user: AppUser | undefined) {
  if (!user) return '—';
  if (user.role === 'department_head') return user.department?.name ?? '—';
  if (user.role === 'professor') return user.professor?.department || '—';
  return '—';
}

export default function AccountSettingsPage() {
  const { data: user } = useMe();
  const toast = useToast();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const displayName =
    [user?.first_name, user?.last_name].filter(Boolean).join(' ') ||
    user?.username ||
    '';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.addToast({
        type: 'error',
        title: 'Passwords do not match.',
        description: 'Re-enter the new password in both fields.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await accountService.changePassword(oldPassword, newPassword);
      toast.addToast({ type: 'success', title: result.detail });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast.addToast({
        type: 'error',
        title: 'Could not update password.',
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className='mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:py-10'>
      <Link
        to={dashboardPathFor(user)}
        className='mb-4 inline-flex items-center gap-1.5 text-body-sm font-medium text-text-secondary transition hover:text-text-primary'
      >
        <ArrowLeft size={15} aria-hidden='true' />
        Back to dashboard
      </Link>

      <h1 className='text-h3 text-text-primary'>Account Settings</h1>
      <p className='mt-1 text-body-sm text-text-secondary'>
        Review your account details and update your password.
      </p>

      <div className='mt-6 rounded-card border border-border bg-surface p-6'>
        <h2 className='text-body font-semibold text-text-primary'>
          Account summary
        </h2>
        <dl className='mt-4 grid gap-4 sm:grid-cols-2'>
          <div>
            <dt className='flex items-center gap-1.5 text-caption text-text-tertiary'>
              <User size={13} aria-hidden='true' />
              Name
            </dt>
            <dd className='mt-1 text-body-sm text-text-primary'>
              {displayName || '—'}
            </dd>
          </div>
          <div>
            <dt className='flex items-center gap-1.5 text-caption text-text-tertiary'>
              <Mail size={13} aria-hidden='true' />
              Email
            </dt>
            <dd className='mt-1 truncate text-body-sm text-text-primary'>
              {user?.email || '—'}
            </dd>
          </div>
          <div>
            <dt className='flex items-center gap-1.5 text-caption text-text-tertiary'>
              <Shield size={13} aria-hidden='true' />
              Role
            </dt>
            <dd className='mt-1 text-body-sm capitalize text-text-primary'>
              {user ? ROLE_LABELS[user.role] ?? user.role : '—'}
            </dd>
          </div>
          <div>
            <dt className='text-caption text-text-tertiary'>Department</dt>
            <dd className='mt-1 text-body-sm text-text-primary'>
              {accountDepartment(user)}
            </dd>
          </div>
        </dl>
      </div>

      <form
        onSubmit={handleSubmit}
        className='mt-6 rounded-card border border-border bg-surface p-6'
      >
        <h2 className='flex items-center gap-2 text-body font-semibold text-text-primary'>
          <KeyRound size={16} aria-hidden='true' className='text-text-tertiary' />
          Change password
        </h2>

        <div className='mt-4 grid gap-4'>
          <label className='flex flex-col gap-1.5'>
            <span className='text-body-sm font-medium text-text-secondary'>
              Current password
            </span>
            <input
              type='password'
              autoComplete='current-password'
              required
              value={oldPassword}
              onChange={(event) => setOldPassword(event.target.value)}
              className='h-10 rounded-control border border-border bg-surface px-3 text-body-sm text-text-primary outline-none transition-colors focus:border-apple-green-400 focus:ring-2 focus:ring-apple-green-100'
            />
          </label>
          <label className='flex flex-col gap-1.5'>
            <span className='text-body-sm font-medium text-text-secondary'>
              New password
            </span>
            <input
              type='password'
              autoComplete='new-password'
              required
              minLength={8}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className='h-10 rounded-control border border-border bg-surface px-3 text-body-sm text-text-primary outline-none transition-colors focus:border-apple-green-400 focus:ring-2 focus:ring-apple-green-100'
            />
          </label>
          <label className='flex flex-col gap-1.5'>
            <span className='text-body-sm font-medium text-text-secondary'>
              Confirm new password
            </span>
            <input
              type='password'
              autoComplete='new-password'
              required
              minLength={8}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className='h-10 rounded-control border border-border bg-surface px-3 text-body-sm text-text-primary outline-none transition-colors focus:border-apple-green-400 focus:ring-2 focus:ring-apple-green-100'
            />
          </label>
        </div>

        <button
          type='submit'
          disabled={isSubmitting}
          className='mt-5 inline-flex h-10 items-center justify-center rounded-control bg-apple-green-600 px-4 text-body-sm font-medium text-white transition hover:bg-apple-green-700 disabled:opacity-60'
        >
          {isSubmitting ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </section>
  );
}
