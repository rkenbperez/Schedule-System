import { useState } from 'react';
import { Plus, Trash2, Edit2, Search, X as XIcon } from 'lucide-react';
import {
  useDepartments,
  useProfessorSubjects,
  useCreateProfessorSubject,
  useDeleteProfessorSubject,
  useTeachers,
  useCourses,
} from '../../hooks/Schedule.hooks';
import { SlideOverDrawer } from '../../components/shared/SlideOverDrawer';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { useToast } from '../../hooks/useToast';
import type { ProfessorSubject } from '../../types/Types';

export default function DepartmentPage() {
  const [search, setSearch] = useState('');
  const [drawer, setDrawer] = useState<{
    open: boolean;
    mode: 'add' | 'edit';
    item: ProfessorSubject | null;
  }>({ open: false, mode: 'add', item: null });
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; label: string } | null>(null);
  const toast = useToast();

  const departments = useDepartments({ headed: 'me' });
  const teachers = useTeachers();
  const subjects = useCourses();

  const deptList = departments.data ?? [];
  const subjectList = subjects.data ?? [];

  const selectedDeptId = deptList[0]?.id;
  const professorSubjects = useProfessorSubjects(selectedDeptId);
  const createProfSubj = useCreateProfessorSubject(selectedDeptId);
  const deleteProfSubj = useDeleteProfessorSubject(selectedDeptId);

  const closeDrawer = () => setDrawer((d) => ({ ...d, open: false }));

  const handleDrawerSave = async (payload: Record<string, unknown>) => {
    try {
      await createProfSubj.mutateAsync({
        professor_id: Number(payload.professor_id),
        subject_id: Number(payload.subject_id),
        is_preferred: Boolean(payload.is_preferred),
      });
      toast.addToast({ type: 'success', title: 'Assignment created.' });
      closeDrawer();
    } catch {
      toast.addToast({ type: 'error', title: 'Failed to create assignment.' });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteProfSubj.mutateAsync(deleteTarget.id);
      toast.addToast({ type: 'success', title: 'Assignment deleted.' });
    } catch {
      toast.addToast({ type: 'error', title: 'Failed to delete assignment.' });
    }
    setDeleteTarget(null);
  };

  if (!departments.data?.[0]?.id) {
    return (
      <section className='w-full max-w-7xl px-6 py-6'>
        <div className='text-center py-12'>
          <h2 className='text-xl font-medium text-text-primary'>No department assigned</h2>
          <p className='text-text-secondary mt-2'>You are not assigned as head of any department.</p>
        </div>
      </section>
    );
  }

  const rows = subjectList.filter(
    (s) =>
      (s.code || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.title || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <section className='w-full max-w-7xl px-6 py-6'>
      <div className='flex items-center justify-between mb-6'>
        <div>
          <h1 className='text-lg font-medium text-text-primary'>{departments.data?.[0]?.name} Department</h1>
          <p className='text-sm text-text-secondary mt-1'>Manage professor–subject assignments</p>
        </div>
      </div>

      <div className='rounded-card border border-border bg-surface p-6'>
        <div className='flex items-center justify-between mb-4'>
          <div className='relative'>
            <Search size={14} className='absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary' />
            <input
              type='text'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder='Search subjects…'
              className='h-9 w-full pl-9 pr-4 rounded-lg border border-border bg-surface px-3 text-xs text-text-primary outline-none transition focus:border-apple-green-400 focus:ring-2 focus:ring-apple-green-100'
            />
          </div>
          <button
            type='button'
            onClick={() => setDrawer({ open: true, mode: 'add', item: null })}
            className='flex h-9 items-center justify-center gap-2 rounded-lg bg-apple-green-600 px-3 text-xs font-medium text-white transition hover:bg-apple-green-700'
          >
            <Plus size={13} />
            Add Assignment
          </button>
        </div>

        <div className='max-h-[calc(100vh-14rem)] overflow-y-scroll visible-scrollbar border border-border rounded-lg'>
          <table className='w-full text-xs border-collapse'>
            <thead className='sticky top-0 z-10 bg-surface'>
              <tr className='border-b border-border text-left text-[10px] text-text-secondary uppercase'>
                <th className='px-3 py-2'>#</th>
                <th className='px-3 py-2'>Subject</th>
                <th className='px-3 py-2'>Professor</th>
                <th className='px-3 py-2'>Preferred</th>
                <th className='px-3 py-2 text-right'>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className='px-3 py-8 text-center text-text-secondary'>
                    No assignments found.
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => {
                  const assignment = professorSubjects.data?.find((ps) => ps.subject === row.id);
                  return (
                    <tr
                      key={String(row.id ?? idx)}
                      className='border-b border-border-light hover:bg-surface-secondary'
                    >
                      <td className='px-3 py-1 text-text-tertiary'>{idx + 1}</td>
                      <td className='px-3 py-1 text-text-primary truncate'>
                        {String(row.code ?? '')} – {String(row.title ?? '')}
                      </td>
                      <td className='px-3 py-1 text-text-secondary truncate'>
                        {assignment?.professor_name ?? '—'}
                      </td>
                      <td className='px-3 py-1 text-text-secondary'>
                        {assignment?.is_preferred ? 'Yes' : 'No'}
                      </td>
                      <td className='px-3 py-1 text-right'>
                        <div className='flex items-center justify-end gap-1.5'>
                          <button
                            type='button'
                            onClick={(e) => {
                              e.stopPropagation();
                              if (assignment) {
                                setDrawer({ open: true, mode: 'edit', item: assignment });
                              }
                            }}
                            className='w-7 h-7 rounded border border-border bg-surface-secondary text-text-secondary flex items-center justify-center text-[9px] transition hover:bg-apple-green-50 hover:text-apple-green-700'
                            title='Edit'
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            type='button'
                            onClick={(e) => {
                              e.stopPropagation();
                              if (assignment) {
                                setDeleteTarget({
                                  id: assignment.id,
                                  label: String(row.code ?? ''),
                                });
                              }
                            }}
                            className='w-7 h-7 rounded border border-border bg-surface-secondary text-text-secondary flex items-center justify-center text-[9px] transition hover:bg-red-50 hover:text-red-700'
                            title='Delete'
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SlideOverDrawer isOpen={drawer.open} onClose={() => setDrawer((d) => ({ ...d, open: false }))}>
        <div className='flex shrink-0 items-center justify-between border-b border-border px-6 py-4'>
          <div>
            <h2 className='text-sm font-medium text-text-primary'>{drawer.mode === 'add' ? 'Add' : 'Edit'} Assignment</h2>
            <p className='text-xs text-text-tertiary'>Assign a professor to a subject.</p>
          </div>
          <button
            type='button'
            onClick={() => setDrawer((d) => ({ ...d, open: false }))}
            className='shrink-0 rounded-full p-1.5 text-text-tertiary transition hover:bg-surface-secondary hover:text-text-primary'
          >
            <XIcon size={16} />
          </button>
        </div>

        <div className='flex-1 overflow-y-auto p-6'>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget as HTMLFormElement;
              const formData = new FormData(form);
              const payload: Record<string, unknown> = {};
              formData.forEach((value, key) => {
                payload[key] = String(value);
              });
              handleDrawerSave(payload);
            }}
          >
            <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
              <div className='flex flex-col gap-1.5 sm:col-span-2'>
                <label className='text-xs font-medium text-text-secondary'>Subject</label>
                <select
                  name='subject_id'
                  className='h-9 rounded-lg border border-border bg-surface px-2 text-xs text-text-primary outline-none focus:border-apple-green-400'
                  required
                >
                  <option value=''>Select subject</option>
                  {subjects.data?.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.code} – {s.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className='flex flex-col gap-1.5 sm:col-span-2'>
                <label className='text-xs font-medium text-text-secondary'>Professor</label>
                <select
                  name='professor_id'
                  className='h-9 rounded-lg border border-border bg-surface px-2 text-xs text-text-primary outline-none focus:border-apple-green-400'
                  required
                >
                  <option value=''>Select professor</option>
                  {teachers.data?.map((t) => (
                    <option key={t.id} value={String(t.id)}>
                      {t.full_name} ({t.username})
                    </option>
                  ))}
                </select>
              </div>
              <div className='flex flex-col gap-1.5 sm:col-span-2'>
                <label className='text-xs font-medium text-text-secondary'>Preferred</label>
                <select
                  name='is_preferred'
                  className='h-9 rounded-lg border border-border bg-surface px-2 text-xs text-text-primary outline-none focus:border-apple-green-400'
                >
                  <option value='false'>No</option>
                  <option value='true'>Yes</option>
                </select>
              </div>
            </div>
            <div className='mt-6 flex gap-3'>
              <button
                type='button'
                onClick={() => setDrawer((d) => ({ ...d, open: false }))}
                className='flex-1 h-9 rounded-lg border border-border bg-surface-tertiary px-3 text-xs font-medium text-text-secondary transition hover:bg-surface-secondary'
              >
                Cancel
              </button>
              <button
                type='submit'
                disabled={createProfSubj.isPending}
                className='flex-1 h-9 rounded-lg bg-apple-green-600 px-3 text-xs font-medium text-white transition hover:bg-apple-green-700 disabled:opacity-50'
              >
                {createProfSubj.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </SlideOverDrawer>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        title='Delete Assignment'
        message='Are you sure you want to delete this assignment?'
        onConfirm={handleDelete}
        confirmText='Delete'
      />
    </section>
  );
}