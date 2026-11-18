// layouts/RegistrarLayout.tsx
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Calendar,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useState } from 'react';
import { useSignOut } from '../hooks/useAuth';
import TimetableSidepanel from '../components/registrar/TimetableSidepanel';

const navItems = [
  {
    id: 1,
    icon: LayoutDashboard,
    label: 'Dashboard',
    to: '/registrar',
    end: true,
  },
  {
    id: 2,
    icon: Users,
    label: 'Teachers',
    to: '/registrar/teachers',
  },
  {
    id: 3,
    icon: Calendar,
    label: 'Schedule Management',
    to: '/registrar/schedule-management',
  },
  {
    id: 4,
    icon: Calendar,
    label: 'Timetable',
    to: '/registrar/timetable',
  },
];

export default function RegistrarLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [isTimetableOpen, setIsTimetableOpen] = useState(false);
  const signOut = useSignOut();
  const navigate = useNavigate();

  const { pathname } = useLocation();

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
          <span className='grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-apple-green-600 text-white'>
            <LayoutDashboard size={16} />
          </span>

          {!collapsed && (
            <span className='text-base font-medium text-apple-green-800'>
              Registrar
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className='mt-2 flex flex-1 flex-col gap-1 px-3'>
          {navItems.map((item) => (
            <NavLink
              key={item.id}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition ${
                  collapsed ? 'justify-center px-0' : ''
                } ${
                  isActive
                    ? 'bg-apple-green-100 font-medium text-apple-green-800'
                    : 'text-apple-green-700 hover:bg-apple-green-100 hover:text-apple-green-800'
                }`
              }
            >
              <item.icon size={18} strokeWidth={1.8} className='shrink-0' />

              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className='border-t border-border p-3'>
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
            className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm text-apple-green-700 transition hover:bg-apple-green-100 hover:text-apple-green-800 ${
              collapsed ? 'justify-center px-0' : ''
            }`}
          >
            <LogOut size={18} strokeWidth={1.8} className='shrink-0' />

            {!collapsed && <span>Log out</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className='flex min-w-0 flex-1 flex-col'>
        {/* Header */}
        <header className='flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-4 sm:px-6 md:px-8'>
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
            {/* Notification / Timetable */}
            <button
              type='button'
              onClick={() => setIsTimetableOpen(true)}
              className='relative grid h-8 w-8 place-items-center rounded-full bg-surface-secondary text-text-secondary transition hover:bg-border'
            >
              <Calendar size={15} />

              <span className='absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-apple-green-500' />
            </button>
            {/* Profile */}
            <button
              type='button'
              className='flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition hover:bg-surface-secondary'
            >
              <span className='grid h-7 w-7 shrink-0 place-items-center rounded-full bg-apple-green-50 text-[11px] font-semibold text-apple-green-700'>
                RC
              </span>

              <span className='hidden text-sm font-medium text-text-primary sm:block'>
                Registrar Office
              </span>

              <PanelLeftClose size={13} className='text-text-tertiary' />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className='flex-1 px-4 py-5 overflow-y-auto'>
          <Outlet />
        </div>

        {/* Timetable Sidepanel */}
        <TimetableSidepanel isOpen={isTimetableOpen} onClose={() => setIsTimetableOpen(false)} />
      </main>
    </div>
  );
}
