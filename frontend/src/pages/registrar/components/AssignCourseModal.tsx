import { useEffect, useMemo, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import {
  availableOfferings,
  type Assignment,
  type CourseOffering,
} from '../registrarData';

interface AssignCourseModalProps {
  department: string;
  existing: Assignment[];
  onClose: () => void;
  onAssign: (offerings: CourseOffering[]) => void;
}

export default function AssignCourseModal({
  department,
  existing,
  onClose,
  onAssign,
}: AssignCourseModalProps) {
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 600);
    return () => window.clearTimeout(timer);
  }, []);

  const offerings = useMemo(() => {
    //store the current assigned courses
    const assignedKeys = new Set(
      existing.map((a) => `${a.course_code}-${a.label}`)
    );

    //return only not assigned courses as options
    return availableOfferings.filter(
      (offering) =>
        offering.department === department &&
        !assignedKeys.has(`${offering.course_code}-${offering.label}`)
    );
  }, [department, existing]);

  const toggle = (id: number) => {
    setSelected((prev) => {
      return prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id];
    });
  };

  const handleAssign = () => {
    onAssign(offerings.filter((offering) => selected.includes(offering.id)));
  };

  return (
    <div
      role='dialog'
      aria-modal='true'
      aria-label='Assign courses'
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4'
      onClick={onClose}
    >
      <div
        className='flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-xl'
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className='flex items-start justify-between gap-3 border-b border-border px-5 py-4'>
          <div>
            <h2 className='text-sm font-medium text-text-primary'>
              Assign courses
            </h2>
            <p className='text-xs text-text-tertiary'>
              Available courses for {department}
            </p>
          </div>

          <button
            type='button'
            onClick={onClose}
            aria-label='Close'
            className='grid h-7 w-7 shrink-0 place-items-center rounded-md text-text-tertiary transition hover:bg-surface-secondary hover:text-text-primary'
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className='min-h-0 flex-1 overflow-y-auto px-5 py-4'>
          {loading ? (
            <div className='flex flex-col items-center gap-2 py-10 text-text-secondary'>
              <Loader2 size={20} className='animate-spin' />
              <span className='text-sm'>Loading available courses…</span>
            </div>
          ) : offerings.length === 0 ? (
            <p className='py-10 text-center text-sm text-text-secondary'>
              No available courses for this department.
            </p>
          ) : (
            <ul className='flex flex-col gap-2'>
              {offerings.map((offering) => {
                const isSelected = selected.includes(offering.id);

                return (
                  <li key={offering.id}>
                    <label
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition ${
                        isSelected
                          ? 'border-apple-green-400 bg-apple-green-50'
                          : 'border-border hover:bg-surface-secondary'
                      }`}
                    >
                      <input
                        type='checkbox'
                        checked={isSelected}
                        onChange={() => toggle(offering.id)}
                        className='h-4 w-4 shrink-0 accent-apple-green-600'
                      />

                      <span className='flex min-w-0 flex-1 flex-col'>
                        <span className='flex items-baseline gap-2'>
                          <span className='text-sm font-medium text-text-primary'>
                            {offering.course_code}
                          </span>
                          <span className='text-xs text-text-tertiary'>
                            section {offering.section_code}
                          </span>
                        </span>
                        <span className='truncate text-xs text-text-secondary'>
                          {offering.course_title}
                        </span>
                      </span>

                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-medium capitalize ${
                          offering.label === 'laboratory'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-apple-green-50 text-apple-green-700'
                        }`}
                      >
                        {offering.label}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className='flex items-center justify-between gap-3 border-t border-border px-5 py-3'>
          <span className='text-xs text-text-tertiary'>
            {selected.length} selected
          </span>

          <div className='flex items-center gap-2'>
            <button
              type='button'
              onClick={onClose}
              className='rounded-md border border-border bg-surface px-4 py-2 text-[13px] font-medium text-text-primary transition hover:bg-surface-secondary'
            >
              Cancel
            </button>

            <button
              type='button'
              onClick={handleAssign}
              disabled={selected.length === 0}
              className='rounded-md bg-apple-green-400 px-4 py-2 text-[13px] font-medium text-white transition hover:bg-apple-green-600 disabled:cursor-not-allowed disabled:opacity-60'
            >
              Assign selected
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
