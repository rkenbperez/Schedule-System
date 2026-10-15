import { Outlet } from 'react-router-dom';
import { CalendarCheck } from 'lucide-react';

export default function StudentLayout() {
  return (
    <div className='min-h-screen bg-surface-secondary'>
      <nav className='border-b border-border bg-surface/80 backdrop-blur-xl'>
        <div className='mx-auto flex h-12 max-w-xl items-center gap-2.5 px-4'>
          <span className='grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-apple-green-300 to-apple-green-600 text-white'>
            <CalendarCheck size={14} />
          </span>
          <span className='text-sm font-semibold tracking-tight text-text-primary'>
            Student Schedule Lookup
          </span>
        </div>
      </nav>
      <main className='mx-auto max-w-xl px-4 py-8'>
        <Outlet />
      </main>
    </div>
  );
}
