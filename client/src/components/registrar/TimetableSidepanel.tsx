import { useEffect, useRef, useState } from 'react';
import { CalendarDays, X } from 'lucide-react';
import { useSchedules } from '../../hooks/Schedule.hooks';
import type { Schedule } from '../../types/Types';
import {
  Badge,
  EmptyState,
  IconButton,
  LoadingState,
  SegmentedControl,
} from '../ui';

const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

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

function classTime(schedule: Schedule) {
  return schedule.end_time
    ? `${schedule.start_time} – ${schedule.end_time}`
    : schedule.start_time;
}

export default function TimetableSidepanel({
  isOpen,
  onClose,
}: TimetableSidepanelProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selectedDay, setSelectedDay] = useState(0);
  const { data: schedules, isLoading } = useSchedules({ enabled: isOpen });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) dialog.showModal();
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = previousOverflow;
      };
    }

    if (dialog.open) dialog.close();
  }, [isOpen]);

  const allSchedules = schedules ?? [];

  const classIndex = new Map<string, Schedule[]>();
  allSchedules.forEach((schedule) => {
    const day = schedule.day ?? 0;
    const startHour = Number.parseInt(schedule.start_time.split(':')[0], 10);
    const duration = Math.max(1, schedule.duration_slots || 1);

    for (let hour = startHour; hour < startHour + duration; hour++) {
      const key = `${day}-${hour}`;
      if (!classIndex.has(key)) classIndex.set(key, []);
      classIndex.get(key)!.push(schedule);
    }
  });

  const classesByDay = DAY_FULL.map((_, day) =>
    allSchedules
      .filter((schedule) => (schedule.day ?? 0) === day)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
  );

  const dayOptions = DAY_SHORT.map((day, index) => ({
    value: String(index),
    label: day,
    count: classesByDay[index].length,
  }));

  const selectedClasses = classesByDay[selectedDay] ?? [];

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby='timetable-panel-title'
      aria-modal='true'
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
      className='fixed inset-0 m-0 ml-auto h-dvh max-h-dvh w-full max-w-[960px] overflow-hidden rounded-none border-0 border-l border-border bg-surface p-0 text-text-primary shadow-overlay backdrop:bg-black/40 backdrop:backdrop-blur-[2px]'
    >
      <div className='flex h-full flex-col'>
        <div className='flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6 sm:py-4'>
          <div className='flex min-w-0 items-center gap-3'>
            <span className='grid h-10 w-10 shrink-0 place-items-center rounded-control bg-apple-green-50 text-apple-green-700'>
              <CalendarDays size={19} aria-hidden='true' />
            </span>
            <div className='min-w-0'>
              <h2
                id='timetable-panel-title'
                className='truncate text-h3 text-text-primary'
              >
                Timetable
              </h2>
              <p className='truncate text-caption text-text-tertiary'>
                {allSchedules.length} scheduled class
                {allSchedules.length === 1 ? '' : 'es'}
              </p>
            </div>
          </div>
          <IconButton
            label='Close timetable panel'
            variant='secondary'
            size='sm'
            onClick={onClose}
          >
            <X size={18} aria-hidden='true' />
          </IconButton>
        </div>

        <div className='min-h-0 flex-1 overflow-y-auto p-4 sm:p-6'>
          {isLoading ? (
            <LoadingState label='Loading timetable…' />
          ) : allSchedules.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title='No scheduled classes yet'
              description='Generate a schedule to see it here.'
            />
          ) : (
            <>
              <div className='space-y-4 md:hidden'>
                <SegmentedControl
                  label='Select a day'
                  options={dayOptions}
                  value={String(selectedDay)}
                  onChange={(value) => setSelectedDay(Number(value))}
                />

                {selectedClasses.length === 0 ? (
                  <div className='rounded-card border border-dashed border-border-control bg-surface px-4 py-10 text-center'>
                    <p className='text-body-sm text-text-secondary'>
                      No classes on {DAY_FULL[selectedDay]}.
                    </p>
                  </div>
                ) : (
                  <ul className='space-y-3'>
                    {selectedClasses.map((schedule) => (
                      <li
                        key={`${schedule.id}-${schedule.start_time}`}
                        className='rounded-card border border-border bg-surface p-4'
                      >
                        <div className='flex items-start justify-between gap-3'>
                          <div className='min-w-0'>
                            <p className='text-body font-semibold text-text-primary'>
                              {schedule.subject_label}
                            </p>
                            <p className='mt-0.5 text-body-sm text-text-secondary'>
                              {schedule.section_name}
                            </p>
                          </div>
                          <Badge tone='green'>
                            {classTime(schedule)}
                          </Badge>
                        </div>
                        <dl className='mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-body-sm'>
                          <div>
                            <dt className='text-caption text-text-tertiary'>
                              Professor
                            </dt>
                            <dd className='text-text-primary'>
                              {schedule.prof_name}
                            </dd>
                          </div>
                          <div>
                            <dt className='text-caption text-text-tertiary'>
                              Room
                            </dt>
                            <dd className='text-text-primary'>
                              {schedule.room_name ?? 'TBA'}
                            </dd>
                          </div>
                        </dl>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className='hidden md:block'>
                <div className='overflow-x-auto rounded-card border border-border'>
                  <div className='min-w-[860px]'>
                    <div className='sticky top-0 z-10 grid grid-cols-[64px_repeat(5,minmax(150px,1fr))] border-b border-border bg-surface-secondary'>
                      <div className='px-2 py-2.5 text-right text-overline uppercase text-text-tertiary'>
                        Time
                      </div>
                      {DAY_SHORT.map((day) => (
                        <div
                          key={day}
                          className='border-l border-border px-3 py-2.5 text-overline uppercase text-text-secondary'
                        >
                          {day}
                        </div>
                      ))}
                    </div>

                    {TIME_SLOTS.map((slot) => (
                      <div
                        key={slot.label}
                        className='grid grid-cols-[64px_repeat(5,minmax(150px,1fr))] border-b border-border-light last:border-b-0'
                      >
                        <div className='px-2 py-3 text-right text-caption font-medium tabular-nums text-text-tertiary'>
                          {slot.label}
                        </div>

                        {DAY_SHORT.map((_, dayIndex) => {
                          const classes = classIndex.get(
                            `${dayIndex}-${slot.hour}`
                          );

                          return (
                            <div
                              key={dayIndex}
                              className='min-h-14 space-y-1 border-l border-border-light p-1.5'
                            >
                              {classes?.map((schedule) => (
                                <div
                                  key={`${schedule.id}-${slot.hour}`}
                                  title={`${schedule.subject_label}\n${schedule.section_name}\n${schedule.prof_name}\n${schedule.room_name ?? 'TBA'}\n${schedule.day_display}, ${classTime(schedule)}`}
                                  className='rounded-md border border-apple-green-200 bg-apple-green-50 px-2 py-1.5 text-caption font-medium leading-snug text-apple-green-800'
                                >
                                  <p className='truncate'>
                                    {schedule.subject_label}
                                  </p>
                                  <p className='truncate text-caption font-normal text-apple-green-700'>
                                    {schedule.room_name ?? 'TBA'}
                                  </p>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}
