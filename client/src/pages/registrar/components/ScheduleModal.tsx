// pages/registrar/components/ScheduleModal.tsx
import { useState } from 'react';
import { X, Calendar, MapPin, Building2 } from 'lucide-react';
import type { CourseComponent, CourseAssignmentDetail, Room } from '../../../types/Types';

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

export default function ScheduleModal({
  teacherId,
  component,
  assignment,
  rooms,
  onSchedule,
  onClose,
}: ScheduleModalProps) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{
    id: number;
    label: string;
    start_time: string;
  } | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  const handleSubmit = () => {
    if (!selectedDay || !selectedTimeSlot || !selectedRoom) return;
    onSchedule({
      course_assignment: assignment.id,
      course_component: component.id,
      room: selectedRoom.id,
      start_time: selectedTimeSlot.start_time,
      day_of_week: selectedDay,
    });
  };

  return (
    <div
      role='dialog'
      aria-modal='true'
      aria-label='Schedule Component'
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4'
      onClick={onClose}
    >
      <div
        className='flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-xl'
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className='flex items-start justify-between gap-3 border-b border-border px-5 py-4'>
          <div>
            <h2 className='text-sm font-medium text-text-primary'>
              Schedule Component
            </h2>
            <p className='text-xs text-text-tertiary'>
              Teacher #{teacherId} · {assignment.subject_label} →{' '}
              {assignment.section_name}
            </p>
          </div>
          <button
            type='button'
            onClick={onClose}
            aria-label='Close'
            className='grid h-7 w-7 shrink-0 place-items-center rounded-md text-text-tertiary transition hover:bg-surface-secondary hover:text-text-primary'
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className='flex-1 overflow-y-auto px-5 py-4'>
          {/* Component Info */}
          <div className='mb-6 rounded-lg border border-border bg-surface-secondary p-4'>
            <div className='flex items-start gap-3'>
              <div className='flex shrink-0 items-center justify-center rounded-lg bg-apple-green-50 text-[11px] font-medium text-apple-green-700 p-2'>
                {component.label === 'laboratory' ? (
                  <MapPin size={14} />
                ) : (
                  <Calendar size={14} />
                )}
              </div>
              <div className='flex-1'>
                <h3 className='text-sm font-medium text-text-primary'>
                  {component.label}
                </h3>
                <p className='text-xs text-text-secondary'>
                  {component.duration} hours
                </p>
              </div>
            </div>
          </div>

          {/* Day Selection */}
          <div className='mb-4'>
            <label className='text-xs font-medium text-text-secondary block mb-2'>
              Day
            </label>
            <div className='flex flex-wrap gap-2'>
              {DAY_LABELS.map((day, index) => (
                <button
                  key={index}
                  type='button'
                  onClick={() => setSelectedDay(index)}
                  className={`px-3 py-2 rounded-md border text-sm transition ${
                    selectedDay === index
                      ? 'bg-apple-green-100 border-apple-green-500 text-apple-green-700 font-medium'
                      : 'bg-surface border-border text-text-secondary hover:border-apple-green-300'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          {/* Time Slot Selection */}
          <div className='mb-4'>
            <label className='text-xs font-medium text-text-secondary block mb-2'>
              Time Slot
            </label>
            <div className='flex flex-wrap gap-2'>
              {TIME_SLOTS.map((slot) => (
                <button
                  key={slot.id}
                  type='button'
                  onClick={() => setSelectedTimeSlot(slot)}
                  className={`px-3 py-2 rounded-md border text-sm transition ${
                    selectedTimeSlot?.id === slot.id
                      ? 'bg-apple-green-100 border-apple-green-500 text-apple-green-700 font-medium'
                      : 'bg-surface border-border text-text-secondary hover:border-apple-green-300'
                  }`}
                >
                  {slot.label}
                </button>
              ))}
            </div>
          </div>

          {/* Room Selection */}
          <div className='mb-6'>
            <label className='text-xs font-medium text-text-secondary block mb-2'>
              Room
            </label>
            <div className='flex flex-wrap gap-2'>
              {rooms.map((room) => (
                <button
                  key={room.id}
                  type='button'
                  onClick={() => setSelectedRoom(room)}
                  className={`px-3 py-2 rounded-md border text-sm transition ${
                    selectedRoom?.id === room.id
                      ? 'bg-apple-green-100 border-apple-green-500 text-apple-green-700 font-medium'
                      : 'bg-surface border-border text-text-secondary hover:border-apple-green-300'
                  }`}
                >
                  <Building2 size={12} className='mr-1.5' />
                  {room.name} ({room.capacity})
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className='border-t border-border px-5 py-4 flex justify-end gap-2'>
          <button
            type='button'
            onClick={onClose}
            className='rounded-md border border-border bg-surface px-4 py-2 text-[13px] font-medium text-text-primary transition hover:bg-surface-secondary'
          >
            Cancel
          </button>
          <button
            type='button'
            onClick={handleSubmit}
            disabled={
              !selectedDay ||
              !selectedTimeSlot ||
              !selectedRoom
            }
            className='rounded-md bg-apple-green-600 px-4 py-2 text-[13px] font-medium text-white shadow-sm transition hover:bg-apple-green-700 disabled:cursor-not-allowed disabled:opacity-60'
          >
            Schedule
          </button>
        </div>
      </div>
    </div>
  );
}
