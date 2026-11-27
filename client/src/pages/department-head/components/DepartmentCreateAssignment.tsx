import { useState, type FormEvent } from 'react';
import { Building2, ClipboardList, Trash2 } from 'lucide-react';
import {
  useDepartments,
  useProfessorSubjects,
  useCreateProfessorSubject,
  useDeleteProfessorSubject,
  useProfessorsByDepartment,
  useSubjectsByDepartment,
} from '../../../hooks/Schedule.hooks';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  IconButton,
  SelectField,
  Table,
  TableContainer,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '../../../components/ui';
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

    if (!professorId || !subjectId) {
      toast.addToast({
        type: 'warning',
        title: 'Select a professor and a subject.',
      });
      return;
    }

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
  const canSubmit =
    Boolean(effectiveDeptId) &&
    !isLoadingProfessors &&
    !isLoadingSubjects &&
    professors.length > 0 &&
    subjects.length > 0;

  if (departments.isLoading) {
    return (
      <Card>
        <CardBody className='flex flex-col items-center gap-3 py-14'>
          <div className='h-8 w-8 animate-spin rounded-full border-2 border-border border-t-apple-green-600' />
          <p className='text-body-sm text-text-secondary'>Loading departments…</p>
        </CardBody>
      </Card>
    );
  }

  if (departments.isError) {
    return (
      <Alert tone='danger' title='Unable to load departments'>
        Please try again later.
      </Alert>
    );
  }

  if (deptList.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title='No department assigned'
        description='You are not assigned as head of any department.'
      />
    );
  }

  return (
    <section className='w-full space-y-6'>
      <div>
        <h2 className='text-h3 text-text-primary'>
          {currentDept?.name ?? 'Department'} assignments
        </h2>
        <p className='mt-1 text-body-sm text-text-secondary'>
          Manage professor–subject qualifications for your department.
        </p>
      </div>

      <div className='grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]'>
        <Card className='flex min-w-0 flex-col'>
          <CardHeader>
            <div>
              <CardTitle>Current assignments</CardTitle>
              <p className='mt-1 text-body-sm text-text-secondary'>
                {assignments.length} assignment
                {assignments.length !== 1 ? 's' : ''} on record
              </p>
            </div>
          </CardHeader>

          {assignments.length === 0 ? (
            <EmptyState
              className='py-14'
              icon={ClipboardList}
              title='No assignments yet'
              description='Add a professor–subject assignment using the form.'
            />
          ) : (
            <div className='max-h-[28rem] overflow-y-auto'>
              <TableContainer className='rounded-none border-0'>
                <Table aria-label='Current professor assignments'>
                  <THead>
                    <TR>
                      <TH>Professor</TH>
                      <TH>Subject</TH>
                      <TH className='w-16 text-right'>Action</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {assignments.map((assignment) => (
                      <TR key={assignment.id}>
                        <TD className='font-medium'>
                          {assignment.professor_name}
                        </TD>
                        <TD>
                          <div className='font-medium text-text-primary'>
                            {assignment.subject_code}
                          </div>
                          <div className='text-caption text-text-tertiary'>
                            {assignment.subject_title}
                          </div>
                        </TD>
                        <TD>
                          <div className='flex justify-end'>
                            <IconButton
                              label={`Delete assignment for ${assignment.professor_name}`}
                              variant='ghost'
                              size='sm'
                              className='text-text-tertiary hover:text-danger'
                              onClick={() =>
                                setDeleteTarget({
                                  id: assignment.id,
                                  label: `${assignment.professor_name} · ${assignment.subject_code}`,
                                })
                              }
                            >
                              <Trash2 size={16} />
                            </IconButton>
                          </div>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TableContainer>
            </div>
          )}
        </Card>

        <Card className='h-fit'>
          <CardHeader>
            <div>
              <CardTitle>Add assignment</CardTitle>
              <p className='mt-1 text-body-sm text-text-secondary'>
                Link a professor to a subject they can teach.
              </p>
            </div>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleSave} className='space-y-4'>
              <SelectField
                id='assignment-department'
                label='Department'
                value={String(effectiveDeptId ?? '')}
                onChange={(e) => {
                  const id = Number(e.target.value) || null;
                  setSelectedDeptId(id);
                }}
              >
                {deptList.map((dept) => (
                  <option key={dept.id} value={String(dept.id)}>
                    {dept.name}
                  </option>
                ))}
              </SelectField>

              <SelectField
                id='assignment-professor'
                name='professor_id'
                label='Professor'
                required
                disabled={isLoadingProfessors || professors.length === 0}
                hint={
                  isLoadingProfessors
                    ? 'Loading professors…'
                    : professors.length === 0
                      ? 'No professors available for this department.'
                      : undefined
                }
                defaultValue=''
              >
                <option value=''>Select professor</option>
                {professors.map((professor) => (
                  <option key={professor.id} value={String(professor.id)}>
                    {professor.full_name} ({professor.username})
                  </option>
                ))}
              </SelectField>

              <SelectField
                id='assignment-subject'
                name='subject_id'
                label='Subject'
                required
                disabled={isLoadingSubjects || subjects.length === 0}
                hint={
                  isLoadingSubjects
                    ? 'Loading subjects…'
                    : subjects.length === 0
                      ? 'No subjects available for this department.'
                      : undefined
                }
                defaultValue=''
              >
                <option value=''>Select subject</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={String(subject.id)}>
                    {subject.code} – {subject.title}
                  </option>
                ))}
              </SelectField>

              <Button
                type='submit'
                className='w-full'
                loading={createProfSubj.isPending}
                disabled={!canSubmit}
              >
                Save assignment
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onCancel={closeDelete}
        title='Delete assignment'
        message={`Delete the assignment for ${deleteTarget?.label ?? 'this professor'}? This cannot be undone.`}
        onConfirm={handleDelete}
        confirmText='Delete'
      />
    </section>
  );
}
