// pages/registrar/RegistrarCreateSchedule.tsx
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useTeachers, useAllAssignments } from '../../hooks/Schedule.hooks';
import type { TeacherListItem, CourseAssignmentDetail } from '../../types/Types';

export default function RegistrarTeacherList() {
  const {
    data: teachers,
    isLoading: teachersLoading,
    error: teachersError,
    refetch: refetchTeachers,
  } = useTeachers({ enabled: true });

  const {
    data: assignments,
    isLoading: assignmentsLoading,
    error: assignmentsError,
  } = useAllAssignments({ enabled: true });

  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');

  const loading = teachersLoading || assignmentsLoading;
  const error = teachersError || assignmentsError;

  const teacherList: TeacherListItem[] = teachers ?? [];
  const allAssignments: CourseAssignmentDetail[] = assignments ?? [];

  const filtered = useMemo(() => {
    const list = teacherList;
    const query = search.trim().toLowerCase();

    return list.filter((teacher: TeacherListItem) => {
      const searchMatch =
        query === '' ||
        teacher.full_name.toLowerCase().includes(query) ||
        teacher.username.toLowerCase().includes(query);

      const departmentMatch =
        departmentFilter === 'all' ||
        teacher.department_name.toLowerCase() === departmentFilter.toLowerCase();

      return searchMatch && departmentMatch;
    });
  }, [teacherList, search, departmentFilter]);

  // Build teacher -> assignments map
  const teacherAssignmentsMap = new Map<number, typeof allAssignments>();
  allAssignments.forEach((a) => {
    const existing = teacherAssignmentsMap.get(a.prof);
    if (existing) {
      existing.push(a);
    } else {
      teacherAssignmentsMap.set(a.prof, [a]);
    }
  });

  if (error) {
    return (
      <section className='w-full p-6'>
        <div className='rounded-lg border border-red-200 bg-red-50 p-4'>
          <p className='text-sm font-medium text-red-700 mb-2'>
            Failed to load teachers.
          </p>
          <p className='text-xs text-red-600 mb-3'>
            {error.message ?? 'Unable to load data from the API.'}
          </p>
          <button
            type='button'
            onClick={() => {
              refetchTeachers();
            }}
            className='h-10 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary transition hover:bg-surface-secondary'
          >
            Retry
          </button>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section className='w-full p-6'>
        <p className='text-sm text-text-secondary'>Loading teachers…</p>
      </section>
    );
  }

  return (
    <section className='w-full'>
      <div className='mb-5'>
        <h1 className='text-lg font-medium text-text-primary'>Teachers</h1>
        <p className='text-sm text-text-secondary'>
          {filtered.length} {filtered.length === 1 ? 'teacher' : 'teachers'}
        </p>
      </div>

      <div className='mb-4 flex flex-col gap-3 sm:flex-row'>
        <div className='relative flex-1'>
          <Search
            size={16}
            className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary'
          />
          <input
            type='search'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder='Search teachers…'
            className='h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-text-primary placeholder-text-tertiary outline-none transition focus:border-apple-green-400 focus:ring-2 focus:ring-apple-green-100'
          />
        </div>
        <select
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
          className='h-10 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary outline-none transition focus:border-apple-green-400 focus:ring-2 focus:ring-apple-green-100 sm:w-56'
        >
          <option value='all'>All Departments</option>
          {[...new Set(teacherList.map((t) => t.department_name).filter(Boolean))].map(
            (dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            )
          )}
        </select>
      </div>

      <div className='rounded-card border border-border bg-surface max-h-[calc(100vh-220px)] overflow-y-auto'>
        <table className='w-full text-sm border-collapse'>
          <thead>
            <tr className='sticky top-0 z-20 border-b border-border text-left text-text-secondary bg-surface'>
              <th scope='col' className='px-4 py-2.5 font-normal sticky top-0 z-20 bg-surface'>Full name</th>
              <th scope='col' className='px-4 py-2.5 font-normal sticky top-0 z-20 bg-surface'>Username</th>
              <th scope='col' className='px-4 py-2.5 font-normal sticky top-0 z-20 bg-surface'>Department</th>
              <th scope='col' className='px-4 py-2.5 font-normal sticky top-0 z-20 bg-surface'>Assignments</th>
            </tr>
          </thead>
          <tbody>
            <>
              {filtered.map((teacher: TeacherListItem) => {
                const teacherAssignments =
                  teacherAssignmentsMap.get(teacher.id) ?? [];
                return (
                  <tr key={teacher.id} className='border-t border-border'>
                    <td className='px-4 py-3'>
                      <Link
                        to={`/registrar/teachers/${teacher.id}`}
                        className='flex min-w-0 items-center gap-3'
                      >
                        <span className='grid h-8 w-8 shrink-0 place-items-center rounded-full bg-apple-green-50 text-[11px] font-medium text-apple-green-700'>
                          {teacher.full_name.charAt(0) || teacher.username.charAt(0)}
                        </span>
                        <span className='truncate font-medium text-text-primary'>
                          {teacher.full_name || teacher.username}
                        </span>
                      </Link>
                    </td>
                    <td className='px-4 py-3 text-text-secondary'>
                      {teacher.username}
                    </td>
                    <td className='px-4 py-3 text-text-secondary'>
                      {teacher.department_name || '—'}
                    </td>
                    <td className='px-4 py-3 text-text-secondary'>
                      {teacherAssignments.length}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr className='border-t border-border'>
                  <td
                    colSpan={4}
                    className='px-4 py-8 text-center text-sm text-text-secondary'
                  >
                    No teachers match your filters.
                  </td>
                </tr>
              )}
            </>
          </tbody>
        </table>
      </div>
    </section>
  );
}
