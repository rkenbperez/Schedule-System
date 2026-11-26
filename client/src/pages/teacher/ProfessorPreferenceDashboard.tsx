import { useState } from 'react';
import { Clock, BookOpen, Send, AlertCircle, CheckCircle, XCircle, Plus, ArrowRight } from 'lucide-react';
import { useProfessorPreferences } from '../../hooks/Professor.hooks';
import type { ProfessorPreference } from '../../types/Types';
import ProfessorAvailabilityGrid from './components/ProfessorAvailabilityGrid';
import ProfessorCoursePreferenceForm from './components/ProfessorCoursePreferenceForm';
import {
  Card,
  Badge,
  Button,
  StatCard,
} from '../../components/ui';

function StatusBadge({ status, count }: { status: ProfessorPreference['status']; count: number }) {
  const config = {
    draft: { tone: 'neutral' as const, icon: null, label: 'Draft', color: 'text-text-tertiary' },
    submitted: { tone: 'warning' as const, icon: Clock, label: 'Submitted', color: 'text-warning' },
    published: { tone: 'success' as const, icon: CheckCircle, label: 'Published', color: 'text-success' },
    rejected: { tone: 'danger' as const, icon: XCircle, label: 'Rejected', color: 'text-danger' },
  }[status];

  return (
    <Badge tone={config.tone} size='sm' className='gap-1.5 flex items-center'>
      {config.icon && <config.icon size={12} className={config.color} />}
      <span className='font-medium'>{config.label}</span>
      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${config.tone === 'neutral' ? 'bg-surface-secondary' : `bg-${config.tone.replace('danger', 'red')}-100 text-${config.tone.replace('danger', 'red')}-700`}`}>
        {count}
      </span>
    </Badge>
  );
}

function EmptyStateCard({ icon, title, description, action }: { icon: React.ReactNode; title: string; description: string; action?: React.ReactNode }) {
  return (
    <Card className='border-border-light bg-surface/50'>
      <div className='flex flex-col items-center text-center py-10 px-6'>
        <div className='flex h-14 w-14 items-center justify-center rounded-full bg-surface-secondary mb-4'>
          {icon}
        </div>
        <h3 className='text-h3 text-text-primary mb-2'>{title}</h3>
        <p className='text-body-sm text-text-secondary max-w-xs mb-6'>{description}</p>
        {action && <div className='w-full max-w-xs'>{action}</div>}
      </div>
    </Card>
  );
}

function StatusCard({ icon, count, label, color, description }: { icon: React.ReactNode; count: number; label: string; color: string; description: string }) {
  return (
    <Card className={`border-l-4 ${color}`}>
      <div className='flex items-start gap-3'>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color.replace('border-l', 'bg').replace('l-4', '')}10`}>
          {icon}
        </div>
        <div className='flex-1 min-w-0'>
          <p className='text-h2 font-bold text-text-primary'>{count}</p>
          <p className='text-caption text-text-secondary mt-0.5'>{label}</p>
          <p className='text-caption text-text-tertiary mt-1'>{description}</p>
        </div>
      </div>
    </Card>
  );
}

