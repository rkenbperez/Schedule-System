// components/calendar/FilterBar.tsx
import { Search, List, Calendar } from 'lucide-react';

interface FilterBarProps {
  terms: { code: string; name: string }[];
  sections: { id: number; name: string }[];
  professors: { id: number; name: string }[];
  rooms: { id: number; name: string }[];
  departments: { id: string; name: string }[];
  selectedTerm: string;
  selectedSection: number | 'all';
  selectedProfessor: number | 'all';
  selectedRoom: number | 'all';
  selectedDepartment: string;
  searchQuery: string;
  viewMode: 'grid' | 'list';
  showViewToggle: boolean;
  onTermChange: (v: string) => void;
  onSectionChange: (v: number | 'all') => void;
  onProfessorChange: (v: number | 'all') => void;
  onRoomChange: (v: number | 'all') => void;
  onDepartmentChange: (v: string | 'all') => void;
  onSearchChange: (v: string) => void;
  onReset: () => void;
  onToggleView: () => void;
}

export function FilterBar({
  terms, sections, professors, rooms, departments,
  selectedTerm, selectedSection, selectedProfessor, selectedRoom, selectedDepartment,
  searchQuery, viewMode, showViewToggle,
  onTermChange, onSectionChange, onProfessorChange, onRoomChange, onDepartmentChange,
  onSearchChange, onReset, onToggleView,
}: FilterBarProps) {
  const hasFilters =
    selectedSection !== 'all' ||
    selectedProfessor !== 'all' ||
    selectedRoom !== 'all' ||
    searchQuery.trim() !== '';

  return (
    <div className='rounded-card border border-border bg-surface p-6 mb-6'>
      {/* Row 1: five filter dropdowns in CSS Grid */}
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'>
        <div className='flex flex-col gap-2 z-50'>
          <label className='text-xs font-medium text-text-tertiary uppercase tracking-wide'>
            Academic Term
          </label>
          <select
            value={selectedTerm}
            onChange={(e) => onTermChange(e.target.value)}
            className='h-10 rounded-lg border border-border bg-surface px-3 text-xs text-text-primary outline-none transition focus:border-apple-green-400 focus:ring-2 focus:ring-apple-green-100 z-50'
          >
            {terms.map((t) => (
              <option key={t.code} value={t.code}>{t.name}</option>
            ))}
          </select>
        </div>
        <div className='flex flex-col gap-2 z-50'>
          <label className='text-xs font-medium text-text-tertiary uppercase tracking-wide'>
            Section
          </label>
          <select
            value={String(selectedSection)}
            onChange={(e) => onSectionChange(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className='h-10 rounded-lg border border-border bg-surface px-3 text-xs text-text-primary outline-none transition focus:border-apple-green-400 focus:ring-2 focus:ring-apple-green-100 z-50'
          >
            <option value='all'>All Sections</option>
            {sections.map((s) => (
              <option key={s.id} value={String(s.id)}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className='flex flex-col gap-2 z-50'>
          <label className='text-xs font-medium text-text-tertiary uppercase tracking-wide'>
            Professor
          </label>
          <select
            value={String(selectedProfessor)}
            onChange={(e) => onProfessorChange(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className='h-10 rounded-lg border border-border bg-surface px-3 text-xs text-text-primary outline-none transition focus:border-apple-green-400 focus:ring-2 focus:ring-apple-green-100 z-50'
          >
            <option value='all'>All Professors</option>
            {professors.map((p) => (
              <option key={p.id} value={String(p.id)}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className='flex flex-col gap-2 z-50'>
          <label className='text-xs font-medium text-text-tertiary uppercase tracking-wide'>
            Room
          </label>
          <select
            value={String(selectedRoom)}
            onChange={(e) => onRoomChange(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className='h-10 rounded-lg border border-border bg-surface px-3 text-xs text-text-primary outline-none transition focus:border-apple-green-400 focus:ring-2 focus:ring-apple-green-100 z-50'
          >
            <option value='all'>All Rooms</option>
            {rooms.map((r) => (
              <option key={r.id} value={String(r.id)}>{r.name}</option>
            ))}
          </select>
        </div>
        <div className='flex flex-col gap-2 z-50'>
          <label className='text-xs font-medium text-text-tertiary uppercase tracking-wide'>
            Department
          </label>
          <select
            value={selectedDepartment}
            onChange={(e) => onDepartmentChange(e.target.value)}
            className='h-10 rounded-lg border border-border bg-surface px-3 text-xs text-text-primary outline-none transition focus:border-apple-green-400 focus:ring-2 focus:ring-apple-green-100 z-50'
          >
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div className='flex flex-col gap-2 col-span-1 sm:col-span-2 lg:col-span-3 xl:col-span-3 z-50'>
          <label className='text-xs font-medium text-text-tertiary uppercase tracking-wide'>
            Search
          </label>
          <div className='relative flex-grow'>
            <Search size={14} className='absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary' />
            <input
              type='text'
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder='Search subject, section, professor…'
              className='h-10 w-full pl-9 pr-4 rounded-lg border border-border bg-surface text-xs text-text-primary outline-none transition focus:border-apple-green-400 focus:ring-2 focus:ring-apple-green-100 z-50'
            />
          </div>
        </div>
      </div>

      {/* Row 2: action buttons side-by-side */}
      <div className='mt-4 flex flex-wrap items-end gap-3'>
        <button
          type='button'
          onClick={onReset}
          disabled={!hasFilters}
          className='h-10 shrink-0 whitespace-nowrap rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-secondary transition hover:bg-surface-secondary disabled:opacity-40 disabled:cursor-not-allowed sm:text-sm'
        >
          Reset Filters
        </button>
        {showViewToggle && (
          <button
            type='button'
            onClick={onToggleView}
            className='h-10 shrink-0 whitespace-nowrap rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-secondary transition hover:bg-surface-secondary sm:text-sm flex items-center gap-2'
          >
            {viewMode === 'grid' ? <List size={14} className='mr-1' /> : <Calendar size={14} className='mr-1' />}
            {viewMode === 'grid' ? 'List View' : 'Grid View'}
          </button>
        )}
      </div>
    </div>
  );
}
