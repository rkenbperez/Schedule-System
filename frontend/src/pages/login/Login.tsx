import { useState } from 'react';
import { CalendarCheck, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSignIn } from '../../hooks/Auth.hooks';

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const signIn = useSignIn();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    try {
      await signIn.mutateAsync({ email, password });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in');
    }
  };

  return (
    <div className='flex min-h-screen items-center justify-center bg-surface-secondary px-4'>
      <div className='w-full max-w-sm'>
        {/* Logo */}
        <div className='mb-8 flex flex-col items-center gap-3'>
          <span className='grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-apple-green-300 to-apple-green-600 text-white shadow-lg shadow-apple-green-400/20'>
            <CalendarCheck size={22} />
          </span>
          <div className='text-center'>
            <h1 className='text-xl font-semibold tracking-tight text-text-primary'>
              Scheduler
            </h1>
            <p className='mt-1 text-sm text-text-secondary'>
              Sign in to manage your schedule
            </p>
          </div>
        </div>

        {/* Login Card */}
        <div className='rounded-2xl border border-border bg-surface p-6 sm:p-8'>
          <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
            {error && (
              <p className='rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700'>
                {error}
              </p>
            )}
            {/* Email */}
            <div className='flex flex-col gap-1.5'>
              <label
                htmlFor='email'
                className='text-sm font-medium text-text-primary'
              >
                Email
              </label>
              <input
                id='email'
                type='email'
                onChange={(e) => setEmail(e.target.value)}
                placeholder='you@school.edu'
                className='h-10 rounded-lg border border-border bg-surface-tertiary px-3 text-sm text-text-primary placeholder-text-tertiary outline-none transition focus:border-apple-green-400 focus:ring-2 focus:ring-apple-green-100'
              />
            </div>

            {/* Password */}
            <div className='flex flex-col gap-1.5'>
              <label
                htmlFor='password'
                className='text-sm font-medium text-text-primary'
              >
                Password
              </label>
              <div className='relative'>
                <input
                  id='password'
                  type={showPassword ? 'text' : 'password'}
                  placeholder='Enter your password'
                  onChange={(e) => setPassword(e.target.value)}
                  className='h-10 w-full rounded-lg border border-border bg-surface-tertiary px-3 pr-10 text-sm text-text-primary placeholder-text-tertiary outline-none transition focus:border-apple-green-400 focus:ring-2 focus:ring-apple-green-100'
                />
                <button
                  type='button'
                  onClick={() => setShowPassword((s) => !s)}
                  className='absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary transition hover:text-text-secondary'
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Forgot password */}
            <div className='flex justify-end'>
              <button
                type='button'
                className='text-xs font-medium text-apple-green-600 transition hover:text-apple-green-700'
              >
                Forgot password?
              </button>
            </div>

            {/* Submit */}
            <button
              type='submit'
              disabled={signIn.isPending}
              className='flex h-10 items-center justify-center gap-2 rounded-lg bg-apple-green-600 text-sm font-medium text-white shadow-sm transition hover:bg-apple-green-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60'
            >
              {signIn.isPending ? 'Signing in…' : 'Sign in'}
              <ArrowRight size={15} />
            </button>
          </form>
        </div>

        {/* Student Lookup Link */}
        <div className='mt-6 text-center'>
          <p className='text-sm text-text-secondary'>
            Are you a student?{' '}
            <Link
              to='/student'
              className='font-medium text-apple-green-600 transition hover:text-apple-green-700'
            >
              Look up your schedule
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
