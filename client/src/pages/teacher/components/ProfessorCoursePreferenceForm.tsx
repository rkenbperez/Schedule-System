import { useEffect, useState } from 'react';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import {
  useProfessorPreferences,
  useCreateProfessorPreference,
  useUpdateProfessorPreference,
  useDeleteProfessorPreference,
  useSubmitProfessorPreference,
} from '../../../hooks/Professor.hooks';
import { scheduleService } from '../../../services/Schedule.service';
import type {
  ProfessorPreference,
  MeetingPreference,
  Course,
  Section,
} from '../../../types/Types';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  IconButton,
  Modal,
  SelectField,
  Separator,
  TextField,
} from '../../../components/ui';
import { ConfirmDialog } from '../../../components/shared/ConfirmDialog';
import { useToast } from '../../../hooks/useToast';
import { cn } from '../../../lib/cn';

const MODE_OPTIONS: { value: MeetingPreference['mode']; label: string }[] = [
  { value: 'sync', label: 'Synchronous (Lecture)' },
  { value: 'lab', label: 'Laboratory' },
  { value: 'async', label: 'Asynchronous' },
];

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const STATUS_TONE = {
  draft: 'neutral',
  submitted: 'warning',
  published: 'success',
  rejected: 'danger',
} as const;

function DayPicker({
  value,
  onChange,
  disabled,
}: {
  value: number[];
  onChange: (days: number[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className='flex flex-wrap gap-1.5'>
      {DAY_LABELS.map((label, day) => {
        const active = value.includes(day);
        return (
          <button
            key={day}
            type='button'
            disabled={disabled}
            aria-pressed={active}
            onClick={() =>
              onChange(
                active
                  ? value.filter((d) => d !== day)
                  : [...value, day].sort((a, b) => a - b)
              )
            }
            className={cn(
              'h-9 min-w-11 rounded-control border px-2 text-caption font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-apple-green-400 disabled:cursor-not-allowed disabled:opacity-50',
              active
                ? 'border-apple-green-600 bg-apple-green-600 text-white'
                : 'border-border-control bg-surface text-text-secondary hover:bg-surface-secondary'
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

interface MeetingRowProps {
  meeting: MeetingPreference;
  index: number;
  onUpdate: (index: number, meeting: MeetingPreference) => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
}

function MeetingRow({ meeting, index, onUpdate, onRemove, disabled }: MeetingRowProps) {
  return (
    <div className='rounded-control border border-border bg-surface p-3 sm:p-4'>
      <div className='mb-3 flex items-center justify-between gap-2'>
        <p className='text-body-sm font-medium text-text-primary'>Meeting {index + 1}</p>
        <IconButton
          label={`Remove meeting ${index + 1}`}
          variant='ghost'
          size='sm'
          onClick={() => onRemove(index)}
          disabled={disabled}
          className='text-text-tertiary hover:text-danger'
        >
          <Trash2 size={16} />
        </IconButton>
      </div>

      <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
        <SelectField
          id={`meeting-mode-${index}`}
          label='Mode'
          value={meeting.mode}
          disabled={disabled}
          onChange={(e) =>
            onUpdate(index, {
              ...meeting,
              mode: e.target.value as MeetingPreference['mode'],
            })
          }
        >
          {MODE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>

        <TextField
          id={`meeting-duration-${index}`}
          label='Duration (hours)'
          type='number'
          min={1}
          max={8}
          value={meeting.duration_slots}
          disabled={disabled}
          onChange={(e) =>
            onUpdate(index, {
              ...meeting,
              duration_slots: Math.max(1, parseInt(e.target.value, 10) || 1),
            })
          }
        />

        {meeting.mode !== 'async' && (
          <>
            <div className='sm:col-span-2'>
              <span className='mb-1.5 block text-body-sm font-medium text-text-primary'>
                Preferred days
              </span>
              <DayPicker
                value={meeting.preferred_days ?? []}
                onChange={(days) => onUpdate(index, { ...meeting, preferred_days: days })}
                disabled={disabled}
              />
            </div>

            <TextField
              id={`meeting-start-${index}`}
              label='Earliest start'
              type='time'
              value={meeting.preferred_start ?? ''}
              disabled={disabled}
              onChange={(e) =>
                onUpdate(index, { ...meeting, preferred_start: e.target.value || null })
              }
            />

            <TextField
              id={`meeting-end-${index}`}
              label='Latest end'
              type='time'
              value={meeting.preferred_end ?? ''}
              disabled={disabled}
              onChange={(e) =>
                onUpdate(index, { ...meeting, preferred_end: e.target.value || null })
              }
            />
          </>
        )}
      </div>

      {meeting.mode === 'async' && (
        <Alert tone='info' className='mt-3'>
          Asynchronous meetings do not need a room or scheduled time.
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
  const toast = useToast();
  const { data: preferences, isLoading, refetch } = useProfessorPreferences({
    enabled: true,
  });
  const createMutation = useCreateProfessorPreference();
  const updateMutation = useUpdateProfessorPreference();
  const deleteMutation = useDeleteProfessorPreference();
  const submitMutation = useSubmitProfessorPreference();

  const [courses, setCourses] = useState<Course[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newSection, setNewSection] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProfessorPreference | null>(null);

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

  const handleOpenAdd = () => {
    if (readOnly) return;
    setNewSubject('');
    setNewSection('');
    setFormError(null);
    setAddOpen(true);
  };

  const handleCreateSubmit = async () => {
    if (!newSubject || !newSection) {
      setFormError('Select both a subject and a section.');
      return;
    }

    setFormError(null);
    try {
      const created = await createMutation.mutateAsync({
        subject: Number(newSubject),
        section: Number(newSection),
        meetings: [{ mode: 'sync', duration_slots: 2 }],
      });
      setAddOpen(false);
      setExpandedIds((prev) => new Set(prev).add(created.id));
      toast.addToast({
        type: 'success',
        title: 'Preference added',
        description: 'You can now configure its meeting schedule.',
      });
      refetch();
      onChange?.();
    } catch {
      toast.addToast({
        type: 'error',
        title: 'Could not add preference',
        description: 'Please try again.',
      });
    }
  };

  const handleUpdateFields = (
    id: number,
    fields: { subject?: number; section?: number }
  ) => {
    updateMutation.mutate(
      { id, payload: fields },
      {
        onSuccess: () => {
          refetch();
          onChange?.();
        },
        onError: () =>
          toast.addToast({ type: 'error', title: 'Could not update preference' }),
      }
    );
  };

  const handleUpdateMeetings = (id: number, meetings: MeetingPreference[]) => {
    updateMutation.mutate(
      { id, payload: { meetings } },
      {
        onSuccess: () => onChange?.(),
        onError: () =>
          toast.addToast({ type: 'error', title: 'Could not save meeting details' }),
      }
    );
  };

  const handleSubmit = (id: number) => {
    submitMutation.mutate(id, {
      onSuccess: () => {
        toast.addToast({
          type: 'success',
          title: 'Preference submitted',
          description: 'Your department head can now review it.',
        });
        onChange?.();
      },
      onError: () =>
        toast.addToast({ type: 'error', title: 'Could not submit preference' }),
    });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        setDeleteTarget(null);
        toast.addToast({ type: 'success', title: 'Preference deleted' });
        refetch();
        onChange?.();
      },
      onError: () => {
        toast.addToast({ type: 'error', title: 'Could not delete preference' });
        setDeleteTarget(null);
      },
    });
  };

  const handleAddMeeting = (pref: ProfessorPreference) => {
    const lastMeeting = pref.meetings[pref.meetings.length - 1];
    const newMeeting: MeetingPreference = {
      mode: lastMeeting?.mode ?? 'sync',
      duration_slots: lastMeeting?.duration_slots ?? 2,
    };
    handleUpdateMeetings(pref.id, [...pref.meetings, newMeeting]);
  };

  const handleUpdateMeeting = (
    pref: ProfessorPreference,
    index: number,
    meeting: MeetingPreference
  ) => {
    const updated = [...pref.meetings];
    updated[index] = meeting;
    handleUpdateMeetings(pref.id, updated);
  };

  const handleRemoveMeeting = (pref: ProfessorPreference, index: number) => {
    if (pref.meetings.length <= 1) {
      toast.addToast({
        type: 'warning',
        title: 'At least one meeting is required',
      });
      return;
    }
    handleUpdateMeetings(
      pref.id,
      pref.meetings.filter((_, i) => i !== index)
    );
  };

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isSaving =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    submitMutation.isPending;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Course Preferences</CardTitle>
            <p className='mt-1 text-body-sm text-text-secondary'>
              Define your preferred meeting patterns for each subject and section.
            </p>
          </div>
        </CardHeader>
        <CardBody className='space-y-3'>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className='h-16 animate-pulse rounded-control border border-border bg-surface-secondary'
            />
          ))}
        </CardBody>
      </Card>
    );
  }

  const list = preferences ?? [];
  const optionsUnavailable =
    !loadingOptions && (courses.length === 0 || sections.length === 0);

  return (
    <>
      <Card>
        <CardHeader className='items-center'>
          <div>
            <CardTitle>Course Preferences</CardTitle>
            <p className='mt-1 text-body-sm text-text-secondary'>
              Define your preferred meeting patterns for each subject and section.
            </p>
          </div>
          <Button
            onClick={handleOpenAdd}
            disabled={readOnly || loadingOptions || optionsUnavailable}
            icon={<Plus size={16} />}
          >
            Add preference
          </Button>
        </CardHeader>

        <CardBody className='space-y-3'>
          {optionsUnavailable && (
            <Alert tone='danger' title='Subjects or sections unavailable'>
              No subjects or sections are available yet. Contact the registrar before
              adding preferences.
            </Alert>
          )}

          {list.length === 0 ? (
            <EmptyState
              icon={Plus}
              title='No preferences yet'
              description='Add a course preference to choose your subject, section, and preferred meeting times.'
              action={
                <Button
                  onClick={handleOpenAdd}
                  disabled={readOnly || loadingOptions || optionsUnavailable}
                  icon={<Plus size={16} />}
                >
                  Add your first preference
                </Button>
              }
            />
          ) : (
            list.map((pref) => {
              const isExpanded = expandedIds.has(pref.id);
              const isDraft = pref.status === 'draft';
              const isEditable = isDraft || pref.status === 'rejected';
              const totalHours = pref.meetings.reduce(
                (sum, meeting) => sum + meeting.duration_slots,
                0
              );

              return (
                <div
                  key={pref.id}
                  className='overflow-hidden rounded-control border border-border bg-surface'
                >
                  <div className='flex items-center justify-between gap-3 p-3 sm:p-4'>
                    <button
                      type='button'
                      onClick={() => toggleExpand(pref.id)}
                      aria-expanded={isExpanded}
                      className='flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-apple-green-400'
                    >
                      <ChevronDown
                        size={16}
                        aria-hidden='true'
                        className={cn(
                          'shrink-0 text-text-tertiary transition-transform',
                          isExpanded && 'rotate-180'
                        )}
                      />
                      <span className='min-w-0'>
                        <span className='block truncate text-body-sm font-medium text-text-primary'>
                          {pref.subject_code} · {pref.subject_title}
                        </span>
                        <span className='mt-0.5 block text-caption text-text-tertiary'>
                          {pref.section_name} · {pref.meetings.length} meeting
                          {pref.meetings.length !== 1 ? 's' : ''} · {totalHours} hour
                          {totalHours !== 1 ? 's' : ''}
                        </span>
                      </span>
                    </button>

                    <div className='flex shrink-0 items-center gap-1.5'>
                      <Badge tone={STATUS_TONE[pref.status]} size='sm'>
                        {pref.status.charAt(0).toUpperCase() + pref.status.slice(1)}
                      </Badge>

                      {isDraft && !readOnly && (
                        <Button
                          size='sm'
                          onClick={() => handleSubmit(pref.id)}
                          disabled={submitMutation.isPending}
                        >
                          Submit
                        </Button>
                      )}

                      {pref.status === 'rejected' && !readOnly && (
                        <Button
                          size='sm'
                          onClick={() => handleSubmit(pref.id)}
                          disabled={submitMutation.isPending}
                        >
                          Resubmit
                        </Button>
                      )}

                      {!readOnly && (
                        <IconButton
                          label='Delete preference'
                          variant='ghost'
                          size='sm'
                          onClick={() => setDeleteTarget(pref)}
                          className='text-text-tertiary hover:text-danger'
                        >
                          <Trash2 size={16} />
                        </IconButton>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className='space-y-4 border-t border-border p-3 sm:p-4'>
                      {!isDraft && (
                        <Alert
                          tone={
                            pref.status === 'rejected'
                              ? 'danger'
                              : pref.status === 'published'
                                ? 'success'
                                : 'info'
                          }
                          title={
                            pref.status === 'rejected'
                              ? 'This preference was rejected'
                              : `This preference is ${pref.status}`
                          }
                        >
                          {pref.status === 'submitted'
                            ? 'It is awaiting department head review and can no longer be edited.'
                            : pref.status === 'published'
                              ? 'It has been published and is used for schedule generation.'
                              : 'Update the details below and resubmit it for review.'}
                        </Alert>
                      )}

                      {!isDraft && pref.review_notes && (
                        <div className='rounded-control bg-surface-secondary px-3 py-2.5 text-body-sm text-text-secondary'>
                          <span className='font-medium text-text-primary'>
                            Reviewer notes:
                          </span>{' '}
                          {pref.review_notes}
                        </div>
                      )}

                      <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                        <SelectField
                          id={`pref-${pref.id}-subject`}
                          label='Subject'
                          value={String(pref.subject)}
                          disabled={readOnly || !isEditable}
                          onChange={(e) =>
                            handleUpdateFields(pref.id, {
                              subject: Number(e.target.value),
                            })
                          }
                        >
                          {courses.map((course) => (
                            <option key={course.id} value={course.id}>
                              {course.code} - {course.title}
                            </option>
                          ))}
                        </SelectField>

                        <SelectField
                          id={`pref-${pref.id}-section`}
                          label='Section'
                          value={String(pref.section)}
                          disabled={readOnly || !isEditable}
                          onChange={(e) =>
                            handleUpdateFields(pref.id, {
                              section: Number(e.target.value),
                            })
                          }
                        >
                          {sections.map((section) => (
                            <option key={section.id} value={section.id}>
                              {section.name}
                              {section.headcount ? ` · ${section.headcount} students` : ''}
                            </option>
                          ))}
                        </SelectField>
                      </div>

                      <Separator />

                      <div className='space-y-3'>
                        <div className='flex items-center justify-between gap-2'>
                          <h4 className='text-body-sm font-medium text-text-primary'>
                            Meetings
                          </h4>
                          <Button
                            variant='secondary'
                            size='sm'
                            onClick={() => handleAddMeeting(pref)}
                            disabled={readOnly || !isEditable}
                            icon={<Plus size={14} />}
                          >
                            Add meeting
                          </Button>
                        </div>

                        {pref.meetings.map((meeting, index) => (
                          <MeetingRow
                            key={index}
                            meeting={meeting}
                            index={index}
                            onUpdate={(i, updated) =>
                              handleUpdateMeeting(pref, i, updated)
                            }
                            onRemove={(i) => handleRemoveMeeting(pref, i)}
                            disabled={readOnly || !isEditable}
                          />
                        ))}

                        {pref.meetings.length === 0 && (
                          <p className='rounded-control border border-dashed border-border py-4 text-center text-caption text-text-tertiary'>
                            No meetings yet. Add one to define when this class can meet.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {isSaving && (
            <p className='text-center text-caption text-text-tertiary'>Saving…</p>
          )}
        </CardBody>
      </Card>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title='Add course preference'
        description='Choose the subject and section you want to teach.'
        size='md'
        footer={
          <div className='flex justify-end gap-2'>
            <Button variant='secondary' onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateSubmit}
              loading={createMutation.isPending}
              disabled={!newSubject || !newSection}
            >
              Add preference
            </Button>
          </div>
        }
      >
        <div className='space-y-4'>
          {optionsUnavailable && (
            <Alert tone='danger' title='Options unavailable'>
              No subjects or sections are available yet. Contact the registrar.
            </Alert>
          )}

          <SelectField
            id='new-preference-subject'
            label='Subject'
            required
            value={newSubject}
            onChange={(e) => {
              setNewSubject(e.target.value);
              setFormError(null);
            }}
          >
            <option value=''>Select a subject</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.code} - {course.title}
              </option>
            ))}
          </SelectField>

          <SelectField
            id='new-preference-section'
            label='Section'
            required
            value={newSection}
            onChange={(e) => {
              setNewSection(e.target.value);
              setFormError(null);
            }}
          >
            <option value=''>Select a section</option>
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.name}
                {section.headcount ? ` · ${section.headcount} students` : ''}
              </option>
            ))}
          </SelectField>

          {formError && <p className='text-body-sm text-danger'>{formError}</p>}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title='Delete preference'
        message={`Delete the preference for ${deleteTarget?.subject_code ?? 'this subject'}? This cannot be undone.`}
        confirmText='Delete'
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}
