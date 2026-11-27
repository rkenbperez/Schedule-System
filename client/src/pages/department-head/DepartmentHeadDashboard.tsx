import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Check,
  CheckCircle,
  ClipboardList,
  Clock,
  Eye,
  Search,
  X,
  XCircle,
} from 'lucide-react';
import {
  useDepartmentHeadSubmissions,
  usePublishPreference,
  useBatchPublishPreferences,
} from '../../hooks/Professor.hooks';
import type { ProfessorPreferenceListItem } from '../../types/Types';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  Input,
  Modal,
  PageHeader,
  SegmentedControl,
  Separator,
  StatCard,
  Table,
  TableContainer,
  TBody,
  TD,
  TextareaField,
  TH,
  THead,
  TR,
  type SegmentedOption,
} from '../../components/ui';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { useToast } from '../../hooks/useToast';
import DepartmentCreateAssignment from './components/DepartmentCreateAssignment';

type View = 'submissions' | 'assignments';
type StatusFilter = 'all' | 'submitted' | 'published' | 'rejected';

const STATUS_TONE = {
  draft: 'neutral',
  submitted: 'warning',
  published: 'success',
  rejected: 'danger',
} as const;

const MODE_LABEL: Record<string, string> = {
  sync: 'Lecture',
  lab: 'Lab',
  async: 'Async',
};

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function StatusBadge({ status }: { status: string }) {
  const known = status in STATUS_TONE;
  const tone = known
    ? STATUS_TONE[status as keyof typeof STATUS_TONE]
    : 'neutral';
  return (
    <Badge tone={tone} size='sm'>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

export default function DepartmentHeadDashboard() {
  const toast = useToast();
  const { data: submissions, isLoading, refetch } = useDepartmentHeadSubmissions({
    enabled: true,
  });
  const publishMutation = usePublishPreference();
  const batchMutation = useBatchPublishPreferences();

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewPreference, setReviewPreference] =
    useState<ProfessorPreferenceListItem | null>(null);
  const [reviewAction, setReviewAction] = useState<'publish' | 'reject'>('publish');
  const [reviewNotes, setReviewNotes] = useState('');
  const [rejectConfirm, setRejectConfirm] = useState<{
    ids: number[];
    label: string;
  } | null>(null);

  const location = useLocation();
  const navigate = useNavigate();
  const view: View = location.pathname.endsWith('/assignments')
    ? 'assignments'
    : 'submissions';

  const allItems = useMemo(
    () => (submissions ?? []).flatMap((submission) => submission.items),
    [submissions]
  );

  const submittedCount = allItems.filter(
    (item) => item.preference.status === 'submitted'
  ).length;
  const publishedCount = allItems.filter(
    (item) => item.preference.status === 'published'
  ).length;
  const rejectedCount = allItems.filter(
    (item) => item.preference.status === 'rejected'
  ).length;

  const normalizedQuery = query.trim().toLowerCase();
  const items = allItems.filter((item) => {
    const pref = item.preference;
    const matchesStatus =
      statusFilter === 'all' || pref.status === statusFilter;
    const matchesQuery =
      !normalizedQuery ||
      pref.professor_name.toLowerCase().includes(normalizedQuery) ||
      pref.subject_code.toLowerCase().includes(normalizedQuery) ||
      pref.subject_title.toLowerCase().includes(normalizedQuery) ||
      pref.section_name.toLowerCase().includes(normalizedQuery);
    return matchesStatus && matchesQuery;
  });

  const selectableItems = items.filter(
    (item) => item.preference.status === 'submitted'
  );
  const allSelectableSelected =
    selectableItems.length > 0 &&
    selectableItems.every((item) => selectedIds.includes(item.preference.id));
  const someSelectableSelected = selectableItems.some((item) =>
    selectedIds.includes(item.preference.id)
  );
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate =
        someSelectableSelected && !allSelectableSelected;
    }
  }, [someSelectableSelected, allSelectableSelected]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(selectableItems.map((item) => item.preference.id));
      return;
    }
    const selectableIds = new Set(
      selectableItems.map((item) => item.preference.id)
    );
    setSelectedIds((prev) => prev.filter((id) => !selectableIds.has(id)));
  };

  const handleSelect = (id: number, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? [...prev, id] : prev.filter((itemId) => itemId !== id)
    );
  };

  const handlePublishSelected = () => {
    if (selectedIds.length === 0) return;
    batchMutation.mutate(
      { preferenceIds: selectedIds, action: 'publish', notes: '' },
      {
        onSuccess: () => {
          toast.addToast({
            type: 'success',
            title: 'Preferences published',
            description: `${selectedIds.length} preference${selectedIds.length !== 1 ? 's' : ''} published.`,
          });
          refetch();
          setSelectedIds([]);
        },
        onError: () =>
          toast.addToast({ type: 'error', title: 'Could not publish preferences' }),
      }
    );
  };

  const handleRejectSelected = () => {
    if (selectedIds.length === 0) return;
    setRejectConfirm({
      ids: selectedIds,
      label: `${selectedIds.length} selected preference${selectedIds.length !== 1 ? 's' : ''}`,
    });
  };

  const confirmReject = () => {
    if (!rejectConfirm) return;
    const { ids } = rejectConfirm;
    batchMutation.mutate(
      { preferenceIds: ids, action: 'reject', notes: '' },
      {
        onSuccess: () => {
          toast.addToast({
            type: 'success',
            title: 'Preferences rejected',
            description: `${ids.length} preference${ids.length !== 1 ? 's' : ''} returned to the professor.`,
          });
          refetch();
          setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
          setRejectConfirm(null);
        },
        onError: () => {
          toast.addToast({ type: 'error', title: 'Could not reject preferences' });
          setRejectConfirm(null);
        },
      }
    );
  };

  const handleQuickPublish = (pref: ProfessorPreferenceListItem) => {
    publishMutation.mutate(
      { id: pref.id, action: 'publish', notes: '' },
      {
        onSuccess: () => {
          toast.addToast({ type: 'success', title: 'Preference published' });
          refetch();
        },
        onError: () =>
          toast.addToast({ type: 'error', title: 'Could not publish preference' }),
      }
    );
  };

  const handleOpenReview = (pref: ProfessorPreferenceListItem) => {
    setReviewPreference(pref);
    setReviewAction('publish');
    setReviewNotes('');
    setReviewModalOpen(true);
  };

  const handleReviewConfirm = () => {
    if (!reviewPreference) return;
    publishMutation.mutate(
      { id: reviewPreference.id, action: reviewAction, notes: reviewNotes },
      {
        onSuccess: () => {
          toast.addToast({
            type: 'success',
            title: reviewAction === 'publish' ? 'Preference published' : 'Preference rejected',
          });
          refetch();
          setReviewModalOpen(false);
          setReviewPreference(null);
        },
        onError: () =>
          toast.addToast({
            type: 'error',
            title: 'Could not update preference',
          }),
      }
    );
  };

  const viewOptions: SegmentedOption<View>[] = [
    { value: 'submissions', label: 'Submissions' },
    { value: 'assignments', label: 'Assignments' },
  ];

  const statusOptions: SegmentedOption<StatusFilter>[] = [
    { value: 'all', label: 'All', count: allItems.length },
    { value: 'submitted', label: 'Submitted', count: submittedCount },
    { value: 'published', label: 'Published', count: publishedCount },
    { value: 'rejected', label: 'Rejected', count: rejectedCount },
  ];

  return (
    <section className='w-full space-y-6'>
      <PageHeader
        title='Department Head Dashboard'
        description='Review and publish professor schedule preferences for your department.'
      />

      <SegmentedControl
        label='Dashboard sections'
        options={viewOptions}
        value={view}
        onChange={(next) =>
          navigate(next === 'assignments' ? '/department-head/assignments' : '/department-head')
        }
        className='w-fit'
      />

      {view === 'assignments' ? (
        <DepartmentCreateAssignment />
      ) : (
        <>
          <div className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
            <StatCard
              icon={Clock}
              label='Pending review'
              value={submittedCount}
              hint='Submitted by professors'
            />
            <StatCard
              icon={CheckCircle}
              label='Published'
              value={publishedCount}
              hint='Ready for registrar generation'
            />
            <StatCard
              icon={XCircle}
              label='Rejected'
              value={rejectedCount}
              hint='Returned to professors'
            />
          </div>

          <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
            <div className='relative w-full sm:max-w-xs'>
              <Search
                size={16}
                aria-hidden='true'
                className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary'
              />
              <Input
                aria-label='Search submissions'
                placeholder='Search professor, subject, section'
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className='pl-9'
              />
            </div>
            <SegmentedControl
              label='Filter by status'
              options={statusOptions}
              value={statusFilter}
              onChange={setStatusFilter}
              className='w-full sm:w-auto'
            />
          </div>

          {selectedIds.length > 0 && (
            <Card className='border-apple-green-200 bg-apple-green-50'>
              <div className='flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between'>
                <span className='text-body-sm font-medium text-apple-green-800'>
                  {selectedIds.length} preference
                  {selectedIds.length !== 1 ? 's' : ''} selected
                </span>
                <div className='flex flex-wrap gap-2'>
                  <Button
                    size='sm'
                    onClick={handlePublishSelected}
                    disabled={batchMutation.isPending}
                  >
                    Publish selected
                  </Button>
                  <Button
                    size='sm'
                    variant='danger'
                    onClick={handleRejectSelected}
                    disabled={batchMutation.isPending}
                  >
                    Reject selected
                  </Button>
                  <Button
                    size='sm'
                    variant='secondary'
                    onClick={() => setSelectedIds([])}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </Card>
          )}

          <Card className='overflow-hidden'>
            {isLoading ? (
              <div className='flex flex-col items-center justify-center gap-3 py-16'>
                <div className='h-8 w-8 animate-spin rounded-full border-2 border-border border-t-apple-green-600' />
                <p className='text-body-sm text-text-secondary'>
                  Loading submissions…
                </p>
              </div>
            ) : items.length === 0 ? (
              <EmptyState
                className='py-14'
                icon={ClipboardList}
                title={
                  allItems.length === 0
                    ? 'No submissions for the active term'
                    : 'No preferences match your filters'
                }
                description={
                  allItems.length === 0
                    ? 'Professor preference submissions will appear here once professors submit their preferences for review.'
                    : 'Try a different search term or status filter.'
                }
                action={
                  allItems.length > 0 ? (
                    <Button
                      variant='secondary'
                      onClick={() => {
                        setQuery('');
                        setStatusFilter('all');
                      }}
                    >
                      Clear filters
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <TableContainer className='rounded-none border-0'>
                <Table aria-label='Professor preference submissions'>
                  <THead>
                    <TR>
                      <TH className='w-12'>
                        <input
                          ref={headerCheckboxRef}
                          type='checkbox'
                          aria-label='Select all submitted preferences'
                          checked={allSelectableSelected}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          disabled={selectableItems.length === 0}
                          className='h-4 w-4 rounded border-border-control accent-apple-green-600'
                        />
                      </TH>
                      <TH>Professor</TH>
                      <TH>Subject / Section</TH>
                      <TH>Meetings</TH>
                      <TH>Total hours</TH>
                      <TH className='w-28'>Status</TH>
                      <TH className='w-36 text-right'>Actions</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {items.map((item) => {
                      const pref = item.preference;
                      const selectable = pref.status === 'submitted';
                      return (
                        <TR key={pref.id}>
                          <TD>
                            <input
                              type='checkbox'
                              aria-label={`Select ${pref.professor_name}'s ${pref.subject_code} preference`}
                              checked={
                                selectable && selectedIds.includes(pref.id)
                              }
                              onChange={(e) =>
                                handleSelect(pref.id, e.target.checked)
                              }
                              disabled={!selectable}
                              className='h-4 w-4 rounded border-border-control accent-apple-green-600'
                            />
                          </TD>
                          <TD className='font-medium'>{pref.professor_name}</TD>
                          <TD>
                            <div className='font-medium text-text-primary'>
                              {pref.subject_code} · {pref.subject_title}
                            </div>
                            <div className='text-caption text-text-tertiary'>
                              {pref.section_name}
                            </div>
                          </TD>
                          <TD>
                            <div className='flex flex-wrap gap-1'>
                              {pref.meetings.map((meeting, index) => (
                                <Badge key={index} tone='neutral' size='sm'>
                                  {MODE_LABEL[meeting.mode] ?? meeting.mode} ·{' '}
                                  {meeting.duration_slots}h
                                </Badge>
                              ))}
                            </div>
                          </TD>
                          <TD className='font-medium'>{pref.total_duration}h</TD>
                          <TD>
                            <StatusBadge status={pref.status} />
                          </TD>
                          <TD>
                            <div className='flex items-center justify-end gap-1'>
                              <IconButton
                                label='View details'
                                size='sm'
                                onClick={() => handleOpenReview(pref)}
                                disabled={pref.status === 'draft'}
                              >
                                <Eye size={16} />
                              </IconButton>
                              {pref.status === 'submitted' && (
                                <>
                                  <IconButton
                                    label='Publish preference'
                                    size='sm'
                                    variant='primary'
                                    onClick={() => handleQuickPublish(pref)}
                                    disabled={publishMutation.isPending}
                                  >
                                    <Check size={16} />
                                  </IconButton>
                                  <IconButton
                                    label='Reject preference'
                                    size='sm'
                                    variant='danger'
                                    onClick={() =>
                                      setRejectConfirm({
                                        ids: [pref.id],
                                        label: `${pref.professor_name}'s ${pref.subject_code} preference`,
                                      })
                                    }
                                    disabled={batchMutation.isPending}
                                  >
                                    <X size={16} />
                                  </IconButton>
                                </>
                              )}
                            </div>
                          </TD>
                        </TR>
                      );
                    })}
                  </TBody>
                </Table>
              </TableContainer>
            )}
          </Card>
        </>
      )}

      <Modal
        open={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        title='Review preference'
        description='Confirm the details before publishing or rejecting this preference.'
        size='lg'
        footer={
          <div className='flex justify-end gap-2'>
            <Button
              variant='secondary'
              onClick={() => setReviewModalOpen(false)}
              disabled={publishMutation.isPending}
            >
              Close
            </Button>
            {reviewPreference?.status === 'submitted' && (
              <Button
                variant={reviewAction === 'publish' ? 'primary' : 'danger'}
                onClick={handleReviewConfirm}
                loading={publishMutation.isPending}
              >
                {reviewAction === 'publish' ? 'Publish' : 'Reject'}
              </Button>
            )}
          </div>
        }
      >
        {reviewPreference && (
          <div className='space-y-5'>
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
              <div>
                <p className='text-caption text-text-tertiary'>Professor</p>
                <p className='text-body-sm font-medium text-text-primary'>
                  {reviewPreference.professor_name}
                </p>
              </div>
              <div>
                <p className='text-caption text-text-tertiary'>Term</p>
                <p className='text-body-sm font-medium text-text-primary'>
                  {reviewPreference.term_code}
                </p>
              </div>
              <div>
                <p className='text-caption text-text-tertiary'>Subject</p>
                <p className='text-body-sm font-medium text-text-primary'>
                  {reviewPreference.subject_code} · {reviewPreference.subject_title}
                </p>
              </div>
              <div>
                <p className='text-caption text-text-tertiary'>Section</p>
                <p className='text-body-sm font-medium text-text-primary'>
                  {reviewPreference.section_name}
                </p>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className='mb-2 text-body-sm font-medium text-text-primary'>
                Meetings
              </h4>
              <div className='space-y-2'>
                {reviewPreference.meetings.map((meeting, index) => (
                  <div
                    key={index}
                    className='rounded-control border border-border bg-surface-secondary p-3'
                  >
                    <div className='flex items-center justify-between gap-2'>
                      <span className='text-body-sm font-medium text-text-primary'>
                        {MODE_LABEL[meeting.mode] ?? meeting.mode}
                      </span>
                      <span className='text-caption text-text-tertiary'>
                        {meeting.duration_slots} hour
                        {meeting.duration_slots !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {meeting.preferred_days && meeting.preferred_days.length > 0 && (
                      <p className='mt-1 text-caption text-text-secondary'>
                        {meeting.preferred_days
                          .map((day) => DAY_LABELS[day])
                          .join(', ')}
                      </p>
                    )}
                    {meeting.preferred_start && meeting.preferred_end && (
                      <p className='text-caption text-text-secondary'>
                        {meeting.preferred_start} – {meeting.preferred_end}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {reviewPreference.status === 'submitted' ? (
              <>
                <fieldset>
                  <legend className='mb-2 block text-body-sm font-medium text-text-primary'>
                    Decision
                  </legend>
                  <div className='flex gap-5'>
                    <label className='flex cursor-pointer items-center gap-2'>
                      <input
                        type='radio'
                        name='review-action'
                        value='publish'
                        checked={reviewAction === 'publish'}
                        onChange={() => setReviewAction('publish')}
                        className='accent-apple-green-600'
                      />
                      <span className='text-body-sm text-text-primary'>Publish</span>
                    </label>
                    <label className='flex cursor-pointer items-center gap-2'>
                      <input
                        type='radio'
                        name='review-action'
                        value='reject'
                        checked={reviewAction === 'reject'}
                        onChange={() => setReviewAction('reject')}
                        className='accent-danger'
                      />
                      <span className='text-body-sm text-danger'>Reject</span>
                    </label>
                  </div>
                </fieldset>

                <TextareaField
                  id='review-notes'
                  label='Review notes'
                  hint='Optional. Shared with the professor when rejecting.'
                  rows={3}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder='Add notes for the professor…'
                />
              </>
            ) : (
              <Alert
                tone={
                  reviewPreference.status === 'published'
                    ? 'success'
                    : reviewPreference.status === 'rejected'
                      ? 'danger'
                      : 'info'
                }
                title={`This preference is ${reviewPreference.status}`}
              >
                It is no longer awaiting review, so no decision is needed.
              </Alert>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(rejectConfirm)}
        title='Reject preferences'
        message={`Reject ${rejectConfirm?.label ?? ''}? The professor will be able to revise and resubmit.`}
        confirmText='Reject'
        onCancel={() => setRejectConfirm(null)}
        onConfirm={confirmReject}
      />
    </section>
  );
}
