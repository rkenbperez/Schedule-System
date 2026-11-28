// pages/registrar/RegistrarMasterDataPage.tsx
// Unified master data management for the registrar: Professors, Rooms,
// Courses (Subjects) and Sections. Each tab is a searchable table with Add /
// Edit / Delete via SlideOverDrawer and ConfirmDialog.
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Edit2, Search, X as XIcon, Mail, Lock, Building2, Clock, Timer } from 'lucide-react';
import {
  useCourses,
  useDepartments,
  useRooms,
  useSections,
  useTeachers,
  useTerms,
  useUsers,
  useCreateDepartment,
  useUpdateDepartment,
  useDeleteDepartment,
  useCreateRoom,
  useUpdateRoom,
  useDeleteRoom,
  useCreateSubject,
  useUpdateSubject,
  useDeleteSubject,
  useCreateSection,
  useUpdateSection,
  useDeleteSection,
  useCreateProfessor,
  useUpdateProfessor,
  useDeleteProfessor,
} from '../../hooks/Schedule.hooks';
import { SlideOverDrawer } from '../../components/shared/SlideOverDrawer';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { useToast } from '../../hooks/useToast';
import type {
  Course,
  Department,
  Room,
  Section,
  TeacherListItem,
} from '../../types/Types';

type Tab =
  | 'Departments'
  | 'Professors'
  | 'Rooms'
  | 'Subjects'
  | 'Sections';

const TAB_SLUGS: Record<Tab, string> = {
  Departments: 'departments',
  Professors: 'professors',
  Rooms: 'rooms',
  Subjects: 'subjects',
  Sections: 'sections',
};

function tabFromSlug(value: string | null): Tab | null {
  const slug = (value ?? '').toLowerCase();
  const match = (Object.keys(TAB_SLUGS) as Tab[]).find(
    (tab) => TAB_SLUGS[tab] === slug
  );
  return match ?? null;
}

type SimpleUser = { id: number; username: string; email: string };

