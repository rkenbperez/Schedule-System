import { useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarCheck,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useSignIn } from '../../hooks/useAuth';
import { accountService } from '../../services/Account.service';
import {
  Alert,
  Button,
  Card,
  IconButton,
  TextField,
} from '../../components/ui';
import SchedulePreview from './components/SchedulePreview';

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetPending, setIsResetPending] = useState(false);
  const [resetStatus, setResetStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const signIn = useSignIn();
  const navigate = useNavigate();

  async function handleForgotPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResetStatus(null);
    setIsResetPending(true);
    try {
      await accountService.forgotPassword(resetEmail);
      setResetStatus({
        type: 'success',
        message:
          'If an account exists for that email, a reset link has been sent.',
      });
      setResetEmail('');
    } catch (err) {
      setResetStatus({
        type: 'error',
        message:
          err instanceof Error ? err.message : 'Unable to send reset link.',
      });
    } finally {
      setIsResetPending(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      const data = await signIn.mutateAsync({ email, password });
      if (data.user?.is_staff) {
        navigate('/registrar');
      } else {
        navigate(`/teacher/${data.user?.username}/assignments`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in');
    }
  }

  return (
    <div className='min-h-dvh bg-surface-secondary lg:grid lg:grid-cols-[1.08fr_0.92fr]'>
      <aside className='relative hidden min-h-dvh flex-col border-r border-apple-green-100 bg-apple-green-50 p-8 lg:flex xl:p-12'>
        <div
          aria-hidden='true'
          className='pointer-events-none absolute inset-0 overflow-hidden'
        >
          <div className='absolute -right-16 -top-24 h-56 w-56 rounded-[2.5rem] border border-apple-green-200/60 bg-apple-green-100/40' />
          <div className='absolute -bottom-32 -left-20 h-56 w-56 rounded-full bg-apple-green-100/40' />
          <div className='absolute inset-x-10 bottom-12 h-px bg-apple-green-200/60' />
        </div>

        <div className='relative z-10 flex items-center gap-3'>
          <span className='grid h-11 w-11 place-items-center rounded-card bg-apple-green-600 text-white shadow-card'>
            <CalendarCheck size={22} aria-hidden='true' />
          </span>
          <p className='text-h3 text-text-primary'>Scheduler</p>
        </div>

        <div className='relative z-10 flex max-w-lg flex-1 flex-col justify-center space-y-7 py-8 xl:max-w-xl xl:space-y-9 xl:py-12'>
          <h2 className='text-[2rem] font-semibold leading-[1.15] tracking-[-0.03em] text-text-primary xl:text-hero'>
            Every class. Every room.{' '}
            <span className='text-apple-green-700'>One clear schedule.</span>
          </h2>
          <p className='max-w-md text-body leading-relaxed text-text-secondary'>
            Build conflict-free timetables, coordinate faculty and rooms, and
            publish schedules students can actually find.
          </p>

          <SchedulePreview />

          <ul className='flex flex-wrap items-center gap-x-6 gap-y-3 text-body-sm text-text-secondary'>
            <li className='inline-flex items-center gap-1.5'>
              <CheckCircle2
                size={13}
                className='text-apple-green-600'
                aria-hidden='true'
              />
              Conflict-aware
            </li>
            <li className='inline-flex items-center gap-1.5'>
              <CheckCircle2
                size={13}
                className='text-apple-green-600'
                aria-hidden='true'
              />
              Room-aware
            </li>
            <li className='inline-flex items-center gap-1.5'>
              <CheckCircle2
                size={13}
                className='text-apple-green-600'
                aria-hidden='true'
              />
              Student-ready
            </li>
          </ul>
        </div>
      </aside>

      <main className='relative flex min-h-dvh items-center justify-center bg-surface-secondary px-4 py-10 sm:px-6 lg:min-h-0 lg:px-10 xl:px-14'>
        <div className='w-full max-w-[420px]'>
          <div className='relative z-10 mb-6 flex items-center gap-3 lg:hidden'>
            <span className='grid h-11 w-11 place-items-center rounded-card bg-apple-green-600 text-white shadow-card'>
              <CalendarCheck size={22} aria-hidden='true' />
            </span>
            <p className='text-h3 text-text-primary'>Scheduler</p>
          </div>

          <Card className='animate-rise-in overflow-hidden border-apple-green-100 shadow-card'>
            <div className='h-1 w-full bg-apple-green-600' aria-hidden='true' />

            <div className='border-b border-border px-6 pb-6 pt-7 sm:px-8'>
              <span className='mb-5 grid h-11 w-11 place-items-center rounded-control border border-apple-green-100 bg-apple-green-50 text-apple-green-700'>
                <ShieldCheck size={19} aria-hidden='true' />
              </span>
              <h1 className='text-h1 text-text-primary'>
                {isResetMode ? 'Reset your password' : 'Sign in'}
              </h1>
              <p className='mt-2 text-body text-text-secondary'>
                {isResetMode
                  ? 'Enter your account email and we’ll send a reset link.'
                  : 'Use your university account to manage schedules, faculty, and rooms.'}
              </p>
            </div>

            <div className='space-y-5 px-6 py-6 sm:px-8'>
              {error && <Alert tone='danger'>{error}</Alert>}

              {resetStatus && (
                <Alert
                  tone={resetStatus.type === 'success' ? 'success' : 'danger'}
                >
                  {resetStatus.message}
                </Alert>
              )}

              {isResetMode ? (
                <form onSubmit={handleForgotPassword} className='space-y-4'>
                  <TextField
                    id='reset-email'
                    label='Email'
                    type='email'
                    value={resetEmail}
                    onChange={(event) => setResetEmail(event.target.value)}
                    placeholder='you@school.edu'
                    autoComplete='email'
                    required
                  />

                  <Button
                    type='submit'
                    loading={isResetPending}
                    icon={<ArrowRight size={17} aria-hidden='true' />}
                    className='w-full'
                  >
                    Send reset link
                  </Button>

                  <Button
                    type='button'
                    variant='ghost'
                    icon={<ArrowLeft size={16} aria-hidden='true' />}
                    className='w-full'
                    onClick={() => {
                      setIsResetMode(false);
                      setResetStatus(null);
                    }}
                  >
                    Back to sign in
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleSubmit} className='space-y-5'>
                  <TextField
                    id='email'
                    label='Email'
                    type='email'
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder='you@school.edu'
                    autoComplete='email'
                    required
                  />

                  <div className='space-y-1.5'>
                    <TextField
                      id='password'
                      label='Password'
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder='Enter your password'
                      autoComplete='current-password'
                      required
                      trailing={
                        <IconButton
                          type='button'
                          label={
                            showPassword ? 'Hide password' : 'Show password'
                          }
                          variant='ghost'
                          size='sm'
                          onClick={() =>
                            setShowPassword((current) => !current)
                          }
                        >
                          {showPassword ? (
                            <EyeOff size={17} aria-hidden='true' />
                          ) : (
                            <Eye size={17} aria-hidden='true' />
                          )}
                        </IconButton>
                      }
                    />

                    <div className='flex justify-end'>
                      <button
                        type='button'
                        onClick={() => {
                          setIsResetMode(true);
                          setResetEmail(email);
                          setError(null);
                        }}
                        className='rounded-control text-body-sm font-medium text-apple-green-700 transition-colors hover:text-apple-green-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-apple-green-600'
                      >
                        Forgot password?
                      </button>
                    </div>
                  </div>

                  <Button
                    type='submit'
                    loading={signIn.isPending}
                    icon={<ArrowRight size={17} aria-hidden='true' />}
                    className='w-full'
                  >
                    Sign in
                  </Button>
                </form>
              )}
            </div>

            <div className='flex flex-wrap items-center justify-between gap-2 border-t border-border bg-surface-tertiary px-6 py-3 text-caption text-text-secondary sm:px-8'>
              <span className='inline-flex items-center gap-1.5'>
                <LockKeyhole size={13} aria-hidden='true' />
                Secure sign-in
              </span>
              <span>Need help? Contact the registrar</span>
            </div>
          </Card>

          <Link
            to='/student'
            className='mt-5 flex min-h-11 items-center gap-3 rounded-card border border-apple-green-200 bg-apple-green-50/50 p-4 transition-colors hover:border-apple-green-300 hover:bg-apple-green-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-apple-green-600'
          >
            <span className='grid h-10 w-10 shrink-0 place-items-center rounded-control border border-apple-green-200 bg-surface text-apple-green-700'>
              <GraduationCap size={19} aria-hidden='true' />
            </span>
            <span className='min-w-0 flex-1'>
              <span className='block text-body-sm font-semibold text-text-primary'>
                Student schedule lookup
              </span>
              <span className='mt-0.5 block text-caption text-text-secondary'>
                Find your section’s classes and rooms.
              </span>
            </span>
            <ArrowUpRight
              size={17}
              className='shrink-0 text-apple-green-700'
              aria-hidden='true'
            />
          </Link>
        </div>
      </main>
    </div>
  );
}
