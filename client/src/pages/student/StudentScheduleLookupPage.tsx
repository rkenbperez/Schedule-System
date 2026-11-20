// pages/student/StudentScheduleLookupPage.tsx
import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Calendar } from 'lucide-react';
import {
  usePublicTerms,
  usePublicTermSchedule,
  usePublicTermSections,
} from '../../hooks/Schedule.hooks';
import { FilterBar } from '../../components/calendar/FilterBar';
import { CalendarGrid } from '../../components/calendar/CalendarGrid';
import { ClassList } from '../../components/calendar/ClassList';
import type { PublicClass } from '../../types/Types';

export default function StudentScheduleLookupPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize state from URL params
  const [selectedTermCode, setSelectedTermCode] = useState<string>(
    searchParams.get('term') ?? ''
  );
  const [selectedSectionId, setSelectedSectionId] = useState<number | 'all'>(
    searchParams.get('section') === 'all' || !searchParams.get('section')
      ? 'all'
      : Number(searchParams.get('section')) || 'all'
  );
  const [selectedProfessorId, setSelectedProfessorId] = useState<
    number | 'all'
  >(
    searchParams.get('professor') === 'all' || !searchParams.get('professor')
      ? 'all'
      : Number(searchParams.get('professor')) || 'all'
  );
  const [selectedRoomId, setSelectedRoomId] = useState<number | 'all'>(
    searchParams.get('room') === 'all' || !searchParams.get('room')
      ? 'all'
      : Number(searchParams.get('room')) || 'all'
  );
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>(
    searchParams.get('department') ?? ''
  );
  const [searchQuery, setSearchQuery] = useState(
    searchParams.get('search') ?? ''
  );
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(
    (searchParams.get('view') as 'grid' | 'list') ?? 'grid'
  );

  const {
    data: terms,
    isLoading: termsLoading,
  } = usePublicTerms();

  const {
    data: termSchedule,
    isLoading: scheduleLoading,
  } = usePublicTermSchedule(selectedTermCode, { enabled: !!selectedTermCode });

  const {
    data: termSections,
    isLoading: sectionsLoading,
  } = usePublicTermSections(selectedTermCode, { enabled: !!selectedTermCode });

  // Sync URL params when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedTermCode) params.set('term', selectedTermCode);
    if (selectedSectionId !== 'all') params.set('section', String(selectedSectionId));
    else params.delete('section');
    if (selectedProfessorId !== 'all') params.set('professor', String(selectedProfessorId));
    else params.delete('professor');
    if (selectedRoomId !== 'all') params.set('room', String(selectedRoomId));
    else params.delete('room');
    if (selectedDepartmentId) params.set('department', selectedDepartmentId);
    else params.delete('department');
    if (searchQuery.trim()) params.set('search', searchQuery.trim());
    else params.delete('search');
    params.set('view', viewMode);
    setSearchParams(params);
  }, [
    selectedTermCode,
    selectedSectionId,
    selectedProfessorId,
    selectedRoomId,
    selectedDepartmentId,
    searchQuery,
    viewMode,
    setSearchParams,
  ]);

  // Auto-select active or latest published term on load
  useEffect(() => {
    if (terms?.length && !selectedTermCode) {
      const active = terms.find((t: { is_active: boolean }) => t.is_active);
      const latest = terms[0]; // already ordered by -year, -semester
      const timer = setTimeout(() => {
        setSelectedTermCode((active ?? latest).code);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [terms, selectedTermCode]);

  const classes: PublicClass[] = useMemo(
    () => (termSchedule?.schedule ?? []) as PublicClass[],
    [termSchedule]
  );

  const sections = termSections?.sections ?? [];

  const departments = useMemo(() => {
    const seen = new Set<string>();
    const result: Array<{ id: string; name: string }> = [];

    for (const c of classes) {
      const dept = c.department_name;
      if (!dept || seen.has(dept)) continue;
      seen.add(dept);
      result.push({ id: dept, name: dept });
    }

    return result.sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));
  }, [classes]);

  // Auto-select first department when departments load or current dept is invalid
  useEffect(() => {
    if (departments.length === 0) return;
    const isValid = departments.some((d) => d.id === selectedDepartmentId);
    if (!selectedDepartmentId || !isValid) {
      const timer = setTimeout(() => {
        setSelectedDepartmentId(departments[0].id);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [departments, selectedDepartmentId]);

  // When department changes, auto-set section to first section in that department
  useEffect(() => {
    if (!selectedDepartmentId || sections.length === 0) return;
    const deptSections = sections.filter((s) => s.program === selectedDepartmentId);
    const timer = setTimeout(() => {
      if (deptSections.length > 0) {
        setSelectedSectionId(deptSections[0].id);
      } else {
        setSelectedSectionId('all');
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [selectedDepartmentId, sections]);

  const professors = useMemo(() => {
    const seen = new Set<number>();
    return classes
      .filter((c: PublicClass) => {
        if (seen.has(c.professor.id)) return false;
        seen.add(c.professor.id);
        return true;
      })
      .map((c: PublicClass) => c.professor);
  }, [classes]);

  // Departments filtered by section selection
  const filteredDepartments = useMemo(() => {
    if (selectedSectionId !== 'all') {
      const selectedSection = sections.find(s => s.id === selectedSectionId);
      if (selectedSection?.program) {
        return [{ id: selectedSection.program, name: selectedSection.program }];
      }
      return [];
    }
    return departments;
  }, [sections, selectedSectionId, departments]);

  // Sections filtered by department selection
  const filteredSections = useMemo(() => {
    return sections.filter((s) => s.program === selectedDepartmentId);
  }, [sections, selectedDepartmentId]);

  // Professors filtered by department selection
  const filteredProfessors = useMemo(() => {
    return professors.filter((p) =>
      classes.some((c) => c.professor.id === p.id && c.department_name === selectedDepartmentId)
    );
  }, [professors, selectedDepartmentId, classes]);

  const rooms = useMemo(() => {
    const seen = new Set<number>();
    return classes
      .filter((c: PublicClass) => {
        if (c.room && seen.has(c.room.id)) return false;
        if (c.room) seen.add(c.room.id);
        return !!c.room;
      })
      .map((c: PublicClass) => c.room!)
      .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));
  }, [classes]);

  const filteredClasses = useMemo(() => {
    return classes.filter((c: PublicClass) => {
      if (selectedSectionId !== 'all' && c.section.id !== selectedSectionId)
        return false;
      if (selectedProfessorId !== 'all' && c.professor.id !== selectedProfessorId)
        return false;
      if (selectedRoomId !== 'all') {
        if (!c.room || c.room.id !== selectedRoomId) return false;
      }
      if (c.department_name !== selectedDepartmentId)
        return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const haystack = [
          c.subject.code,
          c.subject.title,
          c.section.name,
          c.department_name,
          c.professor.name,
          c.room?.name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [
    classes,
    selectedSectionId,
    selectedProfessorId,
    selectedRoomId,
    selectedDepartmentId,
    searchQuery,
  ]);

  const selectedTermObj = terms?.find((t: { code: string }) => t.code === selectedTermCode);

  const allFiltersClear =
    selectedSectionId === 'all' &&
    selectedProfessorId === 'all' &&
    selectedRoomId === 'all' &&
    searchQuery.trim() === '';

  // Auto-switch to list view when no filters are active (avoids overlapping grid mess)
  const effectiveViewMode = allFiltersClear ? 'list' : viewMode;
  const showViewToggle = filteredClasses.length > 0;

  const isSingleFilter =
    selectedSectionId !== 'all' ||
    selectedProfessorId !== 'all' ||
    selectedRoomId !== 'all' ||
    selectedDepartmentId !== 'all';

  const handleResetFilters = () => {
    setSelectedSectionId(filteredSections.length > 0 ? filteredSections[0].id : 'all');
    setSelectedProfessorId('all');
    setSelectedRoomId('all');
    setSearchQuery('');
  };

  if (termsLoading || sectionsLoading || scheduleLoading) {
    return (
      <section className='w-full px-4 py-8'>
        <div className='flex flex-col items-center justify-center py-20 text-text-tertiary text-sm'>
          <div className='mb-3 opacity-50'>
            <Calendar size={32} />
          </div>
          <p className='text-sm font-medium text-text-primary'>
            Loading schedule…
          </p>
        </div>
      </section>
    );
  }

  if (!terms || terms.length === 0) {
    return (
      <section className='w-full px-4 py-8'>
        <div className='rounded-card border border-border bg-surface p-8 text-center'>
          <Calendar size={48} className='mx-auto mb-4 opacity-50' />
          <h3 className='text-sm font-medium text-text-primary mb-1'>
            No published schedules available
          </h3>
          <p className='text-xs text-text-tertiary'>
            There are no published academic terms yet. Please check back later.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className='w-full px-4 py-8'>
      <p className='mb-6 text-sm text-text-secondary'>
        {selectedTermObj?.name ?? '1st semester, 2026 to 2027'}
      </p>

      <FilterBar
        terms={terms}
        sections={filteredSections}
        professors={filteredProfessors}
        rooms={rooms}
        departments={filteredDepartments}
        selectedTerm={selectedTermCode}
        selectedSection={selectedSectionId}
        selectedProfessor={selectedProfessorId}
        selectedRoom={selectedRoomId}
        selectedDepartment={selectedDepartmentId}
        searchQuery={searchQuery}
        viewMode={effectiveViewMode}
        showViewToggle={showViewToggle}
        onTermChange={setSelectedTermCode}
        onSectionChange={setSelectedSectionId}
        onProfessorChange={setSelectedProfessorId}
        onRoomChange={setSelectedRoomId}
        onDepartmentChange={setSelectedDepartmentId}
        onSearchChange={setSearchQuery}
        onReset={handleResetFilters}
        onToggleView={() => setViewMode((v) => (v === 'grid' ? 'list' : 'grid'))}
      />

      {filteredClasses.length === 0 && (
        <div className='rounded-card border border-border bg-surface p-16 text-center'>
          <Calendar size={48} className='mx-auto mb-4 opacity-50' />
          <h3 className='text-sm font-medium text-text-primary mb-1'>
            No classes found
          </h3>
          <p className='text-xs text-text-tertiary'>
            No published classes match your current filters. Try adjusting your
            search or reset filters.
          </p>
          <button
            type='button'
            onClick={handleResetFilters}
            className='mt-4 flex items-center gap-1.5 text-xs font-medium text-apple-green-600 hover:text-apple-green-700'
          >
            Reset Filters
          </button>
        </div>
      )}

      {viewMode === 'grid' && filteredClasses.length > 0 && (
        <CalendarGrid
          classes={filteredClasses}
          viewBySection={isSingleFilter}
        />
      )}

      {viewMode === 'list' && filteredClasses.length > 0 && (
        <ClassList classes={filteredClasses} />
      )}
    </section>
  );
}