export default function RegistrarMasterDataPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  // Tab is derived from the URL; selecting a tab only updates the param.
  const tab: Tab = tabFromSlug(tabParam) ?? 'Professors';

  const selectTab = (next: Tab) => {
    setSearchParams({ tab: TAB_SLUGS[next] });
  };
  const [search, setSearch] = useState('');
  const [drawer, setDrawer] = useState<{
    open: boolean;
    mode: 'add' | 'edit';
    tab: Tab;
    item: Record<string, unknown> | null;
  }>({ open: false, mode: 'add', tab: 'Professors', item: null });
  const [deleteTarget, setDeleteTarget] = useState<{
    tab: Tab;
    id: number;
    label: string;
  } | null>(null);
  const toast = useToast();

  const departments = useDepartments();
  const users = useUsers();
  const teachers = useTeachers();
  const rooms = useRooms();
  const courses = useCourses();
  const sections = useSections();
  const terms = useTerms();

  const createDepartment = useCreateDepartment();
  const updateDepartment = useUpdateDepartment();
  const deleteDepartment = useDeleteDepartment();
  const createRoom = useCreateRoom();
  const updateRoom = useUpdateRoom();
  const deleteRoom = useDeleteRoom();
  const createSubject = useCreateSubject();
  const updateSubject = useUpdateSubject();
  const deleteSubject = useDeleteSubject();
  const createSection = useCreateSection();
  const updateSection = useUpdateSection();
  const deleteSection = useDeleteSection();
  const createProfessor = useCreateProfessor();
  const updateProfessor = useUpdateProfessor();
  const deleteProfessor = useDeleteProfessor();

  // ---------- derived data ----------
  const profList: TeacherListItem[] = teachers.data ?? [];
  const roomList: Room[] = rooms.data ?? [];
  const courseList: Course[] = courses.data ?? [];
  const sectionList: Section[] = sections.data ?? [];
  const deptList: Department[] = departments.data ?? [];
  const userList: SimpleUser[] = users.data ?? [];
  const termList = terms.data ?? [];

  const rows = (
    tab === 'Departments'
      ? deptList.filter((department) =>
          (department.name || '')
            .toLowerCase()
            .includes(search.toLowerCase())
        )
      : tab === 'Professors'
        ? profList.filter((p) =>
            (p.full_name || p.username || '')
              .toLowerCase()
              .includes(search.toLowerCase())
          )
        : tab === 'Rooms'
          ? roomList.filter((r) =>
              (r.name || '').toLowerCase().includes(search.toLowerCase())
            )
          : tab === 'Subjects'
            ? courseList.filter(
                (c) =>
                  (c.code || '')
                    .toLowerCase()
                    .includes(search.toLowerCase()) ||
                  (c.title || '').toLowerCase().includes(search.toLowerCase())
              )
            : sectionList.filter((s) =>
                (s.name || '').toLowerCase().includes(search.toLowerCase())
              )
  ) as unknown as Record<string, unknown>[];

  // ---------- handlers ----------
  const openAdd = () => {
    setDrawer({ open: true, mode: 'add', tab, item: null });
  };

  const openEdit = (item: Record<string, unknown>) => {
    setDrawer({ open: true, mode: 'edit', tab, item });
  };

  const closeDrawer = () => setDrawer((d) => ({ ...d, open: false }));

  const handleDrawerSave = async (payload: Record<string, unknown>) => {
    try {
      if (tab === 'Departments') {
        const head = payload.head ? Number(payload.head) : null;
        if (drawer.mode === 'add') {
          await createDepartment.mutateAsync({
            name: String(payload.name ?? ''),
            head,
          });
        } else {
          await updateDepartment.mutateAsync({
            id: Number(drawer.item!.id),
            payload: { name: String(payload.name ?? ''), head },
          });
        }
        toast.addToast({
          type: 'success',
          title: `Department ${
            drawer.mode === 'add' ? 'created' : 'updated'
          }.`,
        });
      } else if (tab === 'Professors') {
        const role = payload.role as string;
        const isRegistrar = role === 'registrar';
        const isDeptHead = role === 'department_head';
        
        const professorPayload = {
          user_email: payload.user_email as string,
          user_password: payload.user_password as string || undefined,
          user_is_staff: isRegistrar,
          department_id: payload.department_id ? Number(payload.department_id) : null,
          max_daily_hours: Number(payload.max_daily_hours) || 8,
          max_consecutive: Number(payload.max_consecutive) || 4,
          department_head: isDeptHead,
        };
        
        if (drawer.mode === 'add') {
          await createProfessor.mutateAsync(professorPayload);
        } else {
          await updateProfessor.mutateAsync({
            id: Number(drawer.item!.id),
            payload: professorPayload,
          });
        }
        toast.addToast({
          type: 'success',
          title: `Professor ${drawer.mode === 'add' ? 'created' : 'updated'}.`,
        });
      } else if (tab === 'Rooms') {
        if (drawer.mode === 'add') {
          await createRoom.mutateAsync(payload as {
            name: string;
            capacity: number;
            department?: number | null;
            building?: string;
            room_type?: string;
          });
        } else {
          await updateRoom.mutateAsync({
            id: Number(drawer.item!.id),
            payload: payload as {
              name: string;
              capacity: number;
              department: number | null;
              building: string;
              room_type: string;
            },
          });
        }
        toast.addToast({
          type: 'success',
          title: `Room ${drawer.mode === 'add' ? 'created' : 'updated'}.`,
        });
      } else if (tab === 'Subjects') {
        const subjectPayload = payload as {
          code: string;
          title: string;
          units: number;
          lec_hours: number;
          lab_hours: number;
        };
        if (drawer.mode === 'add') {
          await createSubject.mutateAsync(subjectPayload);
        } else {
          await updateSubject.mutateAsync({
            id: Number(drawer.item!.id),
            payload: subjectPayload,
          });
        }
        const mismatch =
          Number(subjectPayload.lec_hours) + Number(subjectPayload.lab_hours) !==
          Number(subjectPayload.units);
        toast.addToast({
          type: mismatch ? 'warning' : 'success',
          title: `Subject ${drawer.mode === 'add' ? 'created' : 'updated'}.`,
          description: mismatch
            ? 'Units is the reference; lec + lab differs from units.'
            : undefined,
        });
      } else if (tab === 'Sections') {
        if (drawer.mode === 'add') {
          await createSection.mutateAsync(payload as {
            name: string;
            headcount: number;
            program?: string | null;
            year_level?: number | null;
            term_id?: number | null;
          });
        } else {
          await updateSection.mutateAsync({
            id: Number(drawer.item!.id),
            payload: payload as {
              name: string;
              headcount: number;
              program: string | null;
              year_level: number | null;
              term: number | null;
            },
          });
        }
        toast.addToast({
          type: 'success',
          title: `Section ${drawer.mode === 'add' ? 'created' : 'updated'}.`,
        });
      }
      closeDrawer();
    } catch {
      toast.addToast({
        type: 'error',
        title: `Failed to ${
          drawer.mode === 'add' ? 'create' : 'update'
        } ${tab.toLowerCase()}.`,
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.tab === 'Departments') {
        await deleteDepartment.mutateAsync(deleteTarget.id);
      } else if (deleteTarget.tab === 'Professors') {
        await deleteProfessor.mutateAsync(deleteTarget.id);
      } else if (deleteTarget.tab === 'Rooms') {
        await deleteRoom.mutateAsync(deleteTarget.id);
      } else if (deleteTarget.tab === 'Subjects') {
        await deleteSubject.mutateAsync(deleteTarget.id);
      } else if (deleteTarget.tab === 'Sections') {
        await deleteSection.mutateAsync(deleteTarget.id);
      }
      toast.addToast({
        type: 'success',
        title: `${deleteTarget.label} deleted.`,
      });
    } catch {
      toast.addToast({
        type: 'error',
        title: `Failed to delete ${deleteTarget.label}.`,
      });
    }
    setDeleteTarget(null);
  };

  // ---------- render helpers ----------
  const isActive = (t: Tab) => tab === t;

  return (
    <section className='w-full max-w-7xl px-6 py-6'>
      <div className='flex items-center justify-between mb-6'>
        <div>
          <h1 className='text-lg font-medium text-text-primary'>
            Master Data
          </h1>
          <p className='text-sm text-text-secondary mt-1'>
            Manage departments, professors, rooms, subjects and sections.
          </p>
        </div>
        <div className='flex gap-2'>
          {[
            'Departments',
            'Professors',
            'Rooms',
            'Subjects',
            'Sections',
          ].map((t) => (
            <button
              key={t}
              type='button'
              onClick={() => selectTab(t as Tab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition border ${
                isActive(t as Tab)
                  ? 'bg-apple-green-100 text-apple-green-700 border-apple-green-200'
                  : 'border-transparent text-text-tertiary hover:bg-surface-secondary hover:text-text-primary'
              }`}
            >
              {t}
            </button>
          ))}
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
              placeholder={`Search ${tab.toLowerCase()}…`}
              className='h-9 w-full pl-9 pr-4 rounded-lg border border-border bg-surface px-3 text-xs text-text-primary outline-none transition focus:border-apple-green-400 focus:ring-2 focus:ring-apple-green-100'
            />
          </div>
          <button
            type='button'
            onClick={openAdd}
            className='flex h-9 items-center justify-center gap-2 rounded-lg bg-apple-green-600 px-3 text-xs font-medium text-white transition hover:bg-apple-green-700'
          >
            <Plus size={13} />
            Add {tab.slice(0, -1)}
          </button>
        </div>

        <div className='max-h-[calc(100vh-14rem)] overflow-y-scroll visible-scrollbar border border-border rounded-lg'>
          <table className='w-full text-xs border-collapse'>
            <thead className='sticky top-0 z-10 bg-surface'>
              <tr className='border-b border-border text-left text-[10px] text-text-secondary uppercase'>
                <th className='px-3 py-2'>#</th>
                {tab === 'Departments' && (
                  <>
                    <th className='px-3 py-2 whitespace-nowrap'>Name</th>
                    <th className='px-3 py-2 whitespace-nowrap'>Head</th>
                  </>
                )}
                {tab === 'Professors' && (
                  <>
                    <th className='px-3 py-2'>Name</th>
                    <th className='px-3 py-2'>Email</th>
                    <th className='px-3 py-2'>Role</th>
                    <th className='px-3 py-2'>Department</th>
                    <th className='px-3 py-2 text-right'>Max Daily</th>
                    <th className='px-3 py-2 text-right'>Max Consecutive</th>
                  </>
                )}
                {tab === 'Rooms' && (
                  <>
                    <th className='px-3 py-2'>Name</th>
                    <th className='px-3 py-2'>Capacity</th>
                    <th className='px-3 py-2'>Type</th>
                    <th className='px-3 py-2'>Department</th>
                    <th className='px-3 py-2'>Building</th>
                  </>
                )}
                {tab === 'Subjects' && (
                  <>
                    <th className='px-3 py-2'>Code</th>
                    <th className='px-3 py-2'>Title</th>
                    <th className='px-3 py-2'>Units</th>
                    <th className='px-3 py-2'>Lec hours</th>
                    <th className='px-3 py-2'>Lab hours</th>
                  </>
                )}
                {tab === 'Sections' && (
                  <>
                    <th className='px-3 py-2'>Name</th>
                    <th className='px-3 py-2'>Headcount</th>
                    <th className='px-3 py-2'>Program</th>
                    <th className='px-3 py-2'>Year level</th>
                    <th className='px-3 py-2'>Term</th>
                  </>
                )}
                <th className='px-3 py-2 text-right'>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={tab === 'Departments' ? 4 : 7}
                    className='px-3 py-8 text-center text-text-secondary'
                  >
                    No {tab.toLowerCase()} found.
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => (
                  <tr
                    key={String(row.id ?? idx)}
                    className='border-b border-border-light hover:bg-surface-secondary'
                  >
                    <td className='px-3 py-1 text-text-tertiary'>{idx + 1}</td>
                    {tab === 'Departments' && (
                      <>
                        <td className='px-3 py-1 text-text-primary truncate'>
                          {String(row.name ?? '')}
                        </td>
                        <td className='px-3 py-1 text-text-secondary truncate'>
                          {String(row.head_name || '—')}
                        </td>
                      </>
                    )}
{tab === 'Professors' && (
                      <>
                        <td className='px-3 py-1.5 text-text-primary truncate font-medium'>
                          {String(row.full_name ?? '')}
                        </td>
                        <td className='px-3 py-1.5 text-text-tertiary truncate'>
                          {String(row.email ?? '')}
                        </td>
                        <td className='px-3 py-1.5 text-text-secondary'>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-medium ${
                            row.is_staff ? 'bg-apple-green-50 text-apple-green-700' :
                            row.is_department_head ? 'bg-apple-green-50 text-apple-green-700' :
                            'bg-surface-secondary text-text-primary'
                          }`}>
                            {row.is_staff ? 'Registrar' : row.is_department_head ? 'Dept Head' : 'Professor'}
                          </span>
                        </td>
                        <td className='px-3 py-1.5 text-text-secondary truncate'>
                          {String(row.department_name ?? '—')}
                        </td>
                        <td className='px-3 py-1.5 text-text-secondary text-right font-mono'>
                          {String(row.max_daily_hours ?? '—')}
                        </td>
                        <td className='px-3 py-1.5 text-text-secondary text-right font-mono'>
                          {String(row.max_consecutive ?? '—')}
                        </td>
                      </>
                    )}
                    {tab === 'Rooms' && (
                      <>
                        <td className='px-3 py-1 text-text-primary truncate'>
                          {String(row.name ?? '')}
                        </td>
                        <td className='px-3 py-1 text-text-secondary'>
                          {String(row.capacity ?? '')}
                        </td>
                        <td className='px-3 py-1 text-text-secondary truncate'>
                          {String(row.room_type_display ?? row.room_type ?? '—')}
                        </td>
                        <td className='px-3 py-1 text-text-secondary truncate'>
                          {String(row.department_name ?? '—')}
                        </td>
                        <td className='px-3 py-1 text-text-secondary truncate'>
                          {String(row.building ?? '—')}
                        </td>
                      </>
                    )}
                    {tab === 'Subjects' && (
                      <>
                        <td className='px-3 py-1 text-text-primary truncate'>
                          {String(row.code ?? '')}
                        </td>
                        <td className='px-3 py-1 text-text-secondary truncate'>
                          {String(row.title ?? '')}
                        </td>
                        <td className='px-3 py-1 text-text-secondary'>
                          {String(row.units ?? '')}
                        </td>
                        <td className='px-3 py-1 text-text-secondary'>
                          {String(row.lec_hours ?? '')}
                        </td>
                        <td className='px-3 py-1 text-text-secondary'>
                          {String(row.lab_hours ?? '')}
                        </td>
                      </>
                    )}
                    {tab === 'Sections' && (
                      <>
                        <td className='px-3 py-1 text-text-primary truncate'>
                          {String(row.name ?? '')}
                        </td>
                        <td className='px-3 py-1 text-text-secondary'>
                          {String(row.headcount ?? '')}
                        </td>
                        <td className='px-3 py-1 text-text-secondary truncate'>
                          {String(row.program ?? '—')}
                        </td>
                        <td className='px-3 py-1 text-text-secondary'>
                          {String(row.year_level ?? '—')}
                        </td>
                        <td className='px-3 py-1 text-text-secondary'>
                          {termList.find((term) => term.id === Number(row.term))?.name ?? String(row.term ?? '—')}
                        </td>
                      </>
                    )}
                    <td className='px-3 py-1 text-right'>
                      <div className='flex items-center justify-end gap-1.5'>
                        <button
                          type='button'
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(row);
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
                            setDeleteTarget({
                              tab,
                              id: Number(String(row.id ?? '')),
                              label:
                                tab === 'Departments'
                                  ? String(row.name ?? '')
                                  : tab === 'Professors'
                                    ? String(row.full_name ?? '')
                                    : tab === 'Rooms'
                                      ? String(row.name ?? '')
                                      : tab === 'Subjects'
                                        ? String(row.code ?? '')
                                        : String(row.name ?? ''),
                            });
                          }}
                          className='w-7 h-7 rounded border border-border bg-surface-secondary text-text-secondary flex items-center justify-center text-[9px] transition hover:bg-red-50 hover:text-red-700'
                          title='Delete'
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SlideOverDrawer isOpen={drawer.open} onClose={closeDrawer}>
        <div className='flex shrink-0 items-center justify-between border-b border-border px-6 py-4'>
          <div>
            <h2 className='text-sm font-medium text-text-primary'>
              {drawer.mode === 'add' ? 'Add' : 'Edit'} {tab.slice(0, -1)}
            </h2>
            <p className='text-xs text-text-tertiary'>
              Fill in the essential fields and save.
            </p>
          </div>
          <button
            type='button'
            onClick={closeDrawer}
            className='shrink-0 rounded-full p-1.5 text-text-tertiary transition hover:bg-surface-secondary hover:text-text-primary'
          >
            <XIcon size={16} />
          </button>
        </div>

        <div className='flex-1 overflow-y-auto p-6'>
          <form onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget as HTMLFormElement;
            const formData = new FormData(form);
            const payload: Record<string, unknown> = {};
            formData.forEach((value, key) => {
              payload[key] = String(value);
            });
            handleDrawerSave(payload);
          }}>
            {tab === 'Professors' && (
              <>
                <div className='space-y-6'>
                  <fieldset>
                    <legend className='text-xs font-medium text-text-secondary mb-3'>Role</legend>
                    <div className='flex flex-wrap gap-4 sm:gap-6'>
                      {[
                        { value: 'professor', label: 'Professor' },
                        { value: 'department_head', label: 'Department Head' },
                        { value: 'registrar', label: 'Registrar' },
                      ].map((role) => (
                        <label key={role.value} className='flex items-center gap-2 cursor-pointer'>
                          <input
                            type='radio'
                            name='role'
                            value={role.value}
                            defaultChecked={
                              Boolean(
                                drawer.mode === 'add' && role.value === 'professor' ||
                                (drawer.item as Record<string, unknown> | null)?.role === role.value ||
                                (role.value === 'professor' && !(drawer.item as Record<string, unknown> | null)?.is_staff && !(drawer.item as Record<string, unknown> | null)?.is_department_head) ||
                                (role.value === 'department_head' && (drawer.item as Record<string, unknown> | null)?.is_department_head) ||
                                (role.value === 'registrar' && (drawer.item as Record<string, unknown> | null)?.is_staff)
                              )
                            }
                            onChange={() => {}}
                            className='text-apple-green-600'
                          />
                          <span className='text-sm text-text-primary'>{role.value === 'professor' ? 'Professor' : role.value === 'department_head' ? 'Department Head' : 'Registrar'}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                    <div className='flex flex-col gap-1.5 sm:col-span-2'>
                      <label className='flex items-center gap-1.5 text-xs font-medium text-text-secondary'>
                        <Mail size={14} className='text-text-tertiary' />
                        Email (account)
                      </label>
                      <input
                        name='user_email'
                        type='email'
                        autoComplete='email'
                        defaultValue={drawer.mode === 'edit' ? String((drawer.item as Record<string, unknown> | null)?.email ?? '') : ''}
                        required={drawer.mode === 'add'}
                        className='h-10 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary outline-none focus:border-apple-green-400 focus:ring-2 focus:ring-apple-green-100 transition-colors'
                        placeholder='professor@university.edu'
                        aria-describedby={drawer.mode === 'add' ? 'email-hint' : undefined}
                      />
                      {drawer.mode === 'add' && (
                        <p id='email-hint' className='text-[10px] text-text-tertiary'>Creates or links to a user account. Used for login.</p>
                      )}
                    </div>

                    <div className='flex flex-col gap-1.5 sm:col-span-2'>
                      <label className='flex items-center gap-1.5 text-xs font-medium text-text-secondary'>
                        <Lock size={14} className='text-text-tertiary' />
                        Password
                      </label>
                      <input
                        name='user_password'
                        type='password'
                        autoComplete={drawer.mode === 'add' ? 'new-password' : 'current-password'}
                        placeholder={drawer.mode === 'edit' ? 'Leave blank to keep current' : 'Auto-generated if empty (min 8 chars)'}
                        className='h-10 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary outline-none focus:border-apple-green-400 focus:ring-2 focus:ring-apple-green-100 transition-colors'
                        minLength={8}
                      />
                      {drawer.mode === 'edit' && (
                        <p className='text-[10px] text-text-tertiary'>Leave blank to keep current password.</p>
                      )}
                    </div>

                    <div className='flex flex-col gap-1.5 sm:col-span-2'>
                      <label className='flex items-center gap-1.5 text-xs font-medium text-text-secondary'>
                        <Building2 size={14} className='text-text-tertiary' />
                        Department
                      </label>
                      <select
                        name='department_id'
                        className='h-10 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary outline-none focus:border-apple-green-400 focus:ring-2 focus:ring-apple-green-100 transition-colors appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%236b7280%27 stroke-width=%272%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpath d=%27m6 9 6 6 6-6%27/%3E%3C/svg%3E")] bg-right-3 bg-no-repeat pr-10'
                        required={true}
                        aria-required="true"
                      >
                        <option value=''>Select department</option>
                        {deptList.map((d) => (
                          <option key={d.id} value={String(d.id)}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                      <p className='text-[10px] text-text-tertiary'>Required for Professor and Department Head roles.</p>
                    </div>

                    <div className='flex flex-col gap-1.5'>
                      <label className='flex items-center gap-1.5 text-xs font-medium text-text-secondary'>
                        <Clock size={14} className='text-text-tertiary' />
                        Max daily hours
                      </label>
                      <input
                        name='max_daily_hours'
                        type='number'
                        min={1}
                        max={12}
                        defaultValue={
                          drawer.mode === 'edit'
                            ? Number((drawer.item as Record<string, unknown> | null)?.max_daily_hours) || 8
                            : 8
                        }
                        className='h-10 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary outline-none focus:border-apple-green-400 focus:ring-2 focus:ring-apple-green-100 transition-colors'
                        aria-describedby='max-daily-hint'
                      />
                      <p id='max-daily-hint' className='text-[10px] text-text-tertiary'>Maximum teaching hours per day (1-12).</p>
                    </div>

                    <div className='flex flex-col gap-1.5'>
                      <label className='flex items-center gap-1.5 text-xs font-medium text-text-secondary'>
                        <Timer size={14} className='text-text-tertiary' />
                        Max consecutive slots
                      </label>
                      <input
                        name='max_consecutive'
                        type='number'
                        min={1}
                        max={8}
                        defaultValue={
                          drawer.mode === 'edit'
                            ? Number((drawer.item as Record<string, unknown> | null)?.max_consecutive) || 4
                            : 4
                        }
                        className='h-10 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary outline-none focus:border-apple-green-400 focus:ring-2 focus:ring-apple-green-100 transition-colors'
                        aria-describedby='max-consec-hint'
                      />
                      <p id='max-consec-hint' className='text-[10px] text-text-tertiary'>Maximum consecutive teaching hours (1-8).</p>
                    </div>
                  </div>
                </div>
              </>
            )}
            {tab === 'Departments' && (
              <>
                <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                  <div className='flex flex-col gap-1.5 sm:col-span-2'>
                    <label className='text-xs font-medium text-text-secondary'>
                      Department name
                    </label>
                    <input
                      name='name'
                      type='text'
                      defaultValue={
                        drawer.mode === 'edit'
                          ? String(drawer.item?.name ?? '')
                          : ''
                      }
                      required
                      autoComplete='off'
                      placeholder='Computer Science'
                      className='h-10 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary outline-none focus:border-apple-green-400 focus:ring-2 focus:ring-apple-green-100 transition-colors'
                    />
                  </div>
                  <div className='flex flex-col gap-1.5 sm:col-span-2'>
                    <label className='text-xs font-medium text-text-secondary'>
                      Department head
                    </label>
                    <select
                      name='head'
                      defaultValue={
                        drawer.mode === 'edit'
                          ? String(drawer.item?.head ?? '')
                          : ''
                      }
                      className='h-10 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary outline-none focus:border-apple-green-400 focus:ring-2 focus:ring-apple-green-100 transition-colors'
                    >
                      <option value=''>No head assigned</option>
                      {userList.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.username} ({user.email})
                        </option>
                      ))}
                    </select>
                    <p className='text-[10px] text-text-tertiary'>
                      Optional. Select a user to lead this department.
                    </p>
                  </div>
                </div>
              </>
            )}
            {tab === 'Rooms' && (
              <>
                <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                  <div className='flex flex-col gap-1.5 sm:col-span-2'>
                    <label className='text-xs font-medium text-text-secondary'>
                      Room name
                    </label>
                    <input
                      name='name'
                      type='text'
                      defaultValue={
                        drawer.mode === 'edit'
                          ? String(drawer.item!.name ?? '')
                          : ''
                      }
                      className='h-9 rounded-lg border border-border bg-surface px-2 text-xs text-text-primary outline-none focus:border-apple-green-400'
                    />
                  </div>
                  <div className='flex flex-col gap-1.5'>
                    <label className='text-xs font-medium text-text-secondary'>
                      Capacity
                    </label>
                    <input
                      name='capacity'
                      type='number'
                      defaultValue={
                        drawer.mode === 'edit'
                          ? Number(drawer.item!.capacity) || ''
                          : ''
                      }
                      className='h-9 rounded-lg border border-border bg-surface px-2 text-xs text-text-primary outline-none focus:border-apple-green-400'
                    />
                  </div>
                  <div className='flex flex-col gap-1.5 sm:col-span-2'>
                    <label className='text-xs font-medium text-text-secondary'>
                      Room type
                    </label>
                    <select
                      name='room_type'
                      className='h-9 rounded-lg border border-border bg-surface px-2 text-xs text-text-primary outline-none focus:border-apple-green-400'
                    >
                      <option value='lecture'>Lecture</option>
                      <option value='laboratory'>Laboratory</option>
                      <option value='general'>General</option>
                    </select>
                  </div>
                  <div className='flex flex-col gap-1.5 sm:col-span-2'>
                    <label className='text-xs font-medium text-text-secondary'>
                      Department
                    </label>
                    <select
                      name='department'
                      className='h-9 rounded-lg border border-border bg-surface px-2 text-xs text-text-primary outline-none focus:border-apple-green-400'
                    >
                      <option value=''>None</option>
                      {deptList.map((d) => (
                        <option key={d.id} value={String(d.id)}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className='flex flex-col gap-1.5 sm:col-span-2'>
                    <label className='text-xs font-medium text-text-secondary'>
                      Building
                    </label>
                    <input
                      name='building'
                      type='text'
                      defaultValue={
                        drawer.mode === 'edit'
                          ? String(drawer.item!.building ?? '')
                          : ''
                      }
                      className='h-9 rounded-lg border border-border bg-surface px-2 text-xs text-text-primary outline-none focus:border-apple-green-400'
                    />
                  </div>
                </div>
              </>
            )}
            {tab === 'Subjects' && (
              <>
                <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                  <div className='flex flex-col gap-1.5 sm:col-span-2'>
                    <label className='text-xs font-medium text-text-secondary'>
                      Subject code
                    </label>
                    <input
                      name='code'
                      type='text'
                      defaultValue={
                        drawer.mode === 'edit'
                          ? String(drawer.item!.code ?? '')
                          : ''
                      }
                      className='h-9 rounded-lg border border-border bg-surface px-2 text-xs text-text-primary outline-none focus:border-apple-green-400'
                    />
                  </div>
                  <div className='flex flex-col gap-1.5 sm:col-span-2'>
                    <label className='text-xs font-medium text-text-secondary'>
                      Title
                    </label>
                    <input
                      name='title'
                      type='text'
                      defaultValue={
                        drawer.mode === 'edit'
                          ? String(drawer.item!.title ?? '')
                          : ''
                      }
                      className='h-9 rounded-lg border border-border bg-surface px-2 text-xs text-text-primary outline-none focus:border-apple-green-400'
                    />
                  </div>
                  <div className='flex flex-col gap-1.5'>
                    <label className='text-xs font-medium text-text-secondary'>
                      Units
                    </label>
                    <input
                      name='units'
                      type='number'
                      defaultValue={
                        drawer.mode === 'edit'
                          ? Number(drawer.item!.units ?? 3)
                          : 3
                      }
                      className='h-9 rounded-lg border border-border bg-surface px-2 text-xs text-text-primary outline-none focus:border-apple-green-400'
                    />
                  </div>
                  <div className='flex flex-col gap-1.5'>
                    <label className='text-xs font-medium text-text-secondary'>
                      Lec hours
                    </label>
                    <input
                      name='lec_hours'
                      type='number'
                      defaultValue={
                        drawer.mode === 'edit'
                          ? Number(drawer.item!.lec_hours ?? drawer.item!.units ?? 3)
                          : 3
                      }
                      className='h-9 rounded-lg border border-border bg-surface px-2 text-xs text-text-primary outline-none focus:border-apple-green-400'
                    />
                  </div>
                  <div className='flex flex-col gap-1.5'>
                    <label className='text-xs font-medium text-text-secondary'>
                      Lab hours
                    </label>
                    <input
                      name='lab_hours'
                      type='number'
                      defaultValue={
                        drawer.mode === 'edit'
                          ? Number(drawer.item!.lab_hours ?? 0)
                          : 0
                      }
                      className='h-9 rounded-lg border border-border bg-surface px-2 text-xs text-text-primary outline-none focus:border-apple-green-400'
                    />
                  </div>
                </div>
                <p className='mt-3 text-xs text-text-secondary'>Units is the reference; lec + lab may differ.</p>
              </>
            )}
            {tab === 'Sections' && (
              <>
                <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                  <div className='flex flex-col gap-1.5 sm:col-span-2'>
                    <label className='text-xs font-medium text-text-secondary'>
                      Section name
                    </label>
                    <input
                      name='name'
                      type='text'
                      defaultValue={
                        drawer.mode === 'edit'
                          ? String(drawer.item!.name ?? '')
                          : ''
                      }
                      className='h-9 rounded-lg border border-border bg-surface px-2 text-xs text-text-primary outline-none focus:border-apple-green-400'
                    />
                  </div>
                  <div className='flex flex-col gap-1.5 sm:col-span-2'>
                    <label className='text-xs font-medium text-text-secondary'>
                      Program
                    </label>
                    <input
                      name='program'
                      type='text'
                      defaultValue={
                        drawer.mode === 'edit'
                          ? String(drawer.item!.program ?? '')
                          : ''
                      }
                      className='h-9 rounded-lg border border-border bg-surface px-2 text-xs text-text-primary outline-none focus:border-apple-green-400'
                    />
                  </div>
                  <div className='flex flex-col gap-1.5'>
                    <label className='text-xs font-medium text-text-secondary'>
                      Headcount
                    </label>
                    <input
                      name='headcount'
                      type='number'
                      defaultValue={
                        drawer.mode === 'edit'
                          ? Number(drawer.item!.headcount) || ''
                          : ''
                      }
                      className='h-9 rounded-lg border border-border bg-surface px-2 text-xs text-text-primary outline-none focus:border-apple-green-400'
                    />
                  </div>
                  <div className='flex flex-col gap-1.5'>
                    <label className='text-xs font-medium text-text-secondary'>
                      Year level
                    </label>
                    <input
                      name='year_level'
                      type='number'
                      defaultValue={
                        drawer.mode === 'edit' && drawer.item!.year_level != null
                          ? Number(drawer.item!.year_level) || ''
                          : ''
                      }
                      className='h-9 rounded-lg border border-border bg-surface px-2 text-xs text-text-primary outline-none focus:border-apple-green-400'
                    />
                  </div>
                  <div className='flex flex-col gap-1.5 sm:col-span-2'>
                    <label className='text-xs font-medium text-text-secondary'>
                      Term
                    </label>
                    <select
                      name='term_id'
                      className='h-9 rounded-lg border border-border bg-surface px-2 text-xs text-text-primary outline-none focus:border-apple-green-400'
                      defaultValue={drawer.mode === 'edit' ? String(drawer.item!.term ?? '') : ''}
                    >
                      <option value=''>None</option>
                      {termList.map((term) => (
                        <option key={term.id} value={String(term.id)}>
                          {term.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}
            <div className='mt-6 flex gap-3'>
              <button
                type='button'
                onClick={closeDrawer}
                className='flex-1 h-9 rounded-lg border border-border bg-surface-tertiary px-3 text-xs font-medium text-text-secondary transition hover:bg-surface-secondary'
              >
                Cancel
              </button>
              <button
                type='submit'
                disabled={
                  createRoom.isPending ||
                  updateRoom.isPending ||
                  createSubject.isPending ||
                  updateSubject.isPending ||
                  createSection.isPending ||
                  updateSection.isPending ||
                  createProfessor.isPending ||
                  updateProfessor.isPending ||
                  createDepartment.isPending ||
                  updateDepartment.isPending
                }
                className='flex-1 h-9 rounded-lg bg-apple-green-600 px-3 text-xs font-medium text-white transition hover:bg-apple-green-700 disabled:opacity-60'
              >
                {createRoom.isPending ||
                updateRoom.isPending ||
                createSubject.isPending ||
                updateSubject.isPending ||
                createSection.isPending ||
                updateSection.isPending ||
                createProfessor.isPending ||
                updateProfessor.isPending ||
                createDepartment.isPending ||
                updateDepartment.isPending
                  ? 'Saving…'
                  : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </SlideOverDrawer>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title='Delete'
        message={`Are you sure you want to delete "${deleteTarget?.label}"? This cannot be undone.`}
        confirmText='Delete'
        cancelText='Cancel'
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </section>
  );
}
