// pages/registrar/RegistrarMasterDataPage.tsx
// Unified master data management for the registrar: Professors, Rooms,
// Courses (Subjects) and Sections. Each tab is a searchable table with Add /
// Edit / Delete via SlideOverDrawer and ConfirmDialog.
import { useState } from 'react';
import { Plus, Trash2, Edit2, Search, X as XIcon } from 'lucide-react';
import {
  useCourses,
  useDepartments,
  useRooms,
  useSections,
  useTeachers,
  useUsers,
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
  Room,
  Section,
  TeacherListItem,
} from '../../types/Types';

type Tab = 'Professors' | 'Rooms' | 'Courses' | 'Sections';

type SimpleUser = { id: number; username: string; email: string };
type SimpleDept = { id: number; name: string };

export default function RegistrarMasterDataPage() {
  const [tab, setTab] = useState<Tab>('Professors');
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
  const deptList: SimpleDept[] = departments.data ?? [];
  const userList: SimpleUser[] = users.data ?? [];

  const rows = (
    tab === 'Professors'
      ? profList.filter((p) =>
          (p.full_name || p.username || '')
            .toLowerCase()
            .includes(search.toLowerCase())
        )
      : tab === 'Rooms'
        ? roomList.filter((r) =>
            (r.name || '').toLowerCase().includes(search.toLowerCase())
          )
        : tab === 'Courses'
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
      if (tab === 'Professors') {
        if (drawer.mode === 'add') {
          await createProfessor.mutateAsync(payload as {
            user_id: number;
            department_id?: number | null;
            max_daily_hours?: number;
            max_consecutive?: number;
          });
        } else {
          await updateProfessor.mutateAsync({
            id: Number(drawer.item!.id),
            payload: payload as {
              user_id: number;
              department_id: number | null;
              max_daily_hours: number;
              max_consecutive: number;
            },
          });
        }
        toast.addToast({
          type: 'success',
          title: `Professor ${
            drawer.mode === 'add' ? 'created' : 'updated'
          }.`,
        });
      } else if (tab === 'Rooms') {
        if (drawer.mode === 'add') {
          await createRoom.mutateAsync(payload as {
            name: string;
            capacity: number;
            department?: number | null;
            building?: string;
          });
        } else {
          await updateRoom.mutateAsync({
            id: Number(drawer.item!.id),
            payload: payload as {
              name: string;
              capacity: number;
              department: number | null;
              building: string;
            },
          });
        }
        toast.addToast({
          type: 'success',
          title: `Room ${drawer.mode === 'add' ? 'created' : 'updated'}.`,
        });
      } else if (tab === 'Courses') {
        if (drawer.mode === 'add') {
          await createSubject.mutateAsync(payload as {
            code: string;
            title: string;
            units: number;
          });
        } else {
          await updateSubject.mutateAsync({
            id: Number(drawer.item!.id),
            payload: payload as {
              code: string;
              title: string;
              units: number;
            },
          });
        }
        toast.addToast({
          type: 'success',
          title: `Course ${drawer.mode === 'add' ? 'created' : 'updated'}.`,
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
      if (deleteTarget.tab === 'Professors') {
        await deleteProfessor.mutateAsync(deleteTarget.id);
      } else if (deleteTarget.tab === 'Rooms') {
        await deleteRoom.mutateAsync(deleteTarget.id);
      } else if (deleteTarget.tab === 'Courses') {
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
            Manage professors, rooms, courses and sections.
          </p>
        </div>
        <div className='flex gap-2'>
          {['Professors', 'Rooms', 'Courses', 'Sections'].map((t) => (
            <button
              key={t}
              type='button'
              onClick={() => setTab(t as Tab)}
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
                {tab === 'Professors' && (
                  <>
                    <th className='px-3 py-2'>Name</th>
                    <th className='px-3 py-2'>Username</th>
                    <th className='px-3 py-2'>Department</th>
                    <th className='px-3 py-2'>Max daily hours</th>
                    <th className='px-3 py-2'>Max consecutive</th>
                  </>
                )}
                {tab === 'Rooms' && (
                  <>
                    <th className='px-3 py-2'>Name</th>
                    <th className='px-3 py-2'>Capacity</th>
                    <th className='px-3 py-2'>Department</th>
                    <th className='px-3 py-2'>Building</th>
                  </>
                )}
                {tab === 'Courses' && (
                  <>
                    <th className='px-3 py-2'>Code</th>
                    <th className='px-3 py-2'>Title</th>
                    <th className='px-3 py-2'>Units</th>
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
                    colSpan={tab === 'Professors' ? 7 : 6}
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
                    {tab === 'Professors' && (
                      <>
                        <td className='px-3 py-1 text-text-primary truncate'>
                          {String(row.full_name ?? '')}
                        </td>
                        <td className='px-3 py-1 text-text-tertiary truncate'>
                          {String(row.username ?? '')}
                        </td>
                        <td className='px-3 py-1 text-text-secondary truncate'>
                          {String(row.department_name ?? '—')}
                        </td>
                        <td className='px-3 py-1 text-text-secondary'>
                          {String(row.max_daily_hours ?? '')}
                        </td>
                        <td className='px-3 py-1 text-text-secondary'>
                          {String(row.max_consecutive ?? '')}
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
                          {String(row.department_name ?? '—')}
                        </td>
                        <td className='px-3 py-1 text-text-secondary truncate'>
                          {String(row.building ?? '—')}
                        </td>
                      </>
                    )}
                    {tab === 'Courses' && (
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
                          {String(row.term ?? '—')}
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
                                tab === 'Professors'
                                  ? String(row.full_name ?? '')
                                  : tab === 'Rooms'
                                    ? String(row.name ?? '')
                                    : tab === 'Courses'
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
                <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                  <div className='flex flex-col gap-1.5'>
                    <label className='text-xs font-medium text-text-secondary'>
                      User (account)
                    </label>
                    <select
                      name='user_id'
                      className='h-9 rounded-lg border border-border bg-surface px-2 text-xs text-text-primary outline-none focus:border-apple-green-400'
                    >
                      <option value=''>Select user</option>
                      {userList.map((u) => (
                        <option key={u.id} value={String(u.id)}>
                          {u.username} ({u.email})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className='flex flex-col gap-1.5'>
                    <label className='text-xs font-medium text-text-secondary'>
                      Department
                    </label>
                    <select
                      name='department_id'
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
                      Max daily hours
                    </label>
                    <input
                      name='max_daily_hours'
                      type='number'
                      defaultValue={
                        drawer.mode === 'edit'
                          ? Number(drawer.item!.max_daily_hours) || 8
                          : 8
                      }
                      className='h-9 rounded-lg border border-border bg-surface px-2 text-xs text-text-primary outline-none focus:border-apple-green-400'
                    />
                  </div>
                  <div className='flex flex-col gap-1.5 sm:col-span-2'>
                    <label className='text-xs font-medium text-text-secondary'>
                      Max consecutive slots
                    </label>
                    <input
                      name='max_consecutive'
                      type='number'
                      defaultValue={
                        drawer.mode === 'edit'
                          ? Number(drawer.item!.max_consecutive) || 4
                          : 4
                      }
                      className='h-9 rounded-lg border border-border bg-surface px-2 text-xs text-text-primary outline-none focus:border-apple-green-400'
                    />
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
            {tab === 'Courses' && (
              <>
                <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                  <div className='flex flex-col gap-1.5 sm:col-span-2'>
                    <label className='text-xs font-medium text-text-secondary'>
                      Course code
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
                </div>
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
                    >
                      <option value=''>None</option>
                      <option value=''>None</option>
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
                  updateProfessor.isPending
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
                updateProfessor.isPending
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
