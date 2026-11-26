// pages/teacher/TeacherAssingmentDetailPage.tsx
import { BookOpen, CheckCircle2, Clock3 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { useCourseAssignments, useCourseComponents } from '../../hooks/Schedule.hooks';
import { useMe } from '../../hooks/useAuth';
import {
  Badge,
  Card,
  CardBody,
  EmptyState,
  LoadingState,
  PageHeader,
} from '../../components/ui';
import type { CourseComponent } from '../../types/Types';

export default function TeacherAssingmentDetailPage() {
  const { name: teacherName, 'assignment-id': assignmentIdStr } = useParams();
  const assignmentId = assignmentIdStr ? Number(assignmentIdStr) : NaN;

  const { data: user } = useMe({ enabled: true });
  const teacher = teacherName ?? user?.username ?? '';
  const teacherId = user?.professor?.id;

  const { data: assignments, isLoading } = useCourseAssignments({
    teacherId,
    enabled: !!teacherId,
  });
  const resolvedAssignments = assignments ?? [];

  const assignment = resolvedAssignments.find(
    (candidate) => candidate.id === assignmentId
  );

  const { data: components } = useCourseComponents({
    enabled: !!assignment?.subject,
  });

  const resolvedComponents =
    components?.filter(
      (component: CourseComponent) =>
        component.course.id === assignment?.subject
    ) ?? [];

  if (isLoading) {
    return (
      <section className='w-full max-w-3xl space-y-6'>
        <PageHeader
          eyebrow='Teacher'
          title='Loading assignment…'
          backTo={`/teacher/${teacher}/assignments`}
          backLabel='Back to my assignments'
        />
        <LoadingState label='Loading assignment…' />
      </section>
    );
  }

  if (!assignment) {
    return (
      <section className='w-full max-w-3xl space-y-6'>
        <PageHeader
          eyebrow='Teacher'
          title='Course not found'
          backTo={`/teacher/${teacher}/assignments`}
          backLabel='Back to my assignments'
        />
        <EmptyState
          icon={BookOpen}
          title='This assignment is unavailable'
          description='It may have been removed or is no longer assigned to you.'
        />
      </section>
    );
  }

  return (
    <section className='w-full max-w-3xl space-y-6'>
      <PageHeader
        eyebrow='Teacher'
        title={assignment.subject_label}
        description={`Section ${assignment.section_name}`}
        backTo={`/teacher/${teacher}/assignments`}
        backLabel='Back to my assignments'
      />

      <Card>
        <CardBody>
          <dl className='grid gap-4 sm:grid-cols-3'>
            <div>
              <dt className='text-caption uppercase tracking-wide text-text-tertiary'>
                Section
              </dt>
              <dd className='mt-1 text-body font-medium text-text-primary'>
                {assignment.section_name}
              </dd>
            </div>
            <div>
              <dt className='text-caption uppercase tracking-wide text-text-tertiary'>
                Students
              </dt>
              <dd className='mt-1 text-body font-medium text-text-primary tabular-nums'>
                {assignment.section_headcount == null
                  ? '—'
                  : assignment.section_headcount}
              </dd>
            </div>
            <div>
              <dt className='text-caption uppercase tracking-wide text-text-tertiary'>
                Components
              </dt>
              <dd className='mt-1 text-body font-medium text-text-primary tabular-nums'>
                {resolvedComponents.length}
              </dd>
            </div>
          </dl>
        </CardBody>
      </Card>

      <section className='space-y-3'>
        <div>
          <h2 className='text-h2 text-text-primary'>Components</h2>
          <p className='text-body-sm text-text-secondary'>
            Lecture and laboratory requirements for this course.
          </p>
        </div>

        {resolvedComponents.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title='No components yet'
            description='Course components will appear here once they are configured.'
          />
        ) : (
          <div className='space-y-3'>
            {resolvedComponents.map((component) => {
              const isScheduled = Boolean(component.is_active);

              return (
                <Card key={component.id}>
                  <CardBody className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                    <div className='flex min-w-0 items-start gap-3'>
                      <span className='grid h-10 w-10 shrink-0 place-items-center rounded-control bg-apple-green-50 text-apple-green-700'>
                        {isScheduled ? (
                          <CheckCircle2 size={19} aria-hidden='true' />
                        ) : (
                          <Clock3 size={19} aria-hidden='true' />
                        )}
                      </span>
                      <div className='min-w-0'>
                        <p className='text-body font-semibold capitalize text-text-primary'>
                          {component.label}
                        </p>
                        <p className='text-body-sm text-text-secondary'>
                          {component.duration} hours
                          {component.room_type?.name
                            ? ` · ${component.room_type.name}`
                            : ''}
                        </p>
                        {!isScheduled && (
                          <p className='mt-1 text-caption text-text-tertiary'>
                            Schedules are managed by the registrar.
                          </p>
                        )}
                      </div>
                    </div>

                    <Badge tone={isScheduled ? 'success' : 'warning'}>
                      {isScheduled ? 'Scheduled' : 'Pending'}
                    </Badge>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}
