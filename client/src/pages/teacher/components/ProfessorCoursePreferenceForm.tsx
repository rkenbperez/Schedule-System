import { useState, useEffect } from 'react';
import { Plus, Trash2, GripVertical, ChevronDown, ChevronUp } from 'lucide-react';
import {
  useProfessorPreferences,
  useCreateProfessorPreference,
  useUpdateProfessorPreference,
  useDeleteProfessorPreference,
  useSubmitProfessorPreference,
} from '../../../hooks/Professor.hooks';
import { scheduleService } from '../../../services/Schedule.service';
import type { ProfessorPreference, MeetingPreference, Course, Section } from '../../../types/Types';
import {
  Button,
  Card,
  Badge,
  Input,
  Select,
  Label,
  Alert,
  Separator,
  Tooltip,
} from '../../../components/ui';

const MODE_OPTIONS = [
  { value: 'sync', label: 'Synchronous (Lecture)' },
  { value: 'lab', label: 'Laboratory' },
  { value: 'async', label: 'Asynchronous' },
];

const DAY_OPTIONS = [
  { value: '0', label: 'Monday' },
  { value: '1', label: 'Tuesday' },
  { value: '2', label: 'Wednesday' },
  { value: '3', label: 'Thursday' },
  { value: '4', label: 'Friday' },
  { value: '5', label: 'Saturday' },
  { value: '6', label: 'Sunday' },
];

interface MeetingRowProps {
  meeting: MeetingPreference;
  index: number;
  onUpdate: (index: number, meeting: MeetingPreference) => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
}

