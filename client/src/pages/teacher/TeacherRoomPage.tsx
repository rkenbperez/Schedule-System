// pages/teacher/TeacherRoomPage.tsx
import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useRooms, useRoomSchedule } from '../../hooks/Schedule.hooks';
import RoomCard from './components/RoomCard';
import type { Room } from '../../types/Types';
import type { Schedule } from '../../types/Types';
import { SlideOverDrawer } from '../../components/shared/SlideOverDrawer';
import { EmptyState } from '../../components/shared/EmptyState';

export default function TeacherRoomPage() {
  const { data: rooms, isLoading } = useRooms({ enabled: true });
  const [filter, setFilter] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  const filteredRooms = useMemo(() => {
    const query = filter.trim().toLowerCase();
    const list = rooms ?? [];
    if (!query) return list;
    return list.filter(
      (r) =>
        r.name.toLowerCase().includes(query) ||
        r.building.toLowerCase().includes(query) ||
        r.department_name?.toLowerCase().includes(query)
    );
  }, [rooms, filter]);

  return (
    <section className='w-full'>
      <div className='mb-5 flex gap-3'>
        <div className='relative flex-1 max-w-md'>
          <Search
            size={16}
            className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary'
          />
          <input
            type='search'
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder='Search room, building, or department…'
            className='h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-text-primary placeholder-text-tertiary outline-none transition focus:border-apple-green-400 focus:ring-2 focus:ring-apple-green-100'
          />
        </div>
      </div>

      {isLoading ? (
        <p className='text-sm text-text-secondary'>Loading rooms…</p>
      ) : filteredRooms.length === 0 ? (
        <EmptyState
          icon={
            <svg className='w-8 h-8 text-current' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.5' d='M3 10h18M3 14h18m-9-4v8m-4 4h18m-11 0v8m0 0h18m-18 0h18' />
            </svg>
          }
          title='No rooms found.'
        />
      ) : (
        <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4'>
          {filteredRooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              onClick={() => setSelectedRoom(room)}
            />
          ))}
        </div>
      )}

      {selectedRoom && (
        <RoomDetailPanel room={selectedRoom} onClose={() => setSelectedRoom(null)} />
      )}
    </section>
  );
}

function RoomDetailPanel({
  room,
  onClose,
}: {
  room: Room;
  onClose: () => void;
}) {
  const { data: schedules, isLoading } = useRoomSchedule({
    roomId: room.id,
    enabled: true,
  });

  const resolvedSchedules: Schedule[] = schedules ?? [];

  return (
    <SlideOverDrawer isOpen={true} onClose={onClose}>
      <div className='flex items-start justify-between gap-3 border-b border-border px-6 py-4 shrink-0'>
        <div className='flex items-center gap-2'>
          <h2 className='text-sm font-medium text-text-primary'>{room.name}</h2>
          <span className='shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium bg-apple-green-50 text-apple-green-700'>
            Cap {room.capacity}
          </span>
        </div>
        <button
          type='button'
          onClick={onClose}
          className='shrink-0 rounded-full p-1.5 text-text-tertiary hover:bg-surface-secondary hover:text-text-primary transition'
        >
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div className='flex-1 overflow-y-auto px-6 py-4'>
        {/* Compact metadata bar */}
        <div className='mb-6 flex flex-col gap-2'>
          <div className='flex items-center gap-2'>
            <span className='text-xs font-medium text-text-tertiary uppercase tracking-wide'>
              Building
            </span>
            <span className='text-sm font-medium text-text-primary'>
              {room.building ?? '—'}
            </span>
          </div>
          <div className='flex items-center gap-2'>
            <span className='text-xs font-medium text-text-tertiary uppercase tracking-wide'>
              Department
            </span>
            <span className='text-sm font-medium text-text-primary'>
              {room.department_name ?? '—'}
            </span>
          </div>
        </div>

        {/* Scheduled classes section */}
        <div className='mb-6'>
          <h3 className='text-xs font-medium text-text-tertiary uppercase tracking-wide mb-3'>
            Scheduled Classes
          </h3>
          {isLoading ? (
            <div className='rounded-lg border border-border bg-surface-secondary p-8 flex flex-col items-center justify-center text-center'>
              <p className='text-sm text-text-secondary'>Loading schedule…</p>
            </div>
          ) : resolvedSchedules.length === 0 ? (
            <div className='rounded-lg border border-border bg-surface-secondary p-8 flex flex-col items-center justify-center text-center'>
              <span className='mb-3 opacity-50'>
                <svg className='w-8 h-8 text-current' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.5' d='M3 10h18M3 14h18m-9-4v8m-4 4h18m-11 0v8m0 0h18m-18 0h18' />
                </svg>
              </span>
              <p className='text-xs text-text-tertiary'>No scheduled classes for this room.</p>
            </div>
          ) : (
            <div className='overflow-x-auto'>
              <table className='w-full text-xs border-collapse'>
                <thead>
                  <tr className='sticky top-0 z-10 bg-surface border-b border-border'>
                    <th className='px-3 py-2 text-left text-text-secondary'>Day</th>
                    <th className='px-3 py-2 text-left text-text-secondary'>Time</th>
                    <th className='px-3 py-2 text-left text-text-secondary'>Course</th>
                    <th className='px-3 py-2 text-left text-text-secondary'>Section</th>
                    <th className='px-3 py-2 text-left text-text-secondary'>Professor</th>
                    <th className='px-3 py-2 text-left text-text-secondary'>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {resolvedSchedules.map((s) => (
                    <tr key={s.id} className='border-b border-border-light'>
                      <td className='px-3 py-2 text-text-secondary'>{s.day_display}</td>
                      <td className='px-3 py-2 text-text-secondary'>
                        {s.start_time} — {s.end_time ?? '—'}
                      </td>
                      <td className='px-3 py-2 text-text-primary truncate max-w-xs'>
                        {s.subject_label}
                      </td>
                      <td className='px-3 py-2 text-text-secondary'>{s.section_name}</td>
                      <td className='px-3 py-2 text-text-secondary'>{s.prof_name}</td>
                      <td className='px-3 py-2 text-text-secondary'>{s.mode_display}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </SlideOverDrawer>
  );
}
