import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../../lib/cn';
import { useSignOut } from '../../hooks/useAuth';

export type AppNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
};

type AppShellProps = {
  roleLabel: string;
  logoIcon: LucideIcon;
  logoShape?: 'rounded' | 'circle';
  navItems: AppNavItem[];
  userInitials: string;
  userName: string;
  headerAction?: ReactNode;
  children: ReactNode;
};

function normalizePath(path: string) {
  return path.replace(/\/+$/, '') || '/';
}

function getPageTitle(pathname: string, navItems: AppNavItem[]) {
  const current = normalizePath(pathname);
  const matches = navItems.filter((item) => {
    const target = normalizePath(item.to);
    return (
      current === target ||
      (!item.end && current.startsWith(`${target}/`))
    );
  });

  return (
    matches.sort((a, b) => b.to.length - a.to.length)[0]?.label ?? 'Dashboard'
  );
}

function NavItems({
  navItems,
  collapsed = false,
  onNavigate,
}: {
  navItems: AppNavItem[];
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav className='flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-3'>
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          title={collapsed ? item.label : undefined}
          className={({ isActive }) =>
            cn(
              'group relative flex min-h-11 items-center gap-3 rounded-control px-3 text-body-sm font-medium transition-colors',
              collapsed && 'justify-center px-0',
              isActive
                ? 'bg-apple-green-50 text-apple-green-800'
                : 'text-text-secondary hover:bg-surface-secondary hover:text-text-primary'
            )
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={cn(
                  'absolute left-0 h-5 w-0.5 rounded-pill bg-apple-green-600 transition-opacity',
                  isActive ? 'opacity-100' : 'opacity-0'
                )}
                aria-hidden='true'
              />
              <item.icon
                size={19}
                strokeWidth={1.9}
                className='shrink-0'
                aria-hidden='true'
              />
              <span className={cn(collapsed ? 'sr-only' : 'truncate')}>
                {item.label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function LogoutButton({
  collapsed = false,
  onClick,
}: {
  collapsed?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      title={collapsed ? 'Log out' : undefined}
      className={cn(
        'flex min-h-11 w-full items-center gap-3 rounded-control px-3 text-body-sm font-medium text-text-secondary transition-colors hover:bg-danger-soft hover:text-danger',
        collapsed && 'justify-center px-0'
      )}
    >
      <LogOut size={19} strokeWidth={1.9} className='shrink-0' aria-hidden='true' />
      <span className={cn(collapsed ? 'sr-only' : 'truncate')}>Log out</span>
    </button>
  );
}

export function AppShell({
  roleLabel,
  logoIcon: LogoIcon,
  logoShape = 'rounded',
  navItems,
  userInitials,
  userName,
  headerAction,
  children,
}: AppShellProps) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('app-shell-collapsed') === 'true';
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const drawerRef = useRef<HTMLDialogElement>(null);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const signOut = useSignOut();

  const pageTitle = getPageTitle(pathname, navItems);

  useEffect(() => {
    window.localStorage.setItem('app-shell-collapsed', String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    if (drawerRef.current?.open) {
      drawerRef.current.close();
    }
  }, [pathname]);

  useEffect(() => {
    const dialog = drawerRef.current;
    if (!dialog) return;

    if (mobileOpen) {
      if (!dialog.open) dialog.showModal();
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = previousOverflow;
      };
    }

    if (dialog.open) dialog.close();
  }, [mobileOpen]);

  async function handleLogout() {
    try {
      await signOut.mutateAsync();
    } catch {
      // Ignore sign-out errors and return to the login screen.
    }
    setMobileOpen(false);
    navigate('/');
  }

  return (
    <div className='min-h-dvh bg-surface-secondary'>
      <a
        href='#main-content'
        className='sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-control focus:border focus:border-apple-green-600 focus:bg-surface focus:px-4 focus:py-2.5 focus:text-body-sm focus:font-semibold focus:text-apple-green-700'
      >
        Skip to content
      </a>

      <div className='flex min-h-dvh w-full bg-surface-secondary'>
        <aside
          className={cn(
            'sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200 lg:flex',
            collapsed ? 'w-[72px]' : 'w-60'
          )}
        >
          <div
            className={cn(
              'flex h-16 shrink-0 items-center gap-2.5 border-b border-border px-4',
              collapsed && 'justify-center px-0'
            )}
          >
            <span
              className={cn(
                'grid h-9 w-9 shrink-0 place-items-center bg-apple-green-600 text-white',
                logoShape === 'circle' ? 'rounded-full' : 'rounded-control'
              )}
            >
              <LogoIcon size={18} aria-hidden='true' />
            </span>
            {!collapsed && (
              <div className='min-w-0'>
                <p className='truncate text-body font-semibold text-text-primary'>
                  {roleLabel}
                </p>
                <p className='truncate text-caption text-text-tertiary'>
                  Scheduling System
                </p>
              </div>
            )}
          </div>

          <NavItems navItems={navItems} collapsed={collapsed} />

          <div className='border-t border-border p-3'>
            <LogoutButton collapsed={collapsed} onClick={handleLogout} />
          </div>
        </aside>

        <div className='flex min-w-0 flex-1 flex-col'>
          <header className='sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface/95 px-4 backdrop-blur sm:px-6 lg:h-16 lg:px-8'>
            <div className='flex min-w-0 items-center gap-2'>
              <button
                type='button'
                onClick={() => setMobileOpen(true)}
                aria-label='Open navigation menu'
                aria-expanded={mobileOpen}
                aria-controls='mobile-navigation'
                className='grid h-11 w-11 shrink-0 place-items-center rounded-control text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text-primary lg:hidden'
              >
                <Menu size={20} aria-hidden='true' />
              </button>

              <button
                type='button'
                onClick={() => setCollapsed((value) => !value)}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                className='hidden h-11 w-11 shrink-0 place-items-center rounded-control text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text-primary lg:grid'
              >
                {collapsed ? (
                  <PanelLeftOpen size={19} aria-hidden='true' />
                ) : (
                  <PanelLeftClose size={19} aria-hidden='true' />
                )}
              </button>

              <div className='min-w-0'>
                <p className='truncate text-h3 text-text-primary'>{pageTitle}</p>
                <p className='hidden truncate text-caption text-text-tertiary sm:block'>
                  {roleLabel}
                </p>
              </div>
            </div>

            <div className='flex shrink-0 items-center gap-1 sm:gap-2'>
              {headerAction}

              <div className='ml-1 flex items-center gap-2 rounded-pill py-1 pl-1 pr-1 sm:pr-2'>
                <span className='grid h-9 w-9 shrink-0 place-items-center rounded-full bg-apple-green-50 text-caption font-semibold text-apple-green-700'>
                  {userInitials}
                </span>
                <span className='hidden max-w-40 truncate text-body-sm font-medium text-text-primary md:block'>
                  {userName}
                </span>
              </div>
            </div>
          </header>

          <main
            id='main-content'
            tabIndex={-1}
            className='flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8'
          >
            <div className='w-full'>{children}</div>
          </main>
        </div>
      </div>

      <dialog
        ref={drawerRef}
        id='mobile-navigation'
        aria-label='Navigation menu'
        aria-modal='true'
        onClose={() => setMobileOpen(false)}
        onCancel={(event) => {
          event.preventDefault();
          setMobileOpen(false);
        }}
        onClick={(event) => {
          if (event.target === drawerRef.current) setMobileOpen(false);
        }}
        className='fixed inset-y-0 left-0 m-0 h-dvh max-h-dvh w-[min(20rem,85vw)] max-w-none overflow-hidden rounded-none border-0 border-r border-border bg-surface p-0 text-text-primary shadow-overlay backdrop:bg-black/40 lg:hidden'
      >
        <div className='flex h-full flex-col'>
          <div className='flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border px-4'>
            <div className='flex min-w-0 items-center gap-2.5'>
              <span
                className={cn(
                  'grid h-9 w-9 shrink-0 place-items-center bg-apple-green-600 text-white',
                  logoShape === 'circle' ? 'rounded-full' : 'rounded-control'
                )}
              >
                <LogoIcon size={18} aria-hidden='true' />
              </span>
              <div className='min-w-0'>
                <p className='truncate text-body font-semibold text-text-primary'>
                  {roleLabel}
                </p>
                <p className='truncate text-caption text-text-tertiary'>
                  Scheduling System
                </p>
              </div>
            </div>
            <button
              type='button'
              onClick={() => setMobileOpen(false)}
              aria-label='Close navigation menu'
              className='grid h-11 w-11 shrink-0 place-items-center rounded-control text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text-primary'
            >
              <X size={20} aria-hidden='true' />
            </button>
          </div>

          <NavItems
            navItems={navItems}
            onNavigate={() => setMobileOpen(false)}
          />

          <div className='border-t border-border p-3'>
            <LogoutButton onClick={handleLogout} />
          </div>
        </div>
      </dialog>
    </div>
  );
}
