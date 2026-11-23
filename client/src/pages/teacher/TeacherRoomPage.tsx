import { useMemo, useState } from 'react';
import { Building2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { useRooms } from '../../hooks/Schedule.hooks';
import RoomCard from './components/RoomCard';
import {
  EmptyState,
  LoadingState,
  PageHeader,
  TextField,
} from '../../components/ui';
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
  const { name } = useParams<{ name: string }>();
  const teacher = name ?? 'juan';
  const { data: rooms, isLoading } = useRooms({ enabled: true });
  const [filter, setFilter] = useState('');

  // Mock data used when backend is not available.
  const mockRooms: Room[] = exampleRooms;
  const resolvedRooms: Room[] = rooms ?? mockRooms;

  const filteredRooms = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return resolvedRooms;

    return resolvedRooms.filter(
      (room) =>
        room.name.toLowerCase().includes(query) ||
        room.building.toLowerCase().includes(query) ||
        room.department_name?.toLowerCase().includes(query)
    );
  }, [resolvedRooms, filter]);

  return (
    <section className='w-full space-y-6'>
      <PageHeader
        eyebrow='Teacher'
        title='Rooms'
        description='Browse rooms and view their weekly schedules.'
        backTo={`/teacher/${teacher}`}
        backLabel='Back to dashboard'
      />

      <div className='max-w-md'>
        <TextField
          id='room-search'
          label='Search rooms'
          type='search'
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder='Search room, building, or department…'
          hint='Results update as you type.'
        />
      </div>

      {isLoading ? (
        <LoadingState label='Loading rooms…' />
      ) : filteredRooms.length === 0 ? (
        <EmptyState
          icon={Building2}
          title='No rooms found'
          description={
            filter
              ? 'Try a different room name, building, or department.'
              : 'Rooms will appear here once they are added.'
          }
        />
      ) : (
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
          {filteredRooms.map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
        </div>
      )}
    </section>
  );
}
