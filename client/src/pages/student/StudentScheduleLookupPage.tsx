import { useState, type FormEvent } from 'react';
import { CalendarDays, Clock, MapPin, Search } from 'lucide-react';
import { useStudentSchedule } from '../../hooks/Schedule.hooks';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  LoadingState,
  PageHeader,
  Table,
  TableContainer,
  TBody,
  TD,
  TH,
  THead,
  TR,
  TextField,
} from '../../components/ui';

type StudentScheduleItem = {
  id: number;
  day: number;
  day_display: string;
  start_time: string;
  end_time: string | null;
  subject_label: string;
  section_name: string;
  room_name: string | null;
  prof_name: string;
  mode_display: string | null;
};

const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const PLACEHOLDER_TIPS = [
  {
    icon: Search,
    title: 'Use your section code',
    description: 'For example, 3-A.',
  },
  {
    icon: Clock,
    title: 'Term is optional',
    description: 'Leave it blank for the current term.',
  },
  {
    icon: MapPin,
    title: 'See every room',
    description: 'Rooms and instructors in one view.',
  },
];

function formatTime(item: StudentScheduleItem) {
  return item.end_time
    ? `${item.start_time} – ${item.end_time}`
    : item.start_time;
}

export default function StudentScheduleLookupPage() {
  const [section, setSection] = useState('');
  const [term, setTerm] = useState('');
  const [searched, setSearched] = useState<{
    section: string;
    term: string;
  } | null>(null);

  const {
    data: schedules,
    isLoading,
    error,
    refetch,
  } = useStudentSchedule(section, term || undefined, { enabled: false });

  const items = (schedules ?? []) as unknown as StudentScheduleItem[];
  const hasSearched = searched !== null;
  const dayCount = new Set(items.map((item) => item.day)).size;
  const resultSummary = `${items.length} class${
    items.length === 1 ? '' : 'es'
  } · ${dayCount} day${dayCount === 1 ? '' : 's'}`;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = section.trim();
    if (!value) return;
    setSearched({ section: value, term });
    refetch();
  }

  return (
    <div className='space-y-6'>
      <PageHeader
        eyebrow='Student access'
        title='Find your schedule'
        description='Enter your section code to see every class, room, and instructor for the term.'
      />

      <div className='grid gap-6 lg:grid-cols-[minmax(280px,320px)_minmax(0,1fr)] lg:items-start'>
        <div className='lg:sticky lg:top-24'>
          <Card>
            <CardBody>
            <form onSubmit={handleSubmit} className='grid gap-4'>
              <TextField
                id='section'
                label='Section code'
                type='text'
                value={section}
                onChange={(event) => setSection(event.target.value)}
                placeholder='e.g. 3-A'
                autoComplete='off'
                required
              />

              <TextField
                id='term'
                label='Term ID'
                type='number'
                inputMode='numeric'
                min={1}
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder='e.g. 1'
                hint='Optional — leave blank for the current term.'
              />

              <Button
                type='submit'
                loading={isLoading}
                disabled={!section.trim()}
                icon={<Search size={17} aria-hidden='true' />}
                className='w-full'
              >
                Look up schedule
              </Button>
            </form>

            <p className='mt-4 text-caption text-text-tertiary'>
              Tip: use the section code from your registration form. Term ID is
              optional.
            </p>
          </CardBody>
        </Card>
      </div>

      <div aria-live='polite' className='min-w-0 space-y-4'>
        {error && (
          <Alert tone='danger' title='Unable to load schedule'>
            {error.message ?? 'Please try again.'}
          </Alert>
        )}

        {isLoading && (
          <LoadingState
            label='Looking up your schedule…'
            className='lg:min-h-[420px]'
          />
        )}

        {!isLoading && !hasSearched && !error && (
          <Card className='flex lg:min-h-[420px]'>
            <CardBody className='flex w-full flex-col items-center justify-center px-6 py-10 text-center'>
              <span className='mb-4 grid h-12 w-12 place-items-center rounded-full bg-surface-secondary text-text-tertiary'>
                <CalendarDays size={22} aria-hidden='true' />
              </span>
              <h2 className='text-h3 text-text-primary'>
                Your schedule will appear here
              </h2>
              <p className='mt-1 max-w-md text-body-sm text-text-secondary'>
                Look up a section to see a compact view of every class, room,
                and instructor.
              </p>

              <div className='mt-8 grid w-full max-w-lg gap-3 text-left sm:grid-cols-3'>
                {PLACEHOLDER_TIPS.map((tip) => {
                  const Icon = tip.icon;

                  return (
                    <div
                      key={tip.title}
                      className='rounded-control border border-border-light bg-surface-tertiary p-3'
                    >
                      <Icon
                        size={16}
                        className='text-apple-green-700'
                        aria-hidden='true'
                      />
                      <p className='mt-2 text-body-sm font-medium text-text-primary'>
                        {tip.title}
                      </p>
                      <p className='mt-0.5 text-caption text-text-secondary'>
                        {tip.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>
        )}

        {!isLoading && hasSearched && !error && items.length === 0 && (
          <EmptyState
            icon={Search}
            title='No classes found'
            description={`We could not find a schedule for section "${
              searched?.section ?? section
            }". Check the section code and try again.`}
            className='lg:min-h-[420px]'
          />
        )}

        {!isLoading && items.length > 0 && (
          <Card>
            <CardHeader>
              <div className='min-w-0'>
                <CardTitle>
                  Schedule for {searched?.section ?? section}
                </CardTitle>
                <p className='mt-0.5 text-body-sm text-text-secondary'>
                  {resultSummary}
                </p>
              </div>
              <div className='flex flex-wrap items-center gap-2'>
                {searched?.term && (
                  <Badge tone='neutral'>Term {searched.term}</Badge>
                )}
                <Badge tone='green'>
                  {items.length} {items.length === 1 ? 'class' : 'classes'}
                </Badge>
              </div>
            </CardHeader>

            <div className='hidden md:block'>
              <TableContainer className='rounded-none border-0'>
                <Table className='min-w-[560px]'>
                  <caption className='sr-only'>
                    Class schedule for section{' '}
                    {searched?.section ?? section}
                  </caption>
                  <THead>
                    <TR>
                      <TH>Course</TH>
                      <TH>Day</TH>
                      <TH>Time</TH>
                      <TH>Room</TH>
                      <TH>Professor</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {items.map((item) => (
                      <TR key={item.id}>
                        <TD>
                          <p className='font-medium'>{item.subject_label}</p>
                          <p className='mt-0.5 text-caption text-text-tertiary'>
                            {item.mode_display ?? 'Class'}
                          </p>
                        </TD>
                        <TD className='text-text-secondary'>
                          {item.day_display ??
                            DAY_LABELS[item.day] ??
                            '—'}
                        </TD>
                        <TD className='whitespace-nowrap tabular-nums text-text-secondary'>
                          {formatTime(item)}
                        </TD>
                        <TD className='text-text-secondary'>
                          {item.room_name ?? 'TBA'}
                        </TD>
                        <TD className='text-text-secondary'>
                          {item.prof_name}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TableContainer>
            </div>

            <ul className='divide-y divide-border-light md:hidden'>
              {items.map((item) => (
                <li key={item.id} className='space-y-3 px-4 py-4'>
                  <div className='flex items-start justify-between gap-3'>
                    <div className='min-w-0'>
                      <p className='text-body font-semibold text-text-primary'>
                        {item.subject_label}
                      </p>
                      <p className='text-caption text-text-tertiary'>
                        {item.mode_display ?? 'Class'}
                      </p>
                    </div>
                    <Badge tone='neutral'>
                      {item.day_display ??
                        DAY_LABELS[item.day] ??
                        '—'}
                    </Badge>
                  </div>

                  <dl className='grid grid-cols-2 gap-x-4 gap-y-2 text-body-sm'>
                    <div>
                      <dt className='text-caption text-text-tertiary'>
                        Time
                      </dt>
                      <dd className='tabular-nums text-text-primary'>
                        {formatTime(item)}
                      </dd>
                    </div>
                    <div>
                      <dt className='text-caption text-text-tertiary'>
                        Room
                      </dt>
                      <dd className='text-text-primary'>
                        {item.room_name ?? 'TBA'}
                      </dd>
                    </div>
                    <div className='col-span-2'>
                      <dt className='text-caption text-text-tertiary'>
                        Professor
                      </dt>
                      <dd className='text-text-primary'>{item.prof_name}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
      </div>
    </div>
  );
}
