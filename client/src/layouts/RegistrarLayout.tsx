// layouts/RegistrarLayout.tsx
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Calendar,
  Database,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useState } from 'react';
import { useMe, useSignOut } from '../hooks/useAuth';
import { ProfileDropdown } from '../components/shared/ProfileDropdown';
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
    label: 'Master Schedule',
    to: '/registrar/timetable',
  },
  {
    id: 5,
    icon: Database,
    label: 'Master Data',
    to: '/registrar/master-data',
  },
];

export default function RegistrarLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [isTimetableOpen, setIsTimetableOpen] = useState(false);
  const signOut = useSignOut();
  const { data: user } = useMe();
  const navigate = useNavigate();

  const { pathname } = useLocation();

  return (
    <div className='mx-auto flex h-screen w-full max-w-300 border-x border-border bg-surface-secondary overflow-hidden'>
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
      <main className='flex-1 min-h-0 overflow-y-auto flex flex-col'>
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
            {/* Master Schedule quick view */}
            <button
              type='button'
              onClick={() => setIsTimetableOpen(true)}
              aria-label='Open Master Schedule'
              className='relative grid h-8 w-8 place-items-center rounded-full bg-surface-secondary text-text-secondary transition hover:bg-border'
            >
              <Calendar size={15} />

              <span className='absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-apple-green-500' />
            </button>
            {/* Profile */}
            <ProfileDropdown
              userName={user?.username || 'Registrar Office'}
              userEmail={user?.email || 'registrar@school.edu'}
              userRole={user?.role || 'registrar'}
            />
          </div>
        </header>

        {/* Page Content */}
        <div className='flex-1 px-4 py-5'>
          <Outlet />
        </div>

        {/* Timetable Sidepanel */}
        <TimetableSidepanel
          isOpen={isTimetableOpen}
          onClose={() => setIsTimetableOpen(false)}
        />
      </main>

    </div>
  );
}
