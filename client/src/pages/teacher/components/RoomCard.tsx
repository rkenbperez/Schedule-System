import { ArrowRight, Building2, MapPin } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Badge } from '../../../components/ui';
import type { Room } from '../../../types/Types';

export interface RoomCardProps {
  room: Room;
}

export default function RoomCard({ room }: RoomCardProps) {
  const { name: teacherName } = useParams<{ name: string }>();
  const teacher = teacherName ?? 'juan';

  return (
    <Link
      to={`/teacher/${teacher}/rooms/${room.id}`}
      className='group flex h-full flex-col gap-3 rounded-card border border-border bg-surface p-4 transition hover:border-apple-green-300 hover:shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-apple-green-600 sm:p-5'
    >
      <div className='flex items-start justify-between gap-2'>
        <h3 className='min-w-0 truncate text-h3 text-text-primary'>
          {room.name}
        </h3>
        <Badge tone='green'>Capacity {room.capacity}</Badge>
      </div>

      <dl className='space-y-2 text-body-sm'>
        <div className='flex items-start gap-2'>
          <Building2
            size={15}
            className='mt-0.5 shrink-0 text-apple-green-600'
            aria-hidden='true'
          />
          <div className='min-w-0'>
            <dt className='sr-only'>Building</dt>
            <dd className='truncate text-text-secondary'>{room.building}</dd>
          </div>
        </div>
        <div className='flex items-start gap-2'>
          <MapPin
            size={15}
            className='mt-0.5 shrink-0 text-apple-green-600'
            aria-hidden='true'
          />
          <div className='min-w-0'>
            <dt className='sr-only'>Department</dt>
            <dd className='truncate text-text-secondary'>
              {room.department_name || 'No department'}
            </dd>
          </div>
        </div>
      </dl>

      <span className='mt-auto inline-flex min-h-11 items-center gap-1.5 text-body-sm font-medium text-apple-green-700'>
        View room schedule
        <ArrowRight
          size={15}
          className='transition-transform group-hover:translate-x-0.5'
          aria-hidden='true'
        />
      </span>
    </Link>
  );
}
