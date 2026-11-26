import { Trash2, Check } from 'lucide-react';
import {
  useProfessorAvailability,
  useCreateProfessorAvailability,
  useUpdateProfessorAvailability,
  useDeleteProfessorAvailability,
} from '../../../hooks/Professor.hooks';
import type { AvailabilityWindow } from '../../../types/Types';
import { Card, Tooltip } from '../../../components/ui';

const DAYS = [
  { index: 0, name: 'Monday', short: 'Mon' },
  { index: 1, name: 'Tuesday', short: 'Tue' },
  { index: 2, name: 'Wednesday', short: 'Wed' },
  { index: 3, name: 'Thursday', short: 'Thu' },
  { index: 4, name: 'Friday', short: 'Fri' },
];

const START_HOUR = 7;
const END_HOUR = 21;

function formatHour(hour: number) {
  const h = hour % 12 || 12;
  const ampm = hour < 12 ? 'AM' : 'PM';
  return `${h}:00 ${ampm}`;
}

function timeToSlot(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours - START_HOUR) * 60 + minutes;
}

function slotToTime(slot: number): string {
  const hours = Math.floor(slot / 60) + START_HOUR;
  const minutes = slot % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

interface TimeBlockProps {
  day: number;
  hour: number;
  availability: AvailabilityWindow[];
  onToggle: (day: number, start: string, end: string, isPreferred: boolean) => void;
  onDelete: (id: number) => void;
  readOnly?: boolean;
}

function TimeBlock({ day, hour, availability, onToggle, onDelete, readOnly }: TimeBlockProps) {
  const slotStart = hour * 60;
  const slotEnd = slotStart + 60;

  const matching = availability.find(
    (a) =>
      a.day === day &&
      timeToSlot(a.start_time) <= slotStart &&
      timeToSlot(a.end_time) >= slotEnd
  );

  if (!matching) {
    return (
      <Tooltip content="Click to add availability">
        <div
          className='h-10 border border-dashed border-border rounded-md bg-surface transition-colors hover:bg-surface-secondary hover:border-apple-green-300 cursor-pointer'
          onClick={() => !readOnly && onToggle(day, slotToTime(slotStart), slotToTime(slotEnd), true)}
        />
      </Tooltip>
    );
  }

  const isPreferred = matching.is_preferred;

  return (
    <Tooltip content={isPreferred ? 'Preferred time - click to make available' : 'Available time - click to make preferred'}>
      <div
        className={`h-10 rounded-md border-2 transition-all cursor-pointer ${
          isPreferred
            ? 'bg-apple-green-100 border-apple-green-400 hover:bg-apple-green-200'
            : 'bg-blue-50 border-blue-300 hover:bg-blue-100'
        }`}
        onClick={() =>
          !readOnly && onToggle(day, matching.start_time, matching.end_time, !isPreferred)
        }
      >
        <div className='flex items-center justify-between p-1 h-full'>
          {isPreferred && (
            <Check className='text-apple-green-600 text-xs shrink-0' aria-hidden='true' />
          )}
          {!readOnly && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(matching.id);
              }}
              className='text-red-500 hover:text-red-700 text-xs p-0.5 rounded'
              aria-label='Delete availability'
            >
              <Trash2 size={12} aria-hidden='true' />
            </button>
          )}
        </div>
      </div>
    </Tooltip>
  );
}

export default function ProfessorAvailabilityGrid({
  readOnly = false,
  onChange,
}: {
  readOnly?: boolean;
  onChange?: () => void;
}) {
  const { data: availability, isLoading } = useProfessorAvailability({ enabled: true });
  const createMutation = useCreateProfessorAvailability();
  const updateMutation = useUpdateProfessorAvailability();
  const deleteMutation = useDeleteProfessorAvailability();

  const handleToggle = (
    day: number,
    start: string,
    end: string,
    isPreferred: boolean
  ) => {
    const existing = availability?.find(
      (a) => a.day === day && a.start_time === start && a.end_time === end
    );

    if (existing) {
      updateMutation.mutate(
        { id: existing.id, payload: { is_preferred: isPreferred } },
        { onSuccess: () => onChange?.() }
      );
    } else {
      createMutation.mutate(
        { day, start_time: start, end_time: end, is_preferred: isPreferred },
        { onSuccess: () => onChange?.() }
      );
    }
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id, { onSuccess: () => onChange?.() });
  };

  if (isLoading) {
    return (
      <Card className='space-y-3'>
        <div className='grid grid-cols-15 gap-1'>
          <div className='col-span-3 font-medium text-text-secondary'>Time</div>
          {DAYS.map((d) => (
            <div key={d.index} className='text-center font-medium text-text-secondary'>
              {d.short}
            </div>
          ))}
        </div>
        {Array.from({ length: END_HOUR - START_HOUR }).map((_, i) => (
          <div key={i} className='grid grid-cols-15 gap-1'>
            <div className='col-span-3 text-right pr-2 text-caption text-text-tertiary'>
              {formatHour(START_HOUR + i)}
            </div>
            {DAYS.map((d) => (
              <div
                key={d.index}
                className='h-10 border border-dashed border-border rounded-md bg-surface animate-pulse'
              />
            ))}
          </div>
        ))}
      </Card>
    );
  }

  return (
    <Card className='space-y-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <h3 className='text-h3 text-text-primary'>Weekly Availability</h3>
        <div className='flex items-center gap-4 text-caption'>
          <span className='flex items-center gap-1'>
            <span className='w-3 h-3 rounded bg-apple-green-200 border border-apple-green-400' />
            Preferred
          </span>
          <span className='flex items-center gap-1'>
            <span className='w-3 h-3 rounded bg-blue-50 border border-blue-300' />
            Available
          </span>
          <span className='flex items-center gap-1'>
            <span className='w-3 h-3 rounded border border-dashed border-border bg-surface' />
            Unavailable
          </span>
        </div>
      </div>

      <div className='overflow-x-auto'>
        <div className='grid grid-cols-15 gap-1 min-w-[900px]'>
          <div className='col-span-3 font-medium text-text-secondary' />
          {DAYS.map((d) => (
            <div key={d.index} className='text-center font-medium text-text-secondary py-2'>
              {d.name}
            </div>
          ))}

          {Array.from({ length: END_HOUR - START_HOUR }).map((_, i) => (
            <div key={i} className='contents'>
              <div className='col-span-3 text-right pr-2 text-caption text-text-tertiary pt-2'>
                {formatHour(START_HOUR + i)}
              </div>
              {DAYS.map((d) => (
                <TimeBlock
                  key={d.index}
                  day={d.index}
                  hour={i}
                  availability={availability ?? []}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                  readOnly={readOnly}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {(createMutation.isPending || updateMutation.isPending || deleteMutation.isPending) && (
        <div className='text-caption text-text-tertiary text-center py-2'>
          Saving...
        </div>
      )}
    </Card>
  );
}