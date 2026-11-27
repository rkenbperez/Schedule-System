import { useState } from 'react';
import {
  BookOpen,
  CheckCircle,
  Clock,
  Plus,
  Send,
} from 'lucide-react';
import { useProfessorPreferences } from '../../hooks/Professor.hooks';
import ProfessorAvailabilityGrid from './components/ProfessorAvailabilityGrid';
import ProfessorCoursePreferenceForm from './components/ProfessorCoursePreferenceForm';
import {
  Alert,
  Button,
  EmptyState,
  PageHeader,
  SegmentedControl,
  StatCard,
  type SegmentedOption,
} from '../../components/ui';

type Tab = 'availability' | 'preferences' | 'submission';

export default function ProfessorPreferenceDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('availability');
  const { data: preferences, isLoading, refetch } = useProfessorPreferences({ enabled: true });

  const totalCount = preferences?.length ?? 0;
  const draftCount = preferences?.filter((p) => p.status === 'draft').length ?? 0;
  const submittedCount = preferences?.filter((p) => p.status === 'submitted').length ?? 0;
  const publishedCount = preferences?.filter((p) => p.status === 'published').length ?? 0;
  const rejectedCount = preferences?.filter((p) => p.status === 'rejected').length ?? 0;

  const tabs: SegmentedOption<Tab>[] = [
    { value: 'availability', label: 'Availability' },
    { value: 'preferences', label: 'Course Preferences', count: totalCount },
    {
      value: 'submission',
      label: 'Submission',
      count: submittedCount + publishedCount + rejectedCount,
    },
  ];

  const header = (
    <PageHeader
      title='Schedule Preferences'
      description='Manage your availability and course preferences for the active term.'
    />
  );

  if (isLoading) {
    return (
      <section className='w-full space-y-6'>
        {header}
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4'>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className='h-[104px] animate-pulse rounded-card border border-border bg-surface-secondary'
            />
          ))}
        </div>
        <div className='h-10 w-full animate-pulse rounded-control bg-surface-secondary sm:w-96' />
        <div className='h-72 animate-pulse rounded-card border border-border bg-surface-secondary' />
      </section>
    );
  }

  return (
    <section className='w-full space-y-6'>
      {header}

      <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4'>
        <StatCard
          label='Total Preferences'
          value={totalCount}
          hint='Across all subjects'
          icon={BookOpen}
        />
        <StatCard
          label='Draft'
          value={draftCount}
          hint={draftCount > 0 ? 'Ready to submit' : 'Nothing pending'}
          icon={Clock}
        />
        <StatCard
          label='Submitted'
          value={submittedCount}
          hint='Awaiting department head review'
          icon={Send}
        />
        <StatCard
          label='Published'
          value={publishedCount}
          hint='Used for schedule generation'
          icon={CheckCircle}
        />
      </div>

      <SegmentedControl
        label='Preference sections'
        options={tabs}
        value={activeTab}
        onChange={setActiveTab}
        className='w-full sm:w-fit'
      />

      {activeTab === 'availability' && (
        <ProfessorAvailabilityGrid onChange={() => refetch()} />
      )}

      {activeTab === 'preferences' && (
        <ProfessorCoursePreferenceForm onChange={() => refetch()} />
      )}

      {activeTab === 'submission' && (
        <div className='space-y-3'>
          {totalCount === 0 ? (
            <EmptyState
              icon={BookOpen}
              title='No preferences yet'
              description='Create your availability and course preferences to help the registrar build a schedule that works for you.'
              action={
                <Button
                  onClick={() => setActiveTab('availability')}
                  icon={<Plus size={16} />}
                >
                  Set up availability
                </Button>
              }
            />
          ) : (
            <>
              {draftCount > 0 && (
                <Alert
                  tone='warning'
                  title='Draft preferences need submission'
                  action={
                    <Button
                      size='sm'
                      variant='secondary'
                      onClick={() => setActiveTab('preferences')}
                    >
                      Review drafts
                    </Button>
                  }
                >
                  You have {draftCount} draft preference{draftCount !== 1 ? 's' : ''} that
                  have not been submitted for review yet.
                </Alert>
              )}

              {submittedCount > 0 && (
                <Alert tone='info' title={`${submittedCount} preference${submittedCount !== 1 ? 's' : ''} under review`}>
                  Your department head is currently reviewing these submissions.
                </Alert>
              )}

              {publishedCount > 0 && (
                <Alert tone='success' title={`${publishedCount} preference${publishedCount !== 1 ? 's' : ''} published`}>
                  Published preferences are used when the registrar generates the schedule.
                </Alert>
              )}

              {rejectedCount > 0 && (
                <Alert tone='danger' title={`${rejectedCount} preference${rejectedCount !== 1 ? 's' : ''} rejected`}>
                  Review the feedback from your department head and update your preferences.
                </Alert>
              )}

              {draftCount === 0 && submittedCount === 0 && rejectedCount === 0 && (
                <Alert tone='success' title='All caught up'>
                  Every preference has been published. There is nothing waiting for
                  submission or review.
                </Alert>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
