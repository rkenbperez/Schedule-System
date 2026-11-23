import { Outlet, Link } from 'react-router-dom';
import { CalendarCheck, ArrowLeft } from 'lucide-react';

export default function StudentLayout() {
  return (
    <div className='min-h-dvh bg-surface-secondary'>
      <a
        href='#student-content'
        className='sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-control focus:border focus:border-apple-green-600 focus:bg-surface focus:px-4 focus:py-2.5 focus:text-body-sm focus:font-semibold focus:text-apple-green-700'
      >
        Skip to content
      </a>

      <header className='sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur'>
        <div className='flex h-16 w-full items-center gap-3 px-4 sm:px-6 lg:px-8'>
          <span className='grid h-9 w-9 shrink-0 place-items-center rounded-control bg-apple-green-600 text-white'>
            <CalendarCheck size={18} aria-hidden='true' />
          </span>

          <div className='min-w-0'>
            <p className='truncate text-body font-semibold text-text-primary'>
              Student Schedule Lookup
            </p>
            <p className='truncate text-caption text-text-tertiary'>
              Find your class schedule
            </p>
          </div>

          <Link
            to='/'
            className='ml-auto grid h-11 w-11 shrink-0 place-items-center rounded-control text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text-primary'
            aria-label='Back to login'
            title='Back to login'
          >
            <ArrowLeft size={19} aria-hidden='true' />
          </Link>
        </div>
      </header>

      <main
        id='student-content'
        className='w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8'
      >
        <Outlet />
      </main>
    </div>
  );
}
