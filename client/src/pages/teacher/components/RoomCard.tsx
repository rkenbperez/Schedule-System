// pages/teacher/TeacherRoomPage.tsx components/RoomCard.tsx
import type { Room } from '../../../types/Types';

export interface RoomCardProps {
  room: Room;
  onClick: (roomId: number) => void;
}

export default function RoomCard({ room, onClick }: RoomCardProps) {
  return (
    <div
      onClick={() => onClick(room.id)}
      className='cursor-pointer rounded-xl border border-border bg-surface p-4 transition hover:border-apple-green-300 hover:shadow-sm hover:shadow-apple-green-50'
    >
      <div className='flex items-start justify-between mb-2'>
        <h3 className='text-sm font-semibold text-text-primary truncate'>
          {room.name}
        </h3>
        <span className='shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[9px] font-medium bg-apple-green-50 text-apple-green-700'>
          Cap {room.capacity}
        </span>
      </div>
      <div className='flex items-center gap-2 text-xs text-text-tertiary mb-2'>
        <span>{room.building}</span>
        {room.department_name && (
          <span className='text-[10px] text-text-tertiary'>
            {room.department_name}
          </span>
        )}
      </div>
    </div>
  );
}
