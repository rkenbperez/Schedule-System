// pages/teacher/TeacherRoomPage.tsx
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, Search } from 'lucide-react';
import { useRooms } from '../../hooks/Schedule.hooks';
import RoomCard from './components/RoomCard';
import type { Room } from '../../types/Types';

// Mock example data for testing without backend.
const exampleRooms: Room[] = [
  {
    id: 101,
    name: 'Room 101',
    capacity: 40,
    department: 1,
    department_name: 'BSIT',
    building: 'Main Building',
  },
  {
    id: 102,
    name: 'Room 204',
    capacity: 35,
    department: 1,
    department_name: 'BSIT',
    building: 'Main Building',
  },
  {
    id: 103,
    name: 'Lab 202',
    capacity: 30,
    department: 1,
    department_name: 'BSIT',
    building: 'Engineering Building',
  },
  {
    id: 104,
    name: 'Room 305',
    capacity: 45,
    department: 1,
    department_name: 'BSIT',
    building: 'Main Building',
  },
  {
    id: 105,
    name: 'Lab 301',
    capacity: 25,
    department: 1,
    department_name: 'BSIT',
    building: 'Engineering Building',
  },
];

export default function TeacherRoomPage() {
  const navigate = useNavigate();
  const { data: rooms, isLoading } = useRooms({ enabled: true });
  const [filter, setFilter] = useState('');

  // Mock data used when backend is not available.
  const mockRooms: Room[] = exampleRooms;
  const resolvedRooms: Room[] = rooms ?? mockRooms;

  const filteredRooms = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return resolvedRooms;
    return resolvedRooms.filter(
      (r) =>
        r.name.toLowerCase().includes(query) ||
        r.building.toLowerCase().includes(query) ||
        r.department_name?.toLowerCase().includes(query)
    );
  }, [resolvedRooms, filter]);

  return (
    <section className='w-full'>
      <div className='mb-5 flex items-center gap-2'>
        <Link
          to='/teacher/juan'
          className='inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary'
        >
          <Building2 size={15} /> Back to dashboard
        </Link>
        <h1 className='text-lg font-medium text-text-primary ml-auto'>Rooms</h1>
      </div>

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
        <p className='text-sm text-text-secondary'>Loading rooms...</p>
      ) : filteredRooms.length === 0 ? (
        <p className='text-sm text-text-secondary'>No rooms found.</p>
      ) : (
        <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'>
          {filteredRooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              onClick={(roomId) => navigate(`/teacher/juan/rooms/${roomId}`)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
