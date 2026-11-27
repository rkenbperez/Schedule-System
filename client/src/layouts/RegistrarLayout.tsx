import { Outlet } from 'react-router-dom';
import {
  Calendar,
  CalendarDays,
  Database,
  LayoutDashboard,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { AppShell, type AppNavItem } from '../components/layout/AppShell';
import { IconButton } from '../components/ui';
import TimetableSidepanel from '../components/registrar/TimetableSidepanel';

const navItems: AppNavItem[] = [
  {
    icon: LayoutDashboard,
    label: 'Dashboard',
    to: '/registrar',
    end: true,
  },
  {
    icon: Database,
    label: 'Master Data',
    to: '/registrar/master-data',
  },
  {
    icon: Users,
    label: 'Teachers',
    to: '/registrar/teachers',
  },
  {
    icon: Calendar,
    label: 'Schedule Management',
    to: '/registrar/schedule-management',
  },
  {
    icon: CalendarDays,
    label: 'Timetable',
    to: '/registrar/timetable',
  },
];

export default function RegistrarLayout() {
  const [isTimetableOpen, setIsTimetableOpen] = useState(false);

  return (
    <>
      <AppShell
        roleLabel='Registrar'
        logoIcon={LayoutDashboard}
        navItems={navItems}
        userInitials='RC'
        userName='Registrar Office'
        headerAction={
          <IconButton
            label='Open timetable panel'
            variant='secondary'
            size='sm'
            onClick={() => setIsTimetableOpen(true)}
            className='relative'
          >
            <CalendarDays size={18} aria-hidden='true' />
            <span className='absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-apple-green-500' />
          </IconButton>
        }
      >
        <Outlet />
      </AppShell>

      <TimetableSidepanel
        isOpen={isTimetableOpen}
        onClose={() => setIsTimetableOpen(false)}
      />
    </>
  );
}
