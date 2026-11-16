// pages/registrar/RegistrarCreateSchedule.tsx
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import type { TeacherListItem, CourseAssignmentDetail } from '../../types/Types';

// Example (mock) data matching backend API response structure.
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

  // Build department list from assignments (sections have program via section_name doesn't have program)
  // Since assignments are flat, we use unique section names as departments for filtering
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');

  const filtered = useMemo(() => {
    const list = teachers ?? [];
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
  }, [teachers, search, departmentFilter]);

  // Build teacher -> assignments map
  const teacherAssignmentsMap = new Map<number, typeof assignments>();
  assignments?.forEach((a) => {
    const existing = teacherAssignmentsMap.get(a.prof);
    if (existing) {
      existing.push(a);
    } else {
      teacherAssignmentsMap.set(a.prof, [a]);
    }
  });

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
          {[...new Set(teachers.map((t) => t.department_name).filter(Boolean))].map((dept) => (
            <option key={dept} value={dept}>
              {dept}
            </option>
          ))}
        </select>
      </div>

      <div className='overflow-hidden rounded-card border border-border bg-surface'>
        <table className='w-full text-sm'>
          <thead>
            <tr className='border-b border-border text-left text-text-secondary'>
              <th scope='col' className='px-4 py-2.5 font-normal'>Full name</th>
              <th scope='col' className='px-4 py-2.5 font-normal'>Username</th>
              <th scope='col' className='px-4 py-2.5 font-normal'>Department</th>
              <th scope='col' className='px-4 py-2.5 font-normal'>Assignments</th>
            </tr>
          </thead>
          <tbody>
            <>
              {filtered.map((teacher: TeacherListItem) => {
                const teacherAssignments = teacherAssignmentsMap.get(teacher.id) ?? [];
                return (
                  <tr key={teacher.id} className='border-t border-border'>
                    <td className='px-4 py-3'>
<Link
  to={`/registrar/teachers/${teacher.id}`}
  className='flex min-w-0 items-center gap-3'
                      >
                        <span className='grid h-8 w-8 shrink-0 place-items-center rounded-full bg-apple-green-50 text-[11px] font-medium text-apple-green-700'>
                          {teacher.full_name.charAt(0)}
                        </span>
                        <span className='truncate font-medium text-text-primary'>
                          {teacher.full_name}
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
