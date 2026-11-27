import type { ReactNode } from 'react';
import { Check, Trash2 } from 'lucide-react';
import {
  useProfessorAvailability,
  useCreateProfessorAvailability,
  useUpdateProfessorAvailability,
  useDeleteProfessorAvailability,
} from '../../../hooks/Professor.hooks';
import type { AvailabilityWindow } from '../../../types/Types';
import { Card, CardBody, CardHeader, CardTitle } from '../../../components/ui';

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

  const dayName = DAYS[day].name;
  const timeLabel = formatHour(hour);
  const isPreferred = matching?.is_preferred ?? false;

  const stateClass = !matching
    ? 'border border-dashed border-border bg-surface hover:border-apple-green-300 hover:bg-apple-green-50'
    : isPreferred
      ? 'border border-apple-green-600 bg-apple-green-500 text-white hover:bg-apple-green-600'
      : 'border border-apple-green-300 bg-apple-green-50 hover:bg-apple-green-100';

  const label = !matching
    ? `Add availability on ${dayName} at ${timeLabel}`
    : isPreferred
      ? `${dayName} at ${timeLabel} is preferred. Click to mark as available.`
      : `${dayName} at ${timeLabel} is available. Click to mark as preferred.`;

  return (
    <div className='group relative h-10'>
      <button
        type='button'
        disabled={readOnly}
        aria-pressed={Boolean(matching) && isPreferred}
        aria-label={label}
        title={label}
        onClick={() =>
          !readOnly &&
          onToggle(
            day,
            matching ? matching.start_time : slotToTime(slotStart),
            matching ? matching.end_time : slotToTime(slotEnd),
            matching ? !isPreferred : true
          )
        }
        className={`absolute inset-0 flex items-center justify-center rounded-control transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-apple-green-400 focus-visible:ring-offset-1 ${stateClass}`}
      >
        {isPreferred && <Check size={14} className='opacity-90' aria-hidden='true' />}
      </button>

      {matching && !readOnly && (
        <button
          type='button'
          onClick={() => onDelete(matching.id)}
          aria-label={`Remove availability on ${dayName} at ${timeLabel}`}
          title='Remove availability'
          className={`absolute right-0.5 top-1/2 z-10 -translate-y-1/2 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 ${
            isPreferred
              ? 'text-white/80 hover:bg-white/20 hover:text-white focus-visible:ring-white'
              : 'text-apple-green-700 hover:bg-apple-green-100 focus-visible:ring-apple-green-400'
          }`}
        >
          <Trash2 size={12} aria-hidden='true' />
        </button>
      )}
    </div>
  );
}

function GridShell({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className='overflow-x-auto'>
      <div
        className='grid min-w-[720px] grid-cols-[4.5rem_repeat(5,minmax(0,1fr))] gap-1.5'
        aria-label={label}
      >
        {children}
      </div>
    </div>
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

  const isSaving =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const header = (
    <CardHeader className='items-center'>
      <div>
        <CardTitle>Weekly Availability</CardTitle>
        <p className='mt-1 text-body-sm text-text-secondary'>
          Click a slot to mark it available. Click again to switch between preferred and
          available.
        </p>
      </div>
      <div className='flex flex-wrap items-center gap-x-4 gap-y-1.5 text-caption text-text-secondary'>
        <span className='flex items-center gap-1.5'>
          <span className='h-3 w-3 rounded-sm border border-apple-green-600 bg-apple-green-500' />
          Preferred
        </span>
        <span className='flex items-center gap-1.5'>
          <span className='h-3 w-3 rounded-sm border border-apple-green-300 bg-apple-green-50' />
          Available
        </span>
        <span className='flex items-center gap-1.5'>
          <span className='h-3 w-3 rounded-sm border border-dashed border-border bg-surface' />
          Unavailable
        </span>
      </div>
    </CardHeader>
  );

  if (isLoading) {
    return (
      <Card>
        {header}
        <CardBody>
          <GridShell label='Loading availability'>
            <div aria-hidden='true' />
            {DAYS.map((d) => (
              <div
                key={d.index}
                className='pb-1 text-center text-caption font-medium text-text-secondary'
              >
                {d.short}
              </div>
            ))}
            {Array.from({ length: END_HOUR - START_HOUR }).map((_, i) => (
              <div key={i} className='contents'>
                <div className='self-center pr-1 text-right text-caption text-text-tertiary'>
                  {formatHour(START_HOUR + i)}
                </div>
                {DAYS.map((d) => (
                  <div
                    key={d.index}
                    className='h-10 animate-pulse rounded-control border border-dashed border-border bg-surface'
                  />
                ))}
              </div>
            ))}
          </GridShell>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      {header}
      <CardBody>
        <GridShell label='Weekly availability grid'>
          <div aria-hidden='true' />
          {DAYS.map((d) => (
            <div
              key={d.index}
              className='pb-1 text-center text-caption font-medium text-text-secondary'
            >
              {d.name}
            </div>
          ))}

          {Array.from({ length: END_HOUR - START_HOUR }).map((_, i) => (
            <div key={i} className='contents'>
              <div className='self-center pr-1 text-right text-caption text-text-tertiary'>
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
        </GridShell>

        {isSaving && (
          <p className='mt-3 text-center text-caption text-text-tertiary'>Saving…</p>
        )}
      </CardBody>
    </Card>
  );
}
