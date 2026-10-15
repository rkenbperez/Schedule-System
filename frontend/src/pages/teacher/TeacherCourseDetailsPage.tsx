// pages/teacher/TeacherCourseDetailsPage.tsx
import { ArrowLeft, Check, Clock } from 'lucide-react';

export default function TeacherCourseDetailsPage() {
  return (
    <section className='w-full max-w-2xl'>
      <button className='mb-4 flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary'>
        <ArrowLeft size={15} />
        Back to my courses
      </button>

      <h1 className='text-lg font-medium text-text-primary'>COSC 7</h1>
      <p className='mb-6 text-sm text-text-secondary'>
        Data Structures and Algorithms
      </p>

      <div className='mb-6 rounded-card border border-border bg-surface p-4'>
        <dl className='grid grid-cols-2 gap-y-3 text-sm'>
          <dt className='text-text-tertiary'>Section</dt>
          <dd className='text-text-primary'>3-A</dd>

          <dt className='text-text-tertiary'>Students</dt>
          <dd className='text-text-primary'>30</dd>
        </dl>
      </div>

      <h2 className='mb-3 text-sm font-medium text-text-primary'>Components</h2>
      <div className='flex flex-col gap-3'>
        <div className='flex items-center justify-between rounded-card border border-border bg-surface p-4'>
          <div className='flex items-center gap-3'>
            <Check size={18} className='text-apple-green-600' />
            <div>
              <p className='text-sm font-medium text-text-primary'>Lecture</p>
              <p className='text-xs text-text-secondary sm:text-sm'>
                Monday, 7:00 - 10:00 AM · Room 101
              </p>
            </div>
          </div>
          <span className='rounded-full bg-apple-green-50 px-2.5 py-1 text-[10px] font-medium text-apple-green-700 sm:text-xs'>
            Scheduled
          </span>
        </div>

        <div className='flex items-center justify-between rounded-card border border-border bg-surface p-4'>
          <div className='flex items-center gap-3'>
            <Clock size={18} className='text-amber-600' />
            <div>
              <p className='text-sm font-medium text-text-primary'>
                Laboratory
              </p>
              <p className='text-xs text-text-secondary sm:text-sm'>
                Not scheduled yet
              </p>
            </div>
          </div>
          <button className='rounded-md bg-apple-green-400 px-3.5 py-1.5 text-[13px] font-medium text-white transition hover:bg-apple-green-600'>
            Select schedule
          </button>
        </div>
      </div>
    </section>
  );
}