function MeetingRow({ meeting, index, onUpdate, onRemove, disabled }: MeetingRowProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className='border border-border rounded-lg p-4 space-y-3 bg-surface'>
      <div className='flex items-center justify-between gap-2'>
        <span className='text-body-sm font-medium text-text-primary'>
          Meeting #{index + 1}
        </span>
        <div className='flex items-center gap-2'>
          <Tooltip content={expanded ? 'Collapse' : 'Expand'}>
            <button
              type='button'
              onClick={() => setExpanded(!expanded)}
              className='p-1 rounded hover:bg-surface-secondary transition-colors'
              disabled={disabled}
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </Tooltip>
          <Tooltip content='Remove meeting'>
            <button
              type='button'
              onClick={() => onRemove(index)}
              disabled={disabled}
              className='p-1 rounded hover:bg-red-50 text-red-500 hover:text-red-700 transition-colors'
            >
              <Trash2 size={16} />
            </button>
          </Tooltip>
        </div>
      </div>

      <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4'>
        <div>
          <Label htmlFor={`meeting-mode-${index}`}>Mode</Label>
          <Select
            value={meeting.mode}
            onValueChange={(v) => onUpdate(index, { ...meeting, mode: v as 'sync' | 'lab' | 'async' })}
            disabled={disabled}
            options={MODE_OPTIONS}
            placeholder='Select mode'
          >
          </Select>
        </div>

        <div>
          <Label htmlFor={`meeting-duration-${index}`}>Duration (hours)</Label>
          <Input
            id={`meeting-duration-${index}`}
            type='number'
            min='1'
            max='8'
            value={meeting.duration_slots}
            onChange={(e) => onUpdate(index, { ...meeting, duration_slots: parseInt(e.target.value) || 1 })}
            disabled={disabled}
            className='w-full'
          />
        </div>

        {meeting.mode !== 'async' && (
          <>
            <div>
              <Label htmlFor={`meeting-days-${index}`}>Preferred Days</Label>
              <Select
                value={meeting.preferred_days?.join(',') ?? ''}
                onValueChange={(v: string) => {
                  const days = v ? v.split(',').map(Number) : [];
                  onUpdate(index, { ...meeting, preferred_days: days });
                }}
                disabled={disabled}
                options={DAY_OPTIONS}
                placeholder='Select days'
              >
              </Select>
            </div>

            <div className='grid grid-cols-2 gap-2'>
              <div>
                <Label htmlFor={`meeting-start-${index}`}>Start Time</Label>
                <Input
                  id={`meeting-start-${index}`}
                  type='time'
                  value={meeting.preferred_start ?? ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate(index, { ...meeting, preferred_start: e.target.value || null })}
                  disabled={disabled}
                />
              </div>
              <div>
                <Label htmlFor={`meeting-end-${index}`}>End Time</Label>
                <Input
                  id={`meeting-end-${index}`}
                  type='time'
                  value={meeting.preferred_end ?? ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate(index, { ...meeting, preferred_end: e.target.value || null })}
                  disabled={disabled}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {meeting.mode === 'async' && (
        <Alert tone='info' className='text-sm'>
          Asynchronous meetings don't require room/time scheduling.
        </Alert>
      )}
    </div>
  );
}

export default function ProfessorCoursePreferenceForm({
  readOnly = false,
  onChange,
}: {
  readOnly?: boolean;
  onChange?: () => void;
}) {
  const { data: preferences, isLoading, refetch } = useProfessorPreferences({ enabled: true });
  const createMutation = useCreateProfessorPreference();
  const updateMutation = useUpdateProfessorPreference();
  const deleteMutation = useDeleteProfessorPreference();
  const submitMutation = useSubmitProfessorPreference();

  const [courses, setCourses] = useState<Course[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [coursesData, sectionsData] = await Promise.all([
          scheduleService.getCourses(),
          scheduleService.getSections(),
        ]);
        setCourses(coursesData);
        setSections(sectionsData);
      } catch (error) {
        console.error('Failed to load courses/sections:', error);
      } finally {
        setLoadingOptions(false);
      }
    };
    fetchOptions();
  }, []);

  const handleCreate = async () => {
    if (loadingOptions) return;

    const firstCourse = courses[0];
    const firstSection = sections[0];

    if (!firstCourse || !firstSection) {
      alert('No courses or sections available');
      return;
    }

    createMutation.mutate(
      {
        subject: firstCourse.id,
        section: firstSection.id,
        meetings: [{ mode: 'sync', duration_slots: 2 }],
      },
      {
        onSuccess: () => {
          refetch();
          onChange?.();
        },
      }
    );
  };

  const handleUpdateMeetings = (id: number, meetings: MeetingPreference[]) => {
    updateMutation.mutate(
      { id, payload: { meetings } },
      { onSuccess: () => onChange?.() }
    );
  };

  const handleDelete = (id: number) => {
    if (confirm('Delete this preference?')) {
      deleteMutation.mutate(id, { onSuccess: () => onChange?.() });
    }
  };

  const handleSubmit = (id: number) => {
    submitMutation.mutate(id, { onSuccess: () => onChange?.() });
  };

  const handleAddMeeting = (pref: ProfessorPreference) => {
    const lastMeeting = pref.meetings[pref.meetings.length - 1];
    const newMeeting: MeetingPreference = {
      mode: lastMeeting?.mode ?? 'sync',
      duration_slots: lastMeeting?.duration_slots ?? 2,
    };
    handleUpdateMeetings(pref.id, [...pref.meetings, newMeeting]);
  };

  const handleUpdateMeeting = (pref: ProfessorPreference, index: number, meeting: MeetingPreference) => {
    const updated = [...pref.meetings];
    updated[index] = meeting;
    handleUpdateMeetings(pref.id, updated);
  };

  const handleRemoveMeeting = (pref: ProfessorPreference, index: number) => {
    if (pref.meetings.length <= 1) {
      alert('At least one meeting is required');
      return;
    }
    const updated = pref.meetings.filter((_, i) => i !== index);
    handleUpdateMeetings(pref.id, updated);
  };

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (isLoading) {
    return (
      <Card className='space-y-4'>
        <div className='flex items-center justify-between'>
          <h3 className='text-h3 text-text-primary'>Course Preferences</h3>
          <Button variant='secondary' disabled>Add Preference</Button>
        </div>
        <div className='space-y-3'>
          {[1, 2, 3].map((i) => (
            <Card key={i} className='animate-pulse h-32' />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h3 className='text-h3 text-text-primary'>Course Preferences</h3>
          <p className='text-caption text-text-secondary'>
            Define your preferred meeting patterns for each subject/section
          </p>
        </div>
        <Button onClick={handleCreate} disabled={readOnly || loadingOptions || createMutation.isPending}>
          <Plus size={16} className='mr-2' />
          Add Preference
        </Button>
      </div>

      {preferences && preferences.length === 0 && !loadingOptions && (
        <div className='text-center py-8'>
          <p className='text-text-secondary mb-4'>No preferences created yet</p>
          <Button onClick={handleCreate} disabled={readOnly || loadingOptions}>
            <Plus size={16} className='mr-2' />
            Create Your First Preference
          </Button>
        </div>
      )}

      <div className='space-y-3'>
        {preferences?.map((pref) => {
          const course = courses.find((c) => c.id === pref.subject);
          const section = sections.find((s) => s.id === pref.section);
          const isExpanded = expandedIds.has(pref.id);
          const isDraft = pref.status === 'draft';

          return (
            <Card key={pref.id} className='overflow-hidden'>
              <div
                className='flex items-center justify-between p-4 border-b border-border cursor-pointer hover:bg-surface-secondary transition-colors'
                onClick={() => toggleExpand(pref.id)}
              >
                <div className='flex items-center gap-3 min-w-0 flex-1'>
                  <GripVertical className='text-text-tertiary hover:text-text-primary' />
                  <div className='min-w-0'>
                    <p className='font-medium text-text-primary truncate'>
                      {course?.code} - {course?.title} ({section?.name})
                    </p>
                    <p className='text-caption text-text-tertiary'>
                      {pref.meetings.length} meeting{pref.meetings.length !== 1 ? 's' : ''} •
                      {pref.meetings.reduce((sum, m) => sum + m.duration_slots, 0)} hours total
                    </p>
                  </div>
                </div>

                <div className='flex items-center gap-2 shrink-0'>
                  <Badge
                    tone={
                      pref.status === 'draft' ? 'neutral' :
                      pref.status === 'submitted' ? 'warning' :
                      pref.status === 'published' ? 'success' : 'danger'
                    }
                    size='sm'
                  >
                    {pref.status.charAt(0).toUpperCase() + pref.status.slice(1)}
                  </Badge>

                  {isDraft && !readOnly && (
                    <Tooltip content='Submit for department head review'>
                      <Button
                        variant='primary'
                        size='sm'
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSubmit(pref.id);
                        }}
                        disabled={submitMutation.isPending}
                      >
                        Submit
                      </Button>
                    </Tooltip>
                  )}

                  <Tooltip content={isExpanded ? 'Collapse' : 'Expand'}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(pref.id);
                      }}
                      className='p-1 rounded hover:bg-surface-secondary transition-colors'
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </Tooltip>

                  {!readOnly && (
                    <Tooltip content='Delete preference'>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(pref.id);
                        }}
                        className='p-1 rounded hover:bg-red-50 text-red-500 hover:text-red-700 transition-colors'
                      >
                        <Trash2 size={16} />
                      </button>
                    </Tooltip>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className='p-4 space-y-3'>
                  <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                    <div>
                      <Label>Subject</Label>
<Select
                      value={String(pref.subject)}
                      onValueChange={(v: string) => {
                        parseInt(v, 10);
                        handleUpdateMeetings(pref.id, pref.meetings);
                      }}
                      disabled={readOnly || !isDraft}
                      options={courses.map((c) => ({ value: String(c.id), label: `${c.code} - ${c.title} (${c.units} units)` }))}
                      placeholder='Select subject'
                    >
                    </Select>
                    </div>
                    <div>
                      <Label>Section</Label>
<Select
                      value={String(pref.section)}
                      onValueChange={(v: string) => {
                        parseInt(v, 10);
                        handleUpdateMeetings(pref.id, pref.meetings);
                      }}
                      disabled={readOnly || !isDraft}
                      options={sections.map((s) => ({ value: String(s.id), label: `${s.name} (${s.headcount} students)` }))}
                      placeholder='Select section'
                    >
                    </Select>
                    </div>
                  </div>

                  <Separator />

                  <div className='space-y-3'>
                    <div className='flex items-center justify-between'>
                      <h4 className='text-body-sm font-medium text-text-primary'>Meetings</h4>
                      <Tooltip content='Add another meeting'>
                        <Button
                          variant='secondary'
                          size='sm'
                          onClick={() => handleAddMeeting(pref)}
                          disabled={readOnly || !isDraft}
                        >
                          <Plus size={14} className='mr-1' />
                          Add Meeting
                        </Button>
                      </Tooltip>
                    </div>

                    {pref.meetings.map((meeting, idx) => (
                      <MeetingRow
                        key={idx}
                        meeting={meeting}
                        index={idx}
                        onUpdate={(i, m) => handleUpdateMeeting(pref, i, m)}
                        onRemove={(i) => handleRemoveMeeting(pref, i)}
                        disabled={readOnly || !isDraft}
                      />
                    ))}

                    {pref.meetings.length === 0 && (
                      <p className='text-caption text-text-tertiary text-center py-4'>
                        No meetings defined. Click "Add Meeting" to start.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {(createMutation.isPending || updateMutation.isPending || deleteMutation.isPending || submitMutation.isPending) && (
        <div className='text-caption text-text-tertiary text-center py-2'>
          Saving...
        </div>
      )}
    </Card>
  );
}