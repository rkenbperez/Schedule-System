// pages/registrar/components/ScheduleModal.tsx
import { useId, useState, type ReactNode } from 'react';
import { Building2, CalendarDays, Clock3, MapPin } from 'lucide-react';
import { Button, Modal } from '../../../components/ui';
import { cn } from '../../../lib/cn';
import type {
  CourseComponent,
  CourseAssignmentDetail,
  Room,
} from '../../../types/Types';

export interface ScheduleModalProps {
  teacherId: number;
  component: CourseComponent;
  assignment: CourseAssignmentDetail;
  rooms: Room[];
  onSchedule: (payload: {
    course_assignment: number;
    course_component: number;
    room: number;
    start_time: string;
    day_of_week: number;
  }) => void;
  onClose: () => void;
}

const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const TIME_SLOTS = [
  { id: 1, label: '7:00 AM - 10:00 AM', start_time: '07:00' },
  { id: 2, label: '10:00 AM - 1:00 PM', start_time: '10:00' },
  { id: 3, label: '1:00 PM - 3:00 PM', start_time: '13:00' },
  { id: 4, label: '3:00 PM - 6:00 PM', start_time: '15:00' },
];

type OptionProps = {
  name: string;
  checked: boolean;
  onChange: () => void;
  children: ReactNode;
  className?: string;
};

function Option({ name, checked, onChange, children, className }: OptionProps) {
  return (
    <label className={cn('relative block cursor-pointer', className)}>
      <input
        type='radio'
        name={name}
        checked={checked}
        onChange={onChange}
        className='peer sr-only'
      />
      <span className='flex min-h-11 items-center justify-center gap-2 rounded-control border border-border-control bg-surface px-3.5 py-2 text-body text-text-secondary transition-colors peer-checked:border-apple-green-600 peer-checked:bg-apple-green-50 peer-checked:font-medium peer-checked:text-apple-green-800 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-apple-green-600'>
        {children}
      </span>
    </label>
  );
}

export default function ScheduleModal({
  teacherId,
  component,
  assignment,
  rooms,
  onSchedule,
  onClose,
}: ScheduleModalProps) {
  const formId = useId();
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{
    id: number;
    label: string;
    start_time: string;
  } | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  const canSubmit =
    selectedDay !== null && selectedTimeSlot !== null && selectedRoom !== null;

  const handleSubmit = () => {
    if (!canSubmit || selectedDay === null || !selectedTimeSlot || !selectedRoom) {
      return;
    }

    onSchedule({
      course_assignment: assignment.id,
      course_component: component.id,
      room: selectedRoom.id,
      start_time: selectedTimeSlot.start_time,
      day_of_week: selectedDay,
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title='Schedule component'
      description={`${assignment.subject_label} · Section ${assignment.section_name} · Teacher #${teacherId}`}
      size='md'
      footer={
        <>
          <Button variant='secondary' onClick={onClose}>
            Cancel
          </Button>
          <Button type='submit' form={formId} disabled={!canSubmit}>
            Schedule
          </Button>
        </>
      }
    >
      <form
        id={formId}
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit();
        }}
        className='space-y-5'
      >
        <div className='flex items-start gap-3 rounded-control border border-border bg-surface-secondary p-4'>
          <span className='grid h-10 w-10 shrink-0 place-items-center rounded-control bg-apple-green-50 text-apple-green-700'>
            {component.label === 'laboratory' ? (
              <MapPin size={18} aria-hidden='true' />
            ) : (
              <CalendarDays size={18} aria-hidden='true' />
            )}
          </span>
          <div className='min-w-0'>
            <p className='text-body font-medium capitalize text-text-primary'>
              {component.label}
            </p>
            <p className='mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm text-text-secondary'>
              <span>{component.duration} hours</span>
              <span aria-hidden='true'>·</span>
              <span>{component.room_type.name} room</span>
            </p>
          </div>
        </div>

        <fieldset>
          <legend className='mb-2 text-body-sm font-medium text-text-secondary'>
            Day
          </legend>
          <div className='grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5'>
            {DAY_LABELS.map((day, index) => (
              <Option
                key={day}
                name={`${formId}-day`}
                checked={selectedDay === index}
                onChange={() => setSelectedDay(index)}
              >
                {day}
              </Option>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className='mb-2 text-body-sm font-medium text-text-secondary'>
            Time slot
          </legend>
          <div className='grid gap-2 sm:grid-cols-2'>
            {TIME_SLOTS.map((slot) => (
              <Option
                key={slot.id}
                name={`${formId}-time`}
                checked={selectedTimeSlot?.id === slot.id}
                onChange={() => setSelectedTimeSlot(slot)}
              >
                <Clock3 size={15} aria-hidden='true' />
                {slot.label}
              </Option>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className='mb-2 text-body-sm font-medium text-text-secondary'>
            Room
          </legend>
          <div className='grid gap-2 sm:grid-cols-2'>
            {rooms.map((room) => (
              <Option
                key={room.id}
                name={`${formId}-room`}
                checked={selectedRoom?.id === room.id}
                onChange={() => setSelectedRoom(room)}
                className='text-left'
              >
                <Building2 size={15} aria-hidden='true' />
                <span className='flex min-w-0 flex-col'>
                  <span className='truncate font-medium'>{room.name}</span>
                  <span className='truncate text-caption text-text-tertiary'>
                    {room.capacity} seats
                    {room.building ? ` · ${room.building}` : ''}
                  </span>
                </span>
              </Option>
            ))}
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
