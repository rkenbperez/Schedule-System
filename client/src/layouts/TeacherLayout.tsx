// layouts/TeacherLayout.tsx
import {
  NavLink,
  Outlet,
  useLocation,
  useParams,
  useNavigate,
  Link,
} from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  Calendar,
  Building2,
  CalendarCheck,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Bell,
  ArrowRight,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useMe, useSignOut } from '../hooks/useAuth';
import { useCourseAssignments, useSchedules } from '../hooks/Schedule.hooks';
import { ProfileDropdown } from '../components/shared/ProfileDropdown';

export default function TeacherLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const signOut = useSignOut();
  const { data: user } = useMe();
  const navigate = useNavigate();

  const { pathname } = useLocation();
  const { name: teacherName } = useParams<{ name: string }>();

  const teacher = teacherName ?? 'juan';
  const teacherId = user?.professor?.id;

  const { data: schedules } = useSchedules({
    teacherId,
    enabled: !!teacherId,
  });
  const { data: assignments } = useCourseAssignments({
    enabled: !!teacherId,
  });

  const resolvedSchedules = schedules ?? [];
  const scheduledCount = resolvedSchedules.length;
  const pendingCount = (assignments ?? []).filter(
    (assignment) =>
      !resolvedSchedules.some(
        (schedule) => schedule.assignment === assignment.id
      )
  ).length;

  useEffect(() => {
    if (!isNotificationsOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!notificationsRef.current?.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsNotificationsOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isNotificationsOpen]);

  const navItems = [
    {
      id: 1,
      icon: LayoutDashboard,
      label: 'Dashboard',
      to: `/teacher/${teacher}`,
      end: true,
    },
    {
      id: 2,
      icon: BookOpen,
      label: 'My assignments',
      to: `/teacher/${teacher}/assignments`,
    },
    {
      id: 4,
      icon: Calendar,
      label: 'My Schedule',
      to: `/teacher/${teacher}/schedules`,
    },
    {
      id: 5,
      icon: Building2,
      label: 'Rooms',
      to: `/teacher/${teacher}/rooms`,
    },
  ];

  const activeItem = navItems.find((item) => {
    if (item.end) {
      return pathname === item.to;
    }
    return pathname.startsWith(item.to + '/') || pathname === item.to;
  });

  return (
    <div className='mx-auto flex min-h-screen w-full max-w-300 border-x border-border bg-surface-secondary'>
      {/* Sidebar */}
      <aside
        className={`flex flex-col border border-apple-green-400 bg-apple-green-50 transition-all duration-200 ${
          collapsed ? 'w-14' : 'w-56'
        }`}
      >
        {/* Logo */}
        <div className='flex h-14 shrink-0 items-center gap-2.5 border-b border-border px-4'>
          <span className='grid h-7 w-7 shrink-0 place-items-center rounded-full bg-apple-green-600 text-white'>
            <CalendarCheck size={16} />
          </span>

          {!collapsed && (
            <span className='text-base font-medium text-apple-green-800'>
              Scheduler
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className='mt-2 flex flex-1 flex-col gap-1 px-3'>
          {navItems.map((item) => {
            const isActive = activeItem === item;
            const Icon = item.icon;
            return (
              <NavLink
                key={item.id}
                to={item.to}
                end={item.end}
                className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition ${collapsed ? 'justify-center px-0' : ''} ${isActive ? 'bg-apple-green-100 font-medium text-apple-green-800' : 'text-apple-green-700 hover:bg-apple-green-100 hover:text-apple-green-800'}`}
              >
                <Icon size={18} strokeWidth={1.8} className='shrink-0' />

                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Logout */}
        <div className='border-t border-border px-3 py-2.5'>
          <button
            type='button'
            onClick={async () => {
              try {
                await signOut.mutateAsync();
              } catch {
                // ignore errors on logout
              }
              navigate('/');
            }}
            className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm text-apple-green-700 transition hover:bg-apple-green-100 hover:text-apple-green-800 ${collapsed ? 'justify-center px-0' : ''}`}
          >
            <LogOut size={18} strokeWidth={1.8} className='shrink-0' />

            {!collapsed && <span>Log out</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className='flex min-w-0 flex-1 flex-col'>
        {/* Header */}
        <header className='relative z-40 flex h-14 shrink-0 items-center justify-between overflow-visible border-b border-border bg-surface px-4 sm:px-6 md:px-8'>
          {/* sidebar toggle */}
          <div className='flex items-center gap-5'>
            <button
              type='button'
              onClick={() => setCollapsed((c) => !c)}
              className='flex h-8 shrink-0 items-center justify-center rounded-md px-2 text-text-secondary transition hover:bg-surface-secondary hover:text-text-primary'
              aria-label={collapsed ? 'Open sidebar' : 'Close sidebar'}
            >
              {collapsed ? (
                <PanelLeftOpen size={16} />
              ) : (
                <PanelLeftClose size={16} />
              )}
            </button>

            <span className='text-base font-medium text-text-primary'>
              {
                navItems.find((item) => item.to === pathname.toLowerCase())
                  ?.label
              }
            </span>
          </div>

          {/* User */}
          <div className='flex items-center gap-2 sm:gap-3'>
            {/* Notifications */}
            <div ref={notificationsRef} className='relative z-50'>
              <button
                type='button'
                onClick={() => setIsNotificationsOpen((prev) => !prev)}
                aria-label='Notifications'
                aria-haspopup='menu'
                aria-expanded={isNotificationsOpen}
                className='relative grid h-8 w-8 place-items-center rounded-full bg-surface-secondary text-text-secondary transition hover:bg-border'
              >
                <Bell size={15} />

                {pendingCount > 0 && (
                  <span className='absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-amber-500 px-1 text-[9px] font-semibold text-white'>
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </span>
                )}
              </button>

              {isNotificationsOpen && (
                <div
                  role='menu'
                  className='absolute right-0 top-full z-50 mt-2 w-64 rounded-md border border-border bg-surface shadow-lg'
                >
                  <div className='border-b border-border px-4 py-3'>
                    <p className='text-sm font-medium text-text-primary'>
                      Schedule Summary
                    </p>
                    <p className='text-xs text-text-tertiary'>
                      Active term overview
                    </p>
                  </div>

                  <div className='grid grid-cols-2 gap-2 p-4'>
                    <div className='rounded-lg bg-apple-green-50 p-2 text-center'>
                      <p className='text-lg font-semibold text-apple-green-700'>
                        {scheduledCount}
                      </p>
                      <p className='text-[10px] font-medium uppercase tracking-wide text-apple-green-700'>
                        Scheduled
                      </p>
                    </div>
                    <div className='rounded-lg bg-amber-50 p-2 text-center'>
                      <p className='text-lg font-semibold text-amber-700'>
                        {pendingCount}
                      </p>
                      <p className='text-[10px] font-medium uppercase tracking-wide text-amber-700'>
                        Pending
                      </p>
                    </div>
                  </div>

                  <p className='px-4 pb-3 text-xs text-text-secondary'>
                    {pendingCount === 0
                      ? 'All of your assigned classes are scheduled.'
                      : `${pendingCount} assignment${
                          pendingCount === 1 ? '' : 's'
                        } still need${pendingCount === 1 ? 's' : ''} a class schedule.`}
                  </p>

                  <div className='border-t border-border py-1'>
                    <Link
                      to={`/teacher/${teacher}/schedules`}
                      role='menuitem'
                      onClick={() => setIsNotificationsOpen(false)}
                      className='flex items-center justify-between px-4 py-2 text-xs font-medium text-text-primary transition hover:bg-surface-secondary'
                    >
                      My Schedule
                      <ArrowRight size={13} />
                    </Link>
                    <Link
                      to={`/teacher/${teacher}/assignments`}
                      role='menuitem'
                      onClick={() => setIsNotificationsOpen(false)}
                      className='flex items-center justify-between px-4 py-2 text-xs font-medium text-text-primary transition hover:bg-surface-secondary'
                    >
                      My assignments
                      <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <ProfileDropdown
              userName={user?.username || 'Juan Dela Cruz'}
              userEmail={user?.email || 'juan.dela.cruz@school.edu'}
              userRole={user?.role || 'professor'}
              profileTo={`/teacher/${teacher}/profile`}
            />
          </div>
        </header>

        {/* Page Content */}
        <div className='flex-1 px-4 py-5 overflow-y-auto'>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