export default function ProfessorPreferenceDashboard() {
  const [activeTab, setActiveTab] = useState<'availability' | 'preferences' | 'submission'>('availability');
  const { data: preferences, isLoading, refetch } = useProfessorPreferences({ enabled: true });

  const draftCount = preferences?.filter((p) => p.status === 'draft').length ?? 0;
  const submittedCount = preferences?.filter((p) => p.status === 'submitted').length ?? 0;
  const publishedCount = preferences?.filter((p) => p.status === 'published').length ?? 0;
  const rejectedCount = preferences?.filter((p) => p.status === 'rejected').length ?? 0;

  const canSubmit = draftCount > 0;

  const tabs = [
    { id: 'availability', label: 'Availability', icon: <Clock size={16} />, count: 0 },
    { id: 'preferences', label: 'Course Preferences', icon: <BookOpen size={16} />, count: preferences?.length ?? 0 },
    { id: 'submission', label: 'Submission', icon: <Send size={16} />, count: submittedCount + publishedCount + rejectedCount },
  ] as const;

  if (isLoading) {
    return (
      <section className='w-full space-y-6'>
        <div className='flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4'>
          <div>
            <h1 className='text-h1 text-text-primary'>Schedule Preferences</h1>
            <p className='mt-1 text-body-sm text-text-secondary'>Manage your availability and course preferences for the active term</p>
          </div>
        </div>
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4'>
          {[1,2,3,4].map(i => <StatCard key={i} icon={BookOpen} label='Loading' value='—' hint='' />)}
        </div>
        <div className='animate-pulse space-y-4'>
          <div className='h-8 bg-surface-secondary rounded-lg w-1/3' />
          <div className='h-64 bg-surface-secondary rounded-lg' />
        </div>
      </section>
    );
  }

  return (
    <section className='w-full space-y-6'>
      <div className='flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4'>
        <div>
          <h1 className='text-h1 text-text-primary'>Schedule Preferences</h1>
          <p className='mt-1 text-body-sm text-text-secondary'>Manage your availability and course preferences for the active term</p>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <StatusBadge status='draft' count={draftCount} />
          <StatusBadge status='submitted' count={submittedCount} />
          <StatusBadge status='published' count={publishedCount} />
          <StatusBadge status='rejected' count={rejectedCount} />
        </div>
      </div>

      <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4'>
        <StatusCard icon={<BookOpen size={20} className='text-primary' />} count={preferences?.length ?? 0} label='Total Preferences' color='border-l-primary' description='Across all subjects' />
        <StatusCard icon={<Clock size={20} className='text-warning' />} count={draftCount} label='Draft' color='border-l-warning' description={canSubmit ? 'Ready to submit' : 'All submitted'} />
        <StatusCard icon={<Send size={20} className='text-info' />} count={submittedCount} label='Submitted' color='border-l-info' description='Awaiting department head review' />
        <StatusCard icon={<CheckCircle size={20} className='text-success' />} count={publishedCount} label='Published' color='border-l-success' description='Used for schedule generation' />
      </div>

      <div className='space-y-4'>
        <div className='flex gap-1 p-1 bg-surface-secondary rounded-lg' role='tablist' aria-label='Preference sections'>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role='tab'
              aria-selected={activeTab === tab.id}
              aria-controls={`panel-${tab.id}`}
              id={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-body-sm font-medium rounded-md transition-all focus:outline-none focus:ring-2 focus:ring-apple-green-500 focus:ring-offset-2 ${
                activeTab === tab.id
                  ? 'bg-white shadow-sm text-text-primary'
                  : 'hover:bg-surface-tertiary hover:text-text-primary text-text-secondary'
              }`}
            >
              <span className='flex items-center gap-2'>
                {tab.icon}
                <span className='hidden sm:inline'>{tab.label}</span>
              </span>
              {tab.count > 0 && (
                <span className='text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-surface-secondary text-text-tertiary'>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div id="panel-availability" role="tabpanel" aria-labelledby="tab-availability" hidden={activeTab !== 'availability'} className='animate-in fade-in-200'>
          <ProfessorAvailabilityGrid onChange={() => refetch()} />
        </div>

        <div id="panel-preferences" role="tabpanel" aria-labelledby="tab-preferences" hidden={activeTab !== 'preferences'} className='animate-in fade-in-200'>
          <ProfessorCoursePreferenceForm onChange={() => refetch()} />
        </div>

        <div id="panel-submission" role="tabpanel" aria-labelledby="tab-submission" hidden={activeTab !== 'submission'} className='animate-in fade-in-200 space-y-4'>
          {draftCount > 0 ? (
            <Card className='border-warning bg-warning/5'>
              <div className='flex items-start gap-3'>
                <div className='flex-shrink-0 mt-0.5'>
                  <AlertCircle className='text-warning' size={24} />
                </div>
                <div className='flex-1'>
                  <h3 className='text-h3 text-text-primary'>Draft Preferences Need Submission</h3>
                  <p className='text-body-sm text-text-secondary mt-1'>
                    You have {draftCount} draft preference{draftCount !== 1 ? 's' : ''} that need to be submitted for department head review.
                  </p>
                  <div className='mt-4'>
                    <Button variant='primary' size='lg' onClick={() => setActiveTab('preferences')}>
                      <ArrowRight size={16} className='mr-2' />
                      Go to Course Preferences
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ) : (
            <EmptyStateCard
              icon={<CheckCircle size={32} className='text-success' />}
              title='No Draft Preferences'
              description='All your preferences have been submitted or published.'
            />
          )}

          {submittedCount > 0 && (
            <Card className='border-warning bg-warning/5'>
              <div className='flex items-start gap-3'>
                <div className='flex-shrink-0 mt-0.5'>
                  <Clock className='text-warning' size={24} />
                </div>
                <div className='flex-1'>
                  <h3 className='text-h3 text-text-primary'>{submittedCount} Preference{submittedCount !== 1 ? 's' : ''} Under Review</h3>
                  <p className='text-body-sm text-text-secondary mt-1'>Department head is reviewing your submissions</p>
                </div>
                <Badge tone='warning' size='md'>Pending</Badge>
              </div>
            </Card>
          )}

          {publishedCount > 0 && (
            <Card className='border-success bg-success/5'>
              <div className='flex items-start justify-between gap-4'>
                <div className='flex items-start gap-3'>
                  <div className='flex-shrink-0 mt-0.5'>
                    <CheckCircle className='text-success' size={24} />
                  </div>
                  <div>
                    <h3 className='text-h3 text-text-primary'>{publishedCount} Preference{publishedCount !== 1 ? 's' : ''} Published</h3>
                    <p className='text-body-sm text-text-secondary mt-1'>These will be used when the registrar generates the schedule</p>
                  </div>
                </div>
                <Badge tone='success' size='md'>Published</Badge>
              </div>
            </Card>
          )}

          {rejectedCount > 0 && (
            <Card className='border-danger bg-danger/5'>
              <div className='flex items-start justify-between gap-4'>
                <div className='flex items-start gap-3'>
                  <div className='flex-shrink-0 mt-0.5'>
                    <XCircle className='text-danger' size={24} />
                  </div>
                  <div>
                    <h3 className='text-h3 text-text-primary'>{rejectedCount} Preference{rejectedCount !== 1 ? 's' : ''} Rejected</h3>
                    <p className='text-body-sm text-text-secondary mt-1'>Review feedback and update your preferences</p>
                  </div>
                </div>
                <Badge tone='danger' size='md'>Rejected</Badge>
              </div>
            </Card>
          )}

          {preferences?.length === 0 && (
            <EmptyStateCard
              icon={<BookOpen size={32} className='text-primary' />}
              title='Get Started with Preferences'
              description='Create your availability and course preferences to help the registrar build a schedule that works for you.'
              action={
                <Button variant='primary' size='lg' onClick={() => setActiveTab('availability')}>
                  <Plus size={16} className='mr-2' />
                  Set Up Availability
                </Button>
              }
            />
          )}
        </div>
      </div>
    </section>
  );
}