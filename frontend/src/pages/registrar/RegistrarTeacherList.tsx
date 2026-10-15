import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Search } from 'lucide-react';
import { useTeacherList } from '../../hooks/Registrar.hooks';
import { initialTeachers } from './registrarData';

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  return (
    parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')
  ).toUpperCase();
}

export default function RegistrarTeacherList() {
  //const { data, isLoading, isError } = useTeacherList();
  const isLoading = false;
  const isError = false;

  //chang the data in useMemo this is for sample only
  const teachers = useMemo(() => initialTeachers, [initialTeachers]);

  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('all');

  const departments = useMemo(() => {
    const names = teachers
      .map((t) => t.department_name)
      .filter((name): name is string => Boolean(name));

    return Array.from(new Set(names)).sort();
  }, [teachers]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return teachers.filter((teacher) => {
      const departmentMatch =
        department === 'all' || department === teacher.department_name;

      const searchMatch =
        query === '' || teacher.full_name.toLowerCase().includes(query);

      return departmentMatch && searchMatch;
    });
  }, [teachers, search, department]);

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
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className='h-10 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary outline-none transition focus:border-apple-green-400 focus:ring-2 focus:ring-apple-green-100 sm:w-56'
        >
          <option value='all'>All departments</option>
          {departments.map((dept) => (
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
              <th scope='col' className='px-4 py-2.5 font-normal'>
                Full name
              </th>
              <th scope='col' className='px-4 py-2.5 font-normal'>
                Employee no.
              </th>
              <th scope='col' className='px-4 py-2.5 font-normal'>
                Department
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr className='border-t border-border'>
                <td colSpan={3} className='px-4 py-8'>
                  <div className='flex items-center justify-center gap-2 text-sm text-text-secondary'>
                    <Loader2 size={16} className='animate-spin' />
                    Loading teachers…
                  </div>
                </td>
              </tr>
            ) : isError ? (
              <tr className='border-t border-border'>
                <td
                  colSpan={3}
                  className='px-4 py-8 text-center text-sm text-text-secondary'
                >
                  Unable to load teachers.
                </td>
              </tr>
            ) : (
              <>
                {filtered.map((teacher) => (
                  <tr key={teacher.id} className='border-t border-border'>
                    <td className='px-4 py-3'>
                      <Link
                        to={`/teacher-assigment/${teacher.id}`}
                        className='flex min-w-0 items-center gap-3'
                      >
                        <span className='grid h-8 w-8 shrink-0 place-items-center rounded-full bg-apple-green-50 text-[11px] font-medium text-apple-green-700'>
                          {initialsOf(teacher.full_name)}
                        </span>
                        <span className='truncate font-medium text-text-primary'>
                          {teacher.full_name}
                        </span>
                      </Link>
                    </td>
                    <td className='px-4 py-3 text-text-secondary'>
                      {teacher.employee_no || '—'}
                    </td>
                    <td className='px-4 py-3 text-text-secondary'>
                      {teacher.department_name || '—'}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr className='border-t border-border'>
                    <td
                      colSpan={3}
                      className='px-4 py-8 text-center text-sm text-text-secondary'
                    >
                      No teachers match your filters.
                    </td>
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
