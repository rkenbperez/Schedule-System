// components/registrar/TimetableSidepanel.tsx
// Slide-out timetable panel showing the current schedule as a day × time grid.
// Opens from the registrar layout calendar button.

import { X, Calendar } from 'lucide-react';
import { useSchedules } from '../../hooks/Schedule.hooks';
import type { Schedule } from '../../types/Types';

const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

const TIME_SLOTS = [
  { label: '07:00', hour: 7 },
  { label: '08:00', hour: 8 },
  { label: '09:00', hour: 9 },
  { label: '10:00', hour: 10 },
  { label: '11:00', hour: 11 },
  { label: '12:00', hour: 12 },
  { label: '13:00', hour: 13 },
  { label: '14:00', hour: 14 },
  { label: '15:00', hour: 15 },
  { label: '16:00', hour: 16 },
];

interface TimetableSidepanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TimetableSidepanel({ isOpen, onClose }: TimetableSidepanelProps) {
  const { data: schedules, isLoading } = useSchedules({ enabled: isOpen });

  if (!isOpen) return null;

  // Index classes by (day, hour) so each grid cell can show its classes.
  // A class spanning multiple duration_slots appears in each hour cell it occupies.
  const classIndex = new Map<string, Schedule[]>();
  (schedules ?? []).forEach((s: Schedule) => {
    const day = s.day ?? 0;
    const startHour = parseInt(s.start_time.split(':')[0], 10);
    const duration = Math.max(1, s.duration_slots || 1);
    for (let h = startHour; h < startHour + duration; h++) {
      const key = `${day}-${h}`;
      if (!classIndex.has(key)) classIndex.set(key, []);
      classIndex.get(key)!.push(s);
    }
  });

  const totalClasses = (schedules ?? []).length;

  return (
    <div className='fixed inset-0 z-50 flex justify-right'>
      {/* Backdrop */}
      <div
        className='absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity'
        onClick={onClose}
      />

      {/* Sidepanel */}
      <div className='relative w-full max-w-[950px] h-full bg-surface border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-300'>
        {/* Header */}
        <div className='flex items-center justify-between border-b border-border px-6 py-4 bg-surface/90 backdrop-blur-md'>
          <div className='flex items-center gap-3'>
            <div className='w-10 h-10 rounded-lg bg-apple-green-100 flex items-center justify-center'>
              <Calendar size={18} className='text-apple-green-700' />
            </div>
            <div>
              <h2 className='text-sm font-semibold text-text-primary'>Timetable</h2>
              <p className='text-xs text-text-secondary'>
                {totalClasses} scheduled class{totalClasses !== 1 ? 'es' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className='w-8 h-8 rounded-full bg-surface-secondary hover:bg-border flex items-center justify-center transition'
          >
            <X size={16} className='text-text-secondary' />
          </button>
        </div>

        {/* Grid */}
        <div className='flex-1 overflow-auto'>
          {isLoading ? (
            <div className='flex-1 flex items-center justify-center text-text-secondary py-20'>
              Loading timetable…
            </div>
          ) : (
            <div className='p-6'>
              <div className='grid grid-cols-6 border border-border'>
                {/* Header row: time column + day columns */}
                <div className='col-span-1 border-b border-border bg-surface-secondary'>
                  <div className='px-3 py-2 text-[10px] font-semibold text-text-secondary text-right uppercase tracking-wider'>
                    Time
                  </div>
                </div>
                {DAY_SHORT.map((day) => (
                  <div key={day} className='border-b border-border bg-surface-secondary'>
                    <div className='px-3 py-2 text-[10px] font-semibold text-text-secondary uppercase tracking-wider'>
                      {day}
                    </div>
                  </div>
                ))}
              </div>

              {/* Time slot rows */}
              {TIME_SLOTS.map((slot) => (
                <div key={slot.label} className='grid grid-cols-6 border-b border-border'>
                  {/* Time label column */}
                  <div className='col-span-1 border-r border-border bg-surface/40'>
                    <div className='px-3 py-3 text-[10px] font-medium text-text-secondary text-right'>
                      {slot.label}
                    </div>
                  </div>

                  {/* Day cells */}
                  {DAY_SHORT.map((_, di) => {
                    const classes = classIndex.get(`${di}-${slot.hour}`);
                    return (
                      <div
                        key={di}
                        className='border-r border-border min-h-[52px] group'
                      >
                        {classes?.map((cls, idx) => (
                          <div
                            key={idx}
                            title={`${cls.subject_label}\n${cls.section_name}\n${cls.prof_name}\n${cls.room_name}\n${cls.day_display}, ${cls.start_time} – ${cls.end_time}`}
                            className='mx-2 my-0.5 rounded px-2 py-1 text-[9px] font-medium text-apple-green-700 bg-apple-green-100 border border-apple-green-200/60 shadow-sm'
                          >
                            {cls.subject_label}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}

              {totalClasses === 0 && (
                <div className='flex flex-col items-center justify-center py-20 text-text-secondary'>
                  <Calendar size={32} className='mb-3 opacity-50' />
                  <p className='text-sm'>No scheduled classes yet.</p>
                  <p className='text-xs text-text-tertiary mt-1'>
                    Generate a schedule to see it here.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
