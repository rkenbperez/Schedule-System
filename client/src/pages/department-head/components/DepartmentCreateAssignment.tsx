import { useState, type FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import {
  useDepartments,
  useProfessorSubjects,
  useCreateProfessorSubject,
  useDeleteProfessorSubject,
  useProfessorsByDepartment,
  useSubjectsByDepartment,
} from '../../../hooks/Schedule.hooks';
import { ConfirmDialog } from '../../../components/shared/ConfirmDialog';
import { useToast } from '../../../hooks/useToast';

export default function DepartmentCreateAssignment() {
  const [selectedDeptId, setSelectedDeptId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    label: string;
  } | null>(null);
  const toast = useToast();

  const departments = useDepartments({ headed: 'me' });
  const deptList = departments.data ?? [];

  const effectiveDeptId = selectedDeptId ?? deptList[0]?.id ?? null;

  const professorsQuery = useProfessorsByDepartment({
    departmentId: effectiveDeptId ?? undefined,
  });
  const subjectsQuery = useSubjectsByDepartment({
    departmentId: effectiveDeptId ?? undefined,
  });
  const professorSubjectsQuery = useProfessorSubjects(
    effectiveDeptId ?? undefined
  );
  const createProfSubj = useCreateProfessorSubject(effectiveDeptId ?? 0);
  const deleteProfSubj = useDeleteProfessorSubject(effectiveDeptId ?? 0);

  const isLoadingProfessors = professorsQuery.isLoading;
  const isLoadingSubjects = subjectsQuery.isLoading;
  const professors = professorsQuery.data ?? [];
  const subjects = subjectsQuery.data ?? [];
  const assignments = professorSubjectsQuery.data ?? [];

  const closeDelete = () => setDeleteTarget(null);

  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!effectiveDeptId) return;
    const form = e.currentTarget;
    const formData = new FormData(form);
    const professorId = Number(formData.get('professor_id'));
    const subjectId = Number(formData.get('subject_id'));

    try {
      await createProfSubj.mutateAsync({
        professor_id: professorId,
        subject_id: subjectId,
        is_preferred: false,
      });
      toast.addToast({ type: 'success', title: 'Assignment created.' });
      form.reset();
    } catch {
      toast.addToast({ type: 'error', title: 'Failed to create assignment.' });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !effectiveDeptId) return;

    try {
      await deleteProfSubj.mutateAsync(deleteTarget.id);
      toast.addToast({ type: 'success', title: 'Assignment deleted.' });
    } catch {
      toast.addToast({ type: 'error', title: 'Failed to delete assignment.' });
    }
    setDeleteTarget(null);
  };

  const currentDept = deptList.find((d) => d.id === effectiveDeptId);

  if (departments.isLoading) {
    return (
      <section className='w-full space-y-6'>
        <div className='text-center py-12 text-text-secondary'>
          Loading departments…
        </div>
      </section>
    );
  }

  if (departments.isError) {
    return (
      <section className='w-full space-y-6'>
        <div className='text-center py-12'>
          <h2 className='text-xl font-medium text-text-primary'>
            Unable to load departments
          </h2>
          <p className='text-text-secondary mt-2'>
            Please try again later.
          </p>
        </div>
      </section>
    );
  }

  if (deptList.length === 0) {
    return (
      <section className='w-full space-y-6'>
        <div className='text-center py-12'>
          <h2 className='text-xl font-medium text-text-primary'>
            No department assigned
          </h2>
          <p className='text-text-secondary mt-2'>
            You are not assigned as head of any department.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className='w-full space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-lg font-medium text-text-primary'>
            {currentDept?.name} Department
          </h2>
          <p className='text-body-sm text-text-secondary mt-1'>
            Manage professor–subject assignments
          </p>
        </div>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-2'>
        {/* Left: Current Assignments */}
        <div className='space-y-4 flex flex-col items-center gap-4 px-4 lg:px-8'>
          <div className='rounded-card border border-border bg-surface p-4 w-full'>
            <div className='flex items-center justify-between mb-3'>
              <h3 className='text-xs font-medium text-text-secondary uppercase tracking-wider'>
                Current Assignments
              </h3>
            </div>
            <div className='overflow-y-auto max-h-[calc(100vh-28rem)] border border-border rounded-lg'>
              <table className='w-full text-xs border-collapse'>
                <thead className='sticky top-0 z-10 bg-surface'>
                  <tr className='border-b border-border text-left text-[10px] text-text-secondary uppercase'>
                    <th className='px-3 py-2'>Professor</th>
                    <th className='px-3 py-2'>Subject</th>
                    <th className='px-3 py-2 text-right'>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className='px-3 py-8 text-center text-text-secondary'
                      >
                        No assignments found.
                      </td>
                    </tr>
                  ) : (
                    assignments.map((ps) => (
                      <tr
                        key={ps.id}
                        className='border-b border-border-light hover:bg-surface-secondary'
                      >
                        <td className='px-3 py-1 text-text-primary truncate'>
                          {ps.professor_name}
                        </td>
                        <td className='px-3 py-1 text-text-secondary truncate'>
                          {ps.subject_code} – {ps.subject_title}
                        </td>
                        <td className='px-3 py-1 text-right'>
                          <button
                            type='button'
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget({
                                id: ps.id,
                                label: ps.subject_title,
                              });
                            }}
                            className='w-7 h-7 rounded border border-red-200 bg-red-50 text-red-600 flex items-center justify-center text-[9px] transition hover:bg-red-100 hover:text-red-700'
                            title='Delete'
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: Add Assignment */}
        <div className='space-y-4'>
          <div className='rounded-card border border-border bg-surface p-4'>
            <div className='flex flex-col gap-3'>
              <h3 className='text-xs font-medium text-text-secondary uppercase tracking-wider'>
                Add Assignment
              </h3>
              <div className='flex flex-col gap-2'>
                <label className='text-xs font-medium text-text-secondary'>
                  Department
                </label>
                <select
                  value={String(effectiveDeptId ?? '')}
                  onChange={(e) => {
                    const id = Number(e.target.value) || null;
                    setSelectedDeptId(id);
                  }}
                  className='h-9 rounded-lg border border-border bg-surface px-2 text-xs text-text-primary outline-none focus:border-apple-green-400'
                >
                  {deptList.map((d) => (
                    <option key={d.id} value={String(d.id)}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <form onSubmit={handleSave} className='flex flex-col gap-2'>
                <div className='flex flex-col gap-1.5'>
                  <label className='text-xs font-medium text-text-secondary'>
                    Professor
                  </label>
                  {isLoadingProfessors ? (
                    <div className='h-9 rounded-lg border border-border bg-surface px-2 flex items-center text-[10px] text-text-tertiary animate-pulse'>
                      Loading professors…
                    </div>
                  ) : (
                    <select
                      name='professor_id'
                      className='h-9 rounded-lg border border-border bg-surface px-2 text-xs text-text-primary outline-none focus:border-apple-green-400'
                      required
                      disabled={!professors || professors.length === 0}
                    >
                      <option value=''>Select professor</option>
                      {professors.map((t) => (
                        <option key={t.id} value={String(t.id)}>
                          {t.full_name} ({t.username})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className='flex flex-col gap-1.5'>
                  <label className='text-xs font-medium text-text-secondary'>
                    Subject
                  </label>
                  {isLoadingSubjects ? (
                    <div className='h-9 rounded-lg border border-border bg-surface px-2 flex items-center text-[10px] text-text-tertiary animate-pulse'>
                      Loading subjects…
                    </div>
                  ) : (
                    <select
                      name='subject_id'
                      className='h-9 rounded-lg border border-border bg-surface px-2 text-xs text-text-primary outline-none focus:border-apple-green-400'
                      required
                      disabled={!subjects || subjects.length === 0}
                    >
                      <option value=''>Select subject</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={String(s.id)}>
                          {s.code} – {s.title}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <button
                  type='submit'
                  disabled={
                    createProfSubj.isPending ||
                    !effectiveDeptId ||
                    isLoadingProfessors ||
                    isLoadingSubjects ||
                    professors.length === 0 ||
                    subjects.length === 0
                  }
                  className='h-9 rounded-lg bg-apple-green-600 px-3 text-xs font-medium text-white transition hover:bg-apple-green-700 disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  {createProfSubj.isPending ? 'Saving…' : 'Save'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onCancel={closeDelete}
        title='Delete Assignment'
        message='Are you sure you want to delete this assignment?'
        onConfirm={handleDelete}
        confirmText='Delete'
      />
    </section>
  );
}
