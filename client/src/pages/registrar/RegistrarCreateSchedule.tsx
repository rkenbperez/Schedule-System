import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, Search, Users } from 'lucide-react';
import type { TeacherListItem, CourseAssignmentDetail } from '../../types/Types';
import { cn } from '../../lib/cn';
import {
  Badge,
  EmptyState,
  PageHeader,
  Table,
  TableContainer,
  TBody,
  TD,
  TH,
  THead,
  TR,
  inputClasses,
} from '../../components/ui';

const exampleTeachers: TeacherListItem[] = [
  { id: 1, username: 'angel.cruz', full_name: 'Angel Cruz', department: 1, department_name: 'BSIT' },
  { id: 2, username: 'maria.santos', full_name: 'Maria Santos', department: 1, department_name: 'BSIT' },
  { id: 3, username: 'robert.reyes', full_name: 'Robert Reyes', department: 1, department_name: 'BSIT' },
  { id: 4, username: 'elena.garcia', full_name: 'Elena Garcia', department: null, department_name: '' },
];

const exampleAssignments: CourseAssignmentDetail[] = [
  {
    id: 1,
    prof: 1,
    subject: 1,
    section: 1,
    term: 1,
    meetings: [{ id: 1, order: 1, mode: 'sync', mode_display: 'Synchronous', duration_slots: 2 }],
    prof_name: 'Angel Cruz',
    subject_label: 'COSC 7',
    section_name: '3-A',
  },
  {
    id: 2,
    prof: 1,
    subject: 1,
    section: 1,
    term: 1,
    meetings: [{ id: 2, order: 2, mode: 'lab', mode_display: 'Laboratory', duration_slots: 4 }],
    prof_name: 'Angel Cruz',
    subject_label: 'COSC 7',
    section_name: '3-A',
  },
  {
    id: 3,
    prof: 1,
    subject: 2,
    section: 2,
    term: 1,
    meetings: [{ id: 3, order: 1, mode: 'sync', mode_display: 'Synchronous', duration_slots: 2 }],
    prof_name: 'Angel Cruz',
    subject_label: 'DCIT 5',
    section_name: '2-B',
  },
  {
    id: 4,
    prof: 2,
    subject: 3,
    section: 1,
    term: 1,
    meetings: [{ id: 4, order: 1, mode: 'sync', mode_display: 'Synchronous', duration_slots: 2 }],
    prof_name: 'Maria Santos',
    subject_label: 'MATH 10',
    section_name: '3-A',
  },
  {
    id: 5,
    prof: 2,
    subject: 4,
    section: 3,
    term: 1,
    meetings: [{ id: 5, order: 1, mode: 'sync', mode_display: 'Synchronous', duration_slots: 2 }],
    prof_name: 'Maria Santos',
    subject_label: 'GNED 12',
    section_name: '1-C',
  },
  {
    id: 6,
    prof: 3,
    subject: 5,
    section: 2,
    term: 1,
    meetings: [{ id: 6, order: 1, mode: 'sync', mode_display: 'Synchronous', duration_slots: 2 }],
    prof_name: 'Robert Reyes',
    subject_label: 'PHYS 3',
    section_name: '2-B',
  },
  {
    id: 7,
    prof: 3,
    subject: 5,
    section: 2,
    term: 1,
    meetings: [{ id: 7, order: 2, mode: 'lab', mode_display: 'Laboratory', duration_slots: 4 }],
    prof_name: 'Robert Reyes',
    subject_label: 'PHYS 3',
    section_name: '2-B',
  },
];

