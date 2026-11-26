import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Clock, CheckCircle, XCircle, Eye, Check, X, ClipboardList } from 'lucide-react';
import { useDepartmentHeadSubmissions, usePublishPreference, useBatchPublishPreferences } from '../../hooks/Professor.hooks';
import type { ProfessorPreferenceListItem } from '../../types/Types';
import {
  Card,
  Badge,
  Button,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  Modal,
  StatCard,
  Separator,
  Tooltip,
  EmptyState,
} from '../../components/ui';
import { cn } from '../../lib/cn';
import DepartmentCreateAssignment from './components/DepartmentCreateAssignment';

function StatusBadge({ status }: { status: string }) {
  const config = {
    draft: { tone: 'neutral' as const, label: 'Draft' },
    submitted: { tone: 'warning' as const, label: 'Submitted' },
    published: { tone: 'success' as const, label: 'Published' },
    rejected: { tone: 'danger' as const, label: 'Rejected' },
    pending: { tone: 'warning' as const, label: 'Pending' },
    accepted: { tone: 'success' as const, label: 'Accepted' },
  }[status] ?? { tone: 'neutral' as const, label: status };

  return <Badge tone={config.tone} size='sm'>{config.label}</Badge>;
}

export default function DepartmentHeadDashboard() {
  const { data: submissions, isLoading, refetch } = useDepartmentHeadSubmissions({ enabled: true });
  const publishMutation = usePublishPreference();
  const batchMutation = useBatchPublishPreferences();

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewPreference, setReviewPreference] = useState<ProfessorPreferenceListItem | null>(null);
  const [reviewAction, setReviewAction] = useState<'publish' | 'reject'>('publish');
  const [reviewNotes, setReviewNotes] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  // The active tab mirrors the route so the sidebar and tabs never disagree.
  const view: 'submissions' | 'assignments' = location.pathname.endsWith(
    '/assignments'
  )
    ? 'assignments'
    : 'submissions';

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = (submissions ?? []).flatMap((s) => s.items.map((i) => i.preference.id));
      setSelectedIds(allIds);
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelect = (id: number, checked: boolean) => {
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((i) => i !== id)));
  };

  const handlePublishSelected = () => {
    if (selectedIds.length === 0) return;
    batchMutation.mutate(
      { preferenceIds: selectedIds, action: 'publish', notes: '' },
      { onSuccess: () => { refetch(); setSelectedIds([]); } }
    );
  };

  const handleRejectSelected = () => {
    if (selectedIds.length === 0) return;
    batchMutation.mutate(
      { preferenceIds: selectedIds, action: 'reject', notes: '' },
      { onSuccess: () => { refetch(); setSelectedIds([]); } }
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
          refetch();
          setReviewModalOpen(false);
          setReviewPreference(null);
        },
      }
    );
  };

  const pendingCount = (submissions ?? []).flatMap((s) => s.items.filter((i) => i.preference.status === 'submitted').length).reduce((a, b) => a + b, 0);
  const publishedCount = (submissions ?? []).flatMap((s) => s.items.filter((i) => i.preference.status === 'published').length).reduce((a, b) => a + b, 0);
  const rejectedCount = (submissions ?? []).flatMap((s) => s.items.filter((i) => i.preference.status === 'rejected').length).reduce((a, b) => a + b, 0);

  return (
    <section className='w-full space-y-6'>
      <div className='flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4'>
        <div>
          <h1 className='text-h1 text-text-primary'>Department Head Dashboard</h1>
          <p className='mt-1 text-body-sm text-text-secondary'>
            Review and publish professor schedule preferences
          </p>
        </div>
      </div>

      <div className='flex w-fit gap-1 rounded-control border border-border bg-surface p-1'>
        <button
          type='button'
          onClick={() => navigate('/department-head')}
          className={cn(
            'rounded-control px-3 py-1.5 text-body-sm font-medium transition-colors',
            view === 'submissions'
              ? 'bg-apple-green-50 text-apple-green-800'
              : 'text-text-secondary hover:text-text-primary'
          )}
        >
          Submissions
        </button>
        <button
          type='button'
          onClick={() => navigate('/department-head/assignments')}
          className={cn(
            'rounded-control px-3 py-1.5 text-body-sm font-medium transition-colors',
            view === 'assignments'
              ? 'bg-apple-green-50 text-apple-green-800'
              : 'text-text-secondary hover:text-text-primary'
          )}
        >
          Assignments
        </button>
      </div>

      {view === 'assignments' ? (
        <DepartmentCreateAssignment />
      ) : (
        <>
      <div className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
        <StatCard
          icon={Clock}
          label='Pending Review'
          value={pendingCount}
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

      {selectedIds.length > 0 && (
        <Card className='bg-apple-green-50 border-apple-green-200'>
          <div className='flex items-center justify-between'>
            <span className='text-body-sm font-medium text-apple-green-800'>
              {selectedIds.length} preference{selectedIds.length !== 1 ? 's' : ''} selected
            </span>
            <div className='flex gap-2'>
              <Button variant='primary' size='sm' onClick={handlePublishSelected} disabled={batchMutation.isPending}>
                Publish Selected
              </Button>
              <Button variant='danger' size='sm' onClick={handleRejectSelected} disabled={batchMutation.isPending}>
                Reject Selected
              </Button>
              <Button variant='secondary' size='sm' onClick={() => setSelectedIds([])}>
                Clear
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card>
        {isLoading ? (
          <div className='p-8 text-center'>
            <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-apple-green-600 mx-auto' />
            <p className='mt-4 text-text-secondary'>Loading submissions...</p>
          </div>
        ) : (
          <>
            <Table>
              <THead>
                <TR>
                  <TH className='w-12'>
                    <input
                      type='checkbox'
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      disabled={!submissions?.length}
                    />
                  </TH>
                  <TH>Professor</TH>
                  <TH>Subject / Section</TH>
                  <TH>Meetings</TH>
                  <TH>Total Hours</TH>
                  <TH className='w-32'>Status</TH>
                  <TH className='w-48'>Actions</TH>
                </TR>
              </THead>
              <TBody>
                {submissions?.length === 0 ? (
                  <TR>
                    <TD colSpan={7}>
                      <EmptyState
                        icon={ClipboardList}
                        title='No submissions for the active term'
                        description='Professor preference submissions will appear here once professors submit their preferences for review.'
                      />
                    </TD>
                  </TR>
                ) : (
                  (submissions ?? []).flatMap((submission) =>
                    submission.items.map((item) => (
                      <TR key={item.preference.id}>
                        <TD>
                          <input
                            type='checkbox'
                            checked={selectedIds.includes(item.preference.id)}
                            onChange={(e) => handleSelect(item.preference.id, e.target.checked)}
                            disabled={item.preference.status === 'published' || item.preference.status === 'rejected'}
                          />
                        </TD>
                        <TD>
                          <div className='font-medium text-text-primary'>{item.preference.professor_name}</div>
                          <div className='text-caption text-text-tertiary'>
                            Professor
                          </div>
                        </TD>
                        <TD>
                          <div className='font-medium text-text-primary'>
                            {item.preference.subject_code} - {item.preference.subject_title}
                          </div>
                          <div className='text-caption text-text-tertiary'>
                            Section: {item.preference.section_name}
                          </div>
                        </TD>
                        <TD>
                          <div className='flex flex-wrap gap-1'>
                            {item.preference.meetings.map((m, idx) => (
                              <Badge key={idx} tone='neutral' size='sm'>
                                {m.mode} ({m.duration_slots}h)
                              </Badge>
                            ))}
                          </div>
                        </TD>
                        <TD className='font-medium'>{item.preference.total_duration}h</TD>
                        <TD>
                          <StatusBadge status={item.preference.status} />
                        </TD>
                        <TD>
                          <div className='flex items-center gap-2'>
                            {item.preference.status === 'submitted' && (
                              <>
                                <Button variant='primary' size='sm' onClick={() => publishMutation.mutate({ id: item.preference.id, action: 'publish', notes: '' }, { onSuccess: () => refetch() })} disabled={publishMutation.isPending}>
                                  <Check size={14} className='mr-1' />
                                  Publish
                                </Button>
                                <Button variant='danger' size='sm' onClick={() => publishMutation.mutate({ id: item.preference.id, action: 'reject', notes: '' }, { onSuccess: () => refetch() })} disabled={publishMutation.isPending}>
                                  <X size={14} className='mr-1' />
                                  Reject
                                </Button>
                              </>
                            )}
                            {item.preference.status === 'draft' && (
                              <Badge tone='neutral' size='sm'>Draft</Badge>
                            )}
                            {item.preference.status === 'published' && (
                              <Badge tone='success' size='sm'>
                                <CheckCircle size={12} className='mr-1' />
                                Published
                              </Badge>
                            )}
                            {item.preference.status === 'rejected' && (
                              <Badge tone='danger' size='sm'>
                                <XCircle size={12} className='mr-1' />
                                Rejected
                              </Badge>
                            )}
                            <Tooltip content='View details'>
                              <Button variant='ghost' size='sm' onClick={() => handleOpenReview(item.preference)} disabled={item.preference.status === 'draft'}>
                                <Eye size={14} />
                              </Button>
                            </Tooltip>
                          </div>
                        </TD>
                      </TR>
                    ))
                  )
                )}
              </TBody>
            </Table>
          </>
        )}
      </Card>

      <Modal
        open={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        title='Review Preference'
        size='lg'
      >
        {reviewPreference && (
          <div className='space-y-4'>
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <p className='text-caption text-text-tertiary'>Professor</p>
                <p className='font-medium'>{reviewPreference.professor_name}</p>
              </div>
              <div>
                <p className='text-caption text-text-tertiary'>Professor ID</p>
                <p className='font-medium'>{reviewPreference.professor}</p>
              </div>
              <div>
                <p className='text-caption text-text-tertiary'>Subject</p>
                <p className='font-medium'>{reviewPreference.subject_code} - {reviewPreference.subject_title}</p>
              </div>
              <div>
                <p className='text-caption text-text-tertiary'>Section</p>
                <p className='font-medium'>{reviewPreference.section_name}</p>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className='text-body-sm font-medium mb-2'>Meetings</h4>
              <div className='space-y-2'>
                {reviewPreference.meetings.map((m, idx) => (
                  <div key={idx} className='p-3 bg-surface-secondary rounded-lg text-sm'>
                    <div className='flex items-center justify-between'>
                      <span className='font-medium'>{m.mode.toUpperCase()}</span>
                      <span className='text-text-tertiary'>{m.duration_slots} hours</span>
                    </div>
                    {m.preferred_days?.length && (
                      <div className='text-caption text-text-secondary mt-1'>
                        Days: {m.preferred_days.map((d) => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][d]).join(', ')}
                      </div>
                    )}
                    {m.preferred_start && m.preferred_end && (
                      <div className='text-caption text-text-secondary'>
                        Time: {m.preferred_start} - {m.preferred_end}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div>
              <label className='block text-body-sm font-medium mb-1'>Action</label>
              <div className='flex gap-3'>
                <label className='flex items-center gap-2 cursor-pointer'>
                  <input
                    type='radio'
                    value='publish'
                    checked={reviewAction === 'publish'}
                    onChange={() => setReviewAction('publish')}
                    className='text-apple-green-600'
                  />
                  <span className='text-text-primary'>Publish</span>
                </label>
                <label className='flex items-center gap-2 cursor-pointer'>
                  <input
                    type='radio'
                    value='reject'
                    checked={reviewAction === 'reject'}
                    onChange={() => setReviewAction('reject')}
                    className='text-red-600'
                  />
                  <span className='text-text-primary'>Reject</span>
                </label>
              </div>
            </div>

            <div>
              <label htmlFor='review-notes' className='block text-body-sm font-medium mb-1'>
                Review Notes (optional)
              </label>
              <textarea
                id='review-notes'
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={3}
                className='w-full p-3 border border-border-control rounded-control text-text-primary bg-surface focus:outline-none focus:ring-2 focus:ring-apple-green-400'
                placeholder='Add notes for the professor...'
              />
            </div>

            <div className='flex justify-end gap-3 pt-4'>
              <Button variant='secondary' onClick={() => setReviewModalOpen(false)} disabled={publishMutation.isPending}>
                Cancel
              </Button>
              <Button
                variant={reviewAction === 'publish' ? 'primary' : 'danger'}
                onClick={handleReviewConfirm}
                disabled={publishMutation.isPending}
              >
                {reviewAction === 'publish' ? 'Publish' : 'Reject'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
        </>
      )}
    </section>
  );
}