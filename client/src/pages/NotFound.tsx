// pages/NotFound.tsx
import { Link } from 'react-router-dom';
import { ArrowLeft, Calendar } from 'lucide-react';

export default function NotFound() {
  return (
    <section className='flex min-h-screen items-center justify-center bg-surface-secondary px-4'>
      <div className='rounded-2xl border border-border bg-surface p-8 text-center'>
        <div className='mb-6 opacity-50'>
          <Calendar size='64' className='text-text-tertiary' />
        </div>
        <h1 className='text-3xl font-medium text-text-primary mb-2'>404</h1>
        <h2 className='text-lg font-medium text-text-primary mb-2'>Page Not Found</h2>
        <p className='text-sm text-text-secondary mb-6'>
          The page you are looking for does not exist.
        </p>
        <div className='flex flex-col sm:flex-row gap-3 justify-center'>
          <Link
            to='/dashboard'
            className='flex items-center gap-2 rounded-md bg-apple-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-apple-green-700'
          >
            <ArrowLeft size={14} />
            Go to Dashboard
          </Link>
          <Link
            to='/'
            className='flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-surface-secondary'
          >
            Back to Login
          </Link>
        </div>
      </div>
    </section>
  );
}
