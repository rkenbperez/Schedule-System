// components/shared/ProfileDropdown.tsx
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut, Settings, User } from 'lucide-react';
import { useSignOut } from '../../hooks/useAuth';
import { Link, useLocation, useNavigate } from 'react-router-dom';

export function ProfileDropdown({
  userName,
  userEmail,
  userRole,
  userInitials,
  profileTo,
}: {
  userName: string;
  userEmail?: string;
  userRole?: string;
  userInitials?: string;
  profileTo?: string;
}) {
  const { pathname } = useLocation();
  // Tying the open state to the current path closes the menu on navigation
  // without a setState-in-effect cascade.
  const [openAtPath, setOpenAtPath] = useState<string | null>(null);
  const isOpen = openAtPath === pathname;
  const containerRef = useRef<HTMLDivElement>(null);
  const signOut = useSignOut();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpenAtPath(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenAtPath(null);
    };

    document.addEventListener('click', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('click', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSignOut = async () => {
    try {
      await signOut.mutateAsync();
    } catch {
      // ignore errors on logout
    }
    navigate('/');
    setOpenAtPath(null);
  };

  return (
    <div
      ref={containerRef}
      className='relative z-50 flex items-center gap-2 sm:gap-3'
    >
      {/* Profile trigger */}
      <button
        type='button'
        onClick={(e) => {
          e.stopPropagation();
          setOpenAtPath(isOpen ? null : pathname);
        }}
        aria-haspopup='menu'
        aria-expanded={isOpen}
        className='flex min-h-11 items-center gap-2 rounded-pill py-1 pl-1 pr-2 transition hover:bg-surface-secondary'
      >
        <span className='grid h-9 w-9 shrink-0 place-items-center rounded-full bg-apple-green-50 text-caption font-semibold text-apple-green-700'>
          {userInitials || userName.charAt(0).toUpperCase()}
        </span>
        <span className='hidden max-w-40 truncate text-body-sm font-medium text-text-primary md:block'>
          {userName}
        </span>
        <ChevronDown
          size={14}
          aria-hidden='true'
          className={`text-text-tertiary transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Floating card */}
      {isOpen && (
        <div
          role='menu'
          className='absolute right-0 top-full z-[100] mt-2 w-60 rounded-card border border-border bg-surface py-2 shadow-overlay'
        >
          <div className='px-4 py-2'>
            <p className='truncate text-body-sm font-semibold text-text-primary'>
              {userName}
            </p>
            {userEmail && (
              <p className='truncate text-caption text-text-tertiary'>
                {userEmail}
              </p>
            )}
          </div>
          {userRole && (
            <div className='px-4 pb-2'>
              <span className='inline-flex rounded-pill bg-apple-green-50 px-2 py-0.5 text-caption font-medium capitalize text-apple-green-700'>
                {userRole}
              </span>
            </div>
          )}
          <hr className='my-1 border-border' />
          {profileTo && (
            <Link
              to={profileTo}
              role='menuitem'
              onClick={() => setOpenAtPath(null)}
              className='flex w-full items-center gap-2 px-4 py-2 text-body-sm text-text-primary transition hover:bg-surface-secondary'
            >
              <User size={15} className='shrink-0' aria-hidden='true' />
              My Profile
            </Link>
          )}
          <Link
            to='/settings'
            role='menuitem'
            onClick={() => setOpenAtPath(null)}
            className='flex w-full items-center gap-2 px-4 py-2 text-body-sm text-text-primary transition hover:bg-surface-secondary'
          >
            <Settings size={15} className='shrink-0' aria-hidden='true' />
            Account Settings
          </Link>
          <button
            type='button'
            role='menuitem'
            onClick={handleSignOut}
            className='flex w-full items-center gap-2 px-4 py-2 text-body-sm text-text-primary transition hover:bg-danger-soft hover:text-danger'
          >
            <LogOut size={15} className='shrink-0' aria-hidden='true' />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