export default function RegistrarTeacherList() {
  const teachers: TeacherListItem[] = exampleTeachers;
  const assignments: CourseAssignmentDetail[] = exampleAssignments;

  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');

  const departments = useMemo(
    () => [
      ...new Set(
        teachers.map((teacher) => teacher.department_name).filter(Boolean)
      ),
    ],
    [teachers]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return teachers.filter((teacher) => {
      const searchMatch =
        query === '' ||
        teacher.full_name.toLowerCase().includes(query) ||
        teacher.username.toLowerCase().includes(query);

      const departmentMatch =
        departmentFilter === 'all' ||
        teacher.department_name.toLowerCase() ===
          departmentFilter.toLowerCase();

      return searchMatch && departmentMatch;
    });
  }, [teachers, search, departmentFilter]);

  const teacherAssignmentsMap = new Map<number, typeof assignments>();
  assignments.forEach((assignment) => {
    const existing = teacherAssignmentsMap.get(assignment.prof);
    if (existing) {
      existing.push(assignment);
    } else {
      teacherAssignmentsMap.set(assignment.prof, [assignment]);
    }
  });

  return (
    <div className='space-y-6'>
      <PageHeader
        title='Teachers'
        description='Review teaching loads and open a teacher to manage their assignments.'
        actions={
          <Badge tone='neutral' size='md'>
            {filtered.length} of {teachers.length}
          </Badge>
        }
      />

      <div className='flex flex-col gap-3 sm:flex-row'>
        <div className='relative flex-1'>
          <label htmlFor='teacher-search' className='sr-only'>
            Search teachers
          </label>
          <Search
            size={17}
            className='pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary'
            aria-hidden='true'
          />
          <input
            id='teacher-search'
            type='search'
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder='Search by name or username…'
            className={cn(inputClasses, 'pl-10')}
          />
        </div>

        <div className='relative sm:w-60'>
          <label htmlFor='department-filter' className='sr-only'>
            Filter by department
          </label>
          <select
            id='department-filter'
            value={departmentFilter}
            onChange={(event) => setDepartmentFilter(event.target.value)}
            className={cn(inputClasses, 'appearance-none pr-10')}
          >
            <option value='all'>All departments</option>
            {departments.map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            className='pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-text-tertiary'
            aria-hidden='true'
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title='No teachers match your filters'
          description='Try a different name, username, or department.'
        />
      ) : (
        <>
          <div className='hidden md:block'>
            <TableContainer>
              <Table>
                <caption className='sr-only'>
                  Teachers, departments, and assignment counts
                </caption>
                <THead>
                  <TR>
                    <TH>Teacher</TH>
                    <TH>Username</TH>
                    <TH>Department</TH>
                    <TH>Assignments</TH>
                    <TH className='text-right'>Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {filtered.map((teacher) => {
                    const teacherAssignments =
                      teacherAssignmentsMap.get(teacher.id) ?? [];

                    return (
                      <TR key={teacher.id}>
                        <TD>
                          <Link
                            to={`/registrar/teachers/${teacher.id}`}
                            className='flex min-h-11 min-w-0 items-center gap-3 rounded-control transition-colors hover:text-apple-green-700'
                          >
                            <span className='grid h-9 w-9 shrink-0 place-items-center rounded-full bg-apple-green-50 text-body-sm font-semibold text-apple-green-700'>
                              {teacher.full_name.charAt(0)}
                            </span>
                            <span className='truncate font-medium'>
                              {teacher.full_name}
                            </span>
                          </Link>
                        </TD>
                        <TD className='text-text-secondary'>
                          {teacher.username}
                        </TD>
                        <TD className='text-text-secondary'>
                          {teacher.department_name || '—'}
                        </TD>
                        <TD>
                          <Badge tone='neutral'>
                            {teacherAssignments.length}
                          </Badge>
                        </TD>
                        <TD className='text-right'>
                          <Link
                            to={`/registrar/teachers/${teacher.id}`}
                            className='inline-flex min-h-11 items-center gap-1 rounded-control px-2 text-body-sm font-medium text-apple-green-700 transition-colors hover:bg-apple-green-50'
                          >
                            View
                            <ChevronRight size={15} aria-hidden='true' />
                          </Link>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </TableContainer>
          </div>

          <ul className='space-y-3 md:hidden'>
            {filtered.map((teacher) => {
              const teacherAssignments =
                teacherAssignmentsMap.get(teacher.id) ?? [];

              return (
                <li key={teacher.id}>
                  <Link
                    to={`/registrar/teachers/${teacher.id}`}
                    className='flex min-h-11 items-center gap-3 rounded-card border border-border bg-surface p-4 transition-colors hover:bg-surface-secondary'
                  >
                    <span className='grid h-11 w-11 shrink-0 place-items-center rounded-full bg-apple-green-50 text-body font-semibold text-apple-green-700'>
                      {teacher.full_name.charAt(0)}
                    </span>
                    <div className='min-w-0 flex-1'>
                      <p className='truncate text-body font-semibold text-text-primary'>
                        {teacher.full_name}
                      </p>
                      <p className='truncate text-body-sm text-text-secondary'>
                        {teacher.username}
                      </p>
                      <p className='mt-0.5 text-caption text-text-tertiary'>
                        {teacher.department_name || 'No department'} ·{' '}
                        {teacherAssignments.length} assignment
                        {teacherAssignments.length === 1 ? '' : 's'}
                      </p>
                    </div>
                    <ChevronRight
                      size={18}
                      className='shrink-0 text-text-tertiary'
                      aria-hidden='true'
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
