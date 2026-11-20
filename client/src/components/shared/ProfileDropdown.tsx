// components/shared/ProfileDropdown.tsx
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut, User } from 'lucide-react';
import { useSignOut } from '../../hooks/useAuth';
import { Link, useNavigate } from 'react-router-dom';

export function ProfileDropdown({
  userName,
  userEmail,
  userRole,
  profileTo,
}: {
  userName: string;
  userEmail: string;
  userRole: string;
  profileTo?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
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
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
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
    setIsOpen(false);
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
          setIsOpen((prev) => !prev);
        }}
        aria-haspopup='menu'
        aria-expanded={isOpen}
        className='flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition hover:bg-surface-secondary'
      >
        <span className='grid h-7 w-7 shrink-0 place-items-center rounded-full bg-apple-green-50 text-[11px] font-semibold text-apple-green-700'>
          {userName.charAt(0).toUpperCase()}
        </span>
        <span className='hidden text-sm font-medium text-text-primary sm:block'>
          {userName}
        </span>
        <ChevronDown
          size={13}
          className={`text-text-tertiary transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Floating card */}
      {isOpen && (
        <div
          role='menu'
          className='absolute right-0 top-full mt-2 w-56 rounded-xl border border-gray-200 bg-white py-2 shadow-xl z-[100]'
        >
          <div className='px-4 py-2'>
            <p className='truncate text-sm font-medium text-text-primary'>
              {userName}
            </p>
            <p className='truncate text-xs text-text-tertiary'>{userEmail}</p>
          </div>
          <div className='px-4 pb-2'>
            <span className='inline-flex rounded-full bg-apple-green-50 px-2 py-0.5 text-[10px] font-medium capitalize text-apple-green-700'>
              {userRole}
            </span>
          </div>
          <hr className='my-1 border-border' />
          {profileTo && (
            <Link
              to={profileTo}
              role='menuitem'
              onClick={() => setIsOpen(false)}
              className='flex w-full items-center gap-2 px-4 py-2 text-sm text-text-primary transition hover:bg-surface-secondary'
            >
              <User size={14} className='shrink-0' />
              My Profile
            </Link>
          )}
          <button
            type='button'
            role='menuitem'
            onClick={handleSignOut}
            className='flex w-full items-center gap-2 px-4 py-2 text-sm text-apple-green-600 transition hover:bg-apple-green-50 hover:text-apple-green-700'
          >
            <LogOut size={14} className='shrink-0' />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
