import { BookOpen, Clock, Calendar } from 'lucide-react';

import { mockAssignments, mockSchedules } from '../../SampleData';
import StatCard from './components/StatCard';
import DashboardCourseCard from './components/DashboardCourseCard';

export default function TeacherDashboard() {
  const unscheduledCount = mockAssignments.filter((a) => !a.scheduled).length;

  return (
    <section className='w-full'>
      <p className='mb-6 text-sm text-text-secondary'>
        1st semester, 2026 to 2027
      </p>

      <div className='grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3'>
        <StatCard
          icon={<BookOpen size={16} />}
          label='Assigned courses'
          value={mockAssignments.length}
        />

        <StatCard
          icon={<Clock size={16} />}
          label='Unscheduled'
          value={unscheduledCount}
          variant='warning'
        />

        <StatCard
          icon={<Calendar size={16} />}
          label='Classes today'
          value={2}
        />
      </div>

      <section className='flex flex-col py-5'>
        <h2 className='pb-5 text-md font-medium tracking-tight text-text-primary'>
          My courses
        </h2>
        <div className='grid grid-cols-1 md:grid-cols-3 gap-2'>
          {mockSchedules.map((schedule) => (
            <DashboardCourseCard key={schedule.id} schedule={schedule} />
          ))}
        </div>
      </section>
    </section>
  );
}
