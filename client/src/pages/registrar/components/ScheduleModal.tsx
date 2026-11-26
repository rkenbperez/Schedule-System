// pages/registrar/components/ScheduleModal.tsx
import { useId, useState, type ReactNode } from 'react';
import { Building2, CalendarDays, Clock3, MapPin } from 'lucide-react';
import { Alert, Button, Modal } from '../../../components/ui';
import { cn } from '../../../lib/cn';
import { roomMatchesMode } from '../../../utils/roomType';
import type {
  CourseAssignmentDetail,
  CourseAssignmentMeeting,
  Room,
  ScheduleCreatePayload,
} from '../../../types/Types';

export interface ScheduleModalProps {
  teacherName: string;
  meeting: CourseAssignmentMeeting;
  assignment: CourseAssignmentDetail;
  rooms: Room[];
  activeRunId: number | null;
  isSubmitting?: boolean;
  onSchedule: (payload: ScheduleCreatePayload) => void | Promise<void>;
  onClose: () => void;
}

const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const TIME_SLOT_STARTS = ['07:00', '10:00', '13:00', '15:00'];

function formatSlotLabel(startTime: string, durationSlots: number): string {
  const [rawHours, rawMinutes = '0'] = startTime.split(':');
  const startMinutes = Number(rawHours) * 60 + Number(rawMinutes);
  const endMinutes = startMinutes + durationSlots * 60;

  const format = (minutes: number) => {
    const hours = Math.floor(minutes / 60) % 24;
    const mins = minutes % 60;
    const period = hours < 12 ? 'AM' : 'PM';
    const display = hours % 12 === 0 ? 12 : hours % 12;
    return `${display}:${String(mins).padStart(2, '0')} ${period}`;
  };

  return `${format(startMinutes)} - ${format(endMinutes)}`;
}

type OptionProps = {
  name: string;
  checked: boolean;
  onChange: () => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
};

function Option({ name, checked, onChange, children, className, disabled }: OptionProps) {
  return (
    <label
      className={cn(
        'relative block',
        disabled ? 'cursor-not-allowed' : 'cursor-pointer',
        className
      )}
    >
      <input
        type='radio'
        name={name}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className='peer sr-only'
      />
      <span className='flex min-h-11 items-center justify-center gap-2 rounded-control border border-border-control bg-surface px-3.5 py-2 text-body text-text-secondary transition-colors peer-checked:border-apple-green-600 peer-checked:bg-apple-green-50 peer-checked:font-medium peer-checked:text-apple-green-800 peer-disabled:opacity-50 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-apple-green-600'>
        {children}
      </span>
    </label>
  );
}

export default function ScheduleModal({
  teacherName,
  meeting,
  assignment,
  rooms,
  activeRunId,
  isSubmitting = false,
  onSchedule,
  onClose,
}: ScheduleModalProps) {
  const formId = useId();
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{
    id: number;
    start_time: string;
    label: string;
  } | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  const normalizedMode = (meeting.mode || '').toLowerCase();
  const isLabMode = normalizedMode === 'lab' || normalizedMode === 'laboratory';
  const isAsyncMode =
    normalizedMode === 'async' || normalizedMode === 'asynchronous';
  const availableRooms = rooms.filter((room) =>
    roomMatchesMode(room.name, meeting.mode)
  );
  const isRoomTooSmall = (room: Room) =>
    room.capacity < assignment.section_headcount;
  const timeSlots = TIME_SLOT_STARTS.map((startTime, index) => ({
    id: index + 1,
    start_time: startTime,
    label: formatSlotLabel(startTime, meeting.duration_slots),
  }));

  const canSubmit =
    activeRunId !== null &&
    !isSubmitting &&
    selectedDay !== null &&
    selectedTimeSlot !== null &&
    selectedRoom !== null;

  const handleSubmit = () => {
    if (!canSubmit || selectedDay === null || !selectedTimeSlot || !selectedRoom) {
      return;
    }

    void onSchedule({
      course_assignment: assignment.id,
      room: selectedRoom.id,
      start_time: selectedTimeSlot.start_time,
      day_of_week: selectedDay,
      duration_slots: meeting.duration_slots,
      mode: meeting.mode,
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title='Schedule meeting'
      description={`${assignment.subject_label} · Section ${assignment.section_name} · ${teacherName}`}
      size='md'
      footer={
        <>
          <Button variant='secondary' onClick={onClose}>
            Cancel
          </Button>
          <Button type='submit' form={formId} disabled={!canSubmit} loading={isSubmitting}>
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
            {meeting.mode === 'lab' ? (
              <MapPin size={18} aria-hidden='true' />
            ) : (
              <CalendarDays size={18} aria-hidden='true' />
            )}
          </span>
          <div className='min-w-0'>
            <p className='text-body font-medium capitalize text-text-primary'>
              {meeting.mode_display || meeting.mode}
            </p>
            <p className='mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm text-text-secondary'>
              <span>{meeting.duration_slots} hour slot(s)</span>
              <span aria-hidden='true'>·</span>
              <span>
                {isLabMode
                  ? 'Laboratory room required'
                  : isAsyncMode
                    ? 'Any room (unrestricted)'
                    : 'Lecture or general room required'}
              </span>
            </p>
          </div>
        </div>

        {activeRunId === null && (
          <Alert tone='warning' title='No schedule run available'>
            Generate a schedule run before assigning a class to a room.
          </Alert>
        )}

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
            {timeSlots.map((slot) => (
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
          {availableRooms.length === 0 ? (
            <p className='text-body-sm text-text-secondary'>
              No rooms match this meeting type. Add a suitable room in master
              data first.
            </p>
          ) : (
            <div className='grid gap-2 sm:grid-cols-2'>
              {availableRooms.map((room) => {
                const tooSmall = isRoomTooSmall(room);
                return (
                  <Option
                    key={room.id}
                    name={`${formId}-room`}
                    checked={selectedRoom?.id === room.id}
                    onChange={() => setSelectedRoom(room)}
                    className='text-left'
                    disabled={tooSmall}
                  >
                    <Building2 size={15} aria-hidden='true' />
                    <span className='flex min-w-0 flex-col'>
                      <span className='truncate font-medium'>{room.name}</span>
                      <span className='truncate text-caption text-text-tertiary'>
                        {room.capacity} seats
                        {tooSmall
                          ? ` · section needs ${assignment.section_headcount}`
                          : room.building
                            ? ` · ${room.building}`
                            : ''}
                      </span>
                    </span>
                  </Option>
                );
              })}
            </div>
          )}
        </fieldset>
      </form>
    </Modal>
  );
}
