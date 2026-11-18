import { useParams } from 'react-router-dom';
import { ArrowLeft, Link } from 'lucide-react';
import { useRooms } from '../../hooks/Schedule.hooks';
import { useRoomSchedule } from '../../hooks/Schedule.hooks';
import type { Schedule } from '../../types/Types';

// Mock example data for testing without backend.
const exampleSchedules: Schedule[] = [
  {
    id: 1,
    run: 1,
    assignment: 1,
    assignment_label: 'COSC 7 - 3-A',
    prof_id: 1,
    prof_name: 'Juan Dela Cruz',
    section_id: 1,
    section_name: '3-A',
    subject_label: 'COSC 7 - Data Structures and Algorithms',
    room: 101,
    room_name: 'Room 101',
    day: 0,
    day_display: 'Monday',
    start_time: '07:00',
    end_time: '09:00',
    duration_slots: 2,
    mode: 'sync',
    mode_display: 'Synchronous',
    term: 1,
  },
  {
    id: 2,
    run: 1,
    assignment: 2,
    assignment_label: 'COSC 7 - Lab 202',
    prof_id: 1,
    prof_name: 'Juan Dela Cruz',
    section_id: 1,
    section_name: '3-A',
    subject_label: 'COSC 7 - Data Structures and Algorithms',
    room: 103,
    room_name: 'Lab 202',
    day: 2,
    day_display: 'Wednesday',
    start_time: '13:00',
    end_time: '17:00',
    duration_slots: 4,
    mode: 'lab',
    mode_display: 'Laboratory',
    term: 1,
  },
];

export default function TeacherRoomDetailPage() {
  const { roomId, name: teacherName } = useParams<{ roomId: string; name: string }>();
  const id = roomId ? Number(roomId) : undefined;
  const teacher = teacherName ?? 'juan';

  const { data: rooms } = useRooms({ enabled: true });
  const room = rooms?.find((r) => r.id === id);

  const { data: schedules, isLoading } = useRoomSchedule({
    roomId: id,
    enabled: !!id,
  });

  const resolvedSchedules: Schedule[] = schedules ?? exampleSchedules.filter(
    (s) => s.room === id
  );

  return (
    <section className='w-full'>
      <div className='mb-5 flex items-center gap-2'>
        <Link
          to={`/teacher/${teacher}/rooms`}
          className='inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary'
        >
          <ArrowLeft size={15} /> Back to rooms
        </Link>
        <h1 className='text-lg font-medium text-text-primary ml-auto'>
          Room {room?.name}
        </h1>
      </div>

      {!id ? (
        <p className='text-sm text-text-secondary'>No room selected.</p>
      ) : !room ? (
        <p className='text-sm text-text-secondary'>Room not found.</p>
      ) : (
        <>
          <div className='mb-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4'>
            <div className='rounded-lg border border-border bg-surface p-4'>
              <p className='text-xs font-medium text-text-tertiary'>Room</p>
              <p className='text-base font-medium text-text-primary'>{room.name}</p>
            </div>
            <div className='rounded-lg border border-border bg-surface p-4'>
              <p className='text-xs font-medium text-text-tertiary'>Capacity</p>
              <p className='text-base font-medium text-text-primary'>{room.capacity}</p>
            </div>
            <div className='rounded-lg border border-border bg-surface p-4'>
              <p className='text-xs font-medium text-text-tertiary'>Building</p>
              <p className='text-base font-medium text-text-primary'>{room.building}</p>
            </div>
            <div className='rounded-lg border border-border bg-surface p-4'>
              <p className='text-xs font-medium text-text-tertiary'>Department</p>
              <p className='text-base font-medium text-text-primary'>
                {room.department_name || '—'}
              </p>
            </div>
          </div>

          <div className='overflow-hidden rounded-card border border-border bg-surface'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='border-b border-border text-left text-text-secondary'>
                  <th scope='col' className='px-4 py-2.5 font-normal'>
                    Day
                  </th>
                  <th scope='col' className='px-4 py-2.5 font-normal'>
                    Time
                  </th>
                  <th scope='col' className='px-4 py-2.5 font-normal'>
                    Course
                  </th>
                  <th scope='col' className='px-4 py-2.5 font-normal'>
                    Section
                  </th>
                  <th scope='col' className='px-4 py-2.5 font-normal'>
                    Professor
                  </th>
                  <th scope='col' className='px-4 py-2.5 font-normal'>
                    Type
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className='px-4 py-8 text-center text-sm text-text-secondary'>
                      Loading schedule…
                    </td>
                  </tr>
                ) : resolvedSchedules.length === 0 ? (
                  <tr>
                    <td colSpan={6} className='px-4 py-8 text-center text-sm text-text-secondary'>
                      No scheduled classes for this room.
                    </td>
                  </tr>
                ) : (
                  resolvedSchedules.map((s) => (
                    <tr key={s.id} className='border-t border-border'>
                      <td className='px-4 py-3 text-text-secondary'>
                        {s.day_display}
                      </td>
                      <td className='px-4 py-3 text-text-secondary'>
                        {s.start_time} — {s.end_time ?? '—'}
                      </td>
                      <td className='px-4 py-3 text-text-primary'>
                        {s.subject_label}
                      </td>
                      <td className='px-4 py-3 text-text-secondary'>
                        {s.section_name}
                      </td>
                      <td className='px-4 py-3 text-text-secondary'>
                        {s.prof_name}
                      </td>
                      <td className='px-4 py-3 text-text-secondary'>
                        {s.mode_display}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
