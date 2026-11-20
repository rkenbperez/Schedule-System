// pages/registrar/RegistrarScheduleManagementPage.tsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  RefreshCw,
} from 'lucide-react';
import {
  useImportPreview,
  useImportCommit,
  useImportTemplate,
  useGenerateSchedule,
  usePublishRun,
  useCompareAlgorithms,
  useTerms,
} from '../../hooks/Schedule.hooks';
import { useQueryClient } from '@tanstack/react-query';
import { useMe } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import type {
  AcademicTerm,
  GenerateSchedulePayload,
  GenerateScheduleResponse,
  ImportPreviewItem,
  ImportPreviewResponse,
} from '../../types/Types';

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const getSelectableImportKeys = (result: ImportPreviewResponse) =>
  Object.entries(result.preview_items ?? {}).flatMap(([sheet, items]) =>
    items
      .filter((item) => item.action !== 'error')
      .map((item) => `${sheet}:${item.row}`)
  );

export default function RegistrarScheduleManagementPage() {
  const importPreview = useImportPreview();
  const importCommit = useImportCommit();
  const importTemplate = useImportTemplate();
  const generateSchedule = useGenerateSchedule();
  const publishRun = usePublishRun();
  const compareAlgorithms = useCompareAlgorithms();
  const { data: terms } = useTerms();
  const queryClient = useQueryClient();

  const [file, setFile] = useState<File | null>(null);
  const [previewResult, setPreviewResult] =
    useState<ImportPreviewResponse | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [selectedImportKeys, setSelectedImportKeys] = useState<Set<string>>(new Set());
  const [previewTab, setPreviewTab] = useState<'all' | 'Professors' | 'Subjects' | 'SectionsRooms' | 'Assignments' | 'Errors'>('all');
  const [previewFilter, setPreviewFilter] = useState<'all' | 'create' | 'update' | 'error'>('all');

  const [algorithm, setAlgorithm] = useState<
    'greedy' | 'min_conflicts' | 'backtracking'
  >('greedy');
  const [timeLimitS, setTimeLimitS] = useState<number | null>(30);
  const [selectedTermId, setSelectedTermId] = useState<number | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generateResult, setGenerateResult] =
    useState<GenerateScheduleResponse | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [comparisonResults, setComparisonResults] = useState<
    GenerateScheduleResponse[] | null
  >(null);
  const [isComparing, setIsComparing] = useState(false);

  const { data: me } = useMe();
  const toast = useToast();

  const isRegistrar = !!me?.is_staff;

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isGenerating]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['.xlsx', '.xls', '.csv'];
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!validTypes.includes(fileExt)) {
      setPreviewError(
        'Please upload a valid Excel or CSV file (.xlsx, .xls, .csv)'
      );
      return;
    }

    setFile(file);
    setPreviewError(null);
    setPreviewResult(null);
    setSelectedImportKeys(new Set());
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.classList.add('bg-apple-green-50', 'border-apple-green-300');
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.classList.remove(
      'bg-apple-green-50',
      'border-apple-green-300'
    );
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.classList.remove(
      'bg-apple-green-50',
      'border-apple-green-300'
    );
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setFile(file);
      setPreviewError(null);
      setPreviewResult(null);
    }
  };

  const handlePreview = () => {
    if (!file) return;

    // Ensure the user is authenticated as a registrar before calling the API.
    // The backend ImportPreviewView requires IsRegistrar permission.
    if (!isRegistrar) {
      setPreviewError(
        'Please sign in with a registrar account to preview imports.'
      );
      return;
    }

    setPreviewError(null);
    importPreview.mutate(file, {
      onSuccess: (data: ImportPreviewResponse) => {
        setPreviewResult(data);
        setSelectedImportKeys(new Set(getSelectableImportKeys(data)));
      },
      onError: (err: Error) => {
        setPreviewError(
          err.message.includes('403') || err.message.includes('Forbidden')
            ? 'Access denied: please sign in with a registrar account to preview imports.'
            : err.message
        );
      },
    });
  };

  const handleRemoveFile = () => {
    setFile(null);
    setPreviewResult(null);
    setPreviewError(null);
    setSelectedImportKeys(new Set());
  };

  const handleDownloadTemplate = (format: 'xlsx' | 'csv') => {
    importTemplate.mutate(format, {
      onSuccess: (blob: Blob) => {
        const filename =
          format === 'xlsx'
            ? 'schedule_import_template.xlsx'
            : 'schedule_import_template.zip';
        downloadBlob(blob, filename);
        toast.addToast({
          type: 'success',
          title: `Template downloaded (${
            format === 'xlsx' ? 'Excel' : 'CSV bundle'
          }).`,
          description: 'Open it in Excel/Sheets or unzip the CSV bundle to fill it in.',
        });
      },
      onError: () => {
        toast.addToast({
          type: 'error',
          title: 'Failed to download template.',
        });
      },
    });
  };

  const handleGenerate = () => {
    setGenerateError(null);
    setGenerateResult(null);
    setElapsedSeconds(0);
    setIsGenerating(true);

    const payload: GenerateSchedulePayload = {
      algorithm,
      ...(effectiveTermId !== null ? { term_id: effectiveTermId } : {}),
      ...(timeLimitS !== null && timeLimitS > 0
        ? { time_limit_s: timeLimitS }
        : {}),
    };

    generateSchedule.mutate(payload, {
      onSuccess: (data) => {
        setGenerateResult(data);
        setIsGenerating(false);
        toast.addToast({
          type: 'success',
          title: 'Schedule generated successfully.',
          description: `${data.class_count} classes placed (${data.runtime_ms}ms)`,
        });
      },
      onError: (err: Error) => {
        toast.addToast({ type: 'error', title: err.message });
        setIsGenerating(false);
      },
    });
  };

  const handleCompareAlgorithms = async () => {
    setGenerateError(null);
    setGenerateResult(null);
    setIsComparing(true);
    try {
      const results = await compareAlgorithms.mutateAsync({
        timeLimitS: timeLimitS ?? undefined,
        termId: effectiveTermId ?? undefined,
      });
      setComparisonResults(results);
      toast.addToast({
        type: 'success',
        title: 'Schedule comparison complete.',
        description: `Ran ${results.length} algorithms.`,
      });
    } catch (err) {
      toast.addToast({
        type: 'error',
        title: err instanceof Error ? err.message : 'Algorithm comparison failed.',
      });
    } finally {
      setIsComparing(false);
    }
  };

  const handlePublish = () => {
    if (!generateResult?.run_id) return;
    publishRun.mutate(generateResult.run_id, {
      onSuccess: () => {
        setGenerateResult((prev) =>
          prev ? { ...prev, published: true } : prev
        );
        toast.addToast({
          type: 'success',
          title: 'Schedule published.',
        });
      },
      onError: () => {
        toast.addToast({ type: 'error', title: 'Unable to publish schedule.' });
      },
    });
  };

  const handleCommitImport = () => {
    importCommit.mutate({
      previewToken: previewResult?.preview_token ?? '',
      selectedKeys: Array.from(selectedImportKeys),
    }, {
      onSuccess: () => {
        toast.addToast({
          type: 'success',
          title: 'Import committed successfully.',
        });
        queryClient.invalidateQueries({
          queryKey: ['all-assignments'],
        });
        queryClient.invalidateQueries({
          queryKey: ['registrar-all-assignments'],
        });
        queryClient.invalidateQueries({
          queryKey: ['registrar-all-schedules'],
        });
        setPreviewResult(null);
      },
      onError: (err: Error) => {
        toast.addToast({ type: 'error', title: err.message || 'Import commit failed.' });
      },
    });
  };


  if (isGenerating) {
    return (
      <section className='w-full max-w-7xl px-6 py-6'>
        <Link
          to='/registrar/dashboard'
          className='mb-4 inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary'
        >
          <ArrowLeft size={15} />
          Back to dashboard
        </Link>

        <div className='rounded-card border border-apple-green-200 bg-apple-green-50 p-6'>
          <div className='flex items-center gap-3 mb-4'>
            <RefreshCw size={20} className='text-apple-green-600 animate-spin' />
            <h2 className='text-lg font-medium text-text-primary'>
              Generating Academic Schedule
            </h2>
          </div>
          <p className='text-sm text-text-secondary mb-4'>
            Processing all assignments for the active academic term.
          </p>

          <div className='grid grid-cols-3 gap-6'>
            <div className='flex items-center gap-3'>
              <span className='text-sm font-medium text-text-secondary'>
                Algorithm:
              </span>
              <span className='text-sm font-medium text-apple-green-700'>
                {algorithm}
              </span>
            </div>
            <div className='flex items-center gap-3'>
              <span className='text-sm font-medium text-text-secondary'>
                Time limit:
              </span>
              <span className='text-sm font-medium text-apple-green-700'>
                {timeLimitS} seconds
              </span>
            </div>
            <div className='flex items-center gap-3'>
              <span className='text-sm font-medium text-text-secondary'>
                Elapsed time:
              </span>
              <span className='text-sm font-medium text-apple-green-700'>
                {Math.floor(elapsedSeconds / 60)}:
                {String(elapsedSeconds % 60).padStart(2, '0')}
              </span>
            </div>
          </div>

          <p className='text-sm text-text-secondary mt-4'>
            Please wait while the scheduling engine calculates the timetable.
          </p>
        </div>
      </section>
    );
  }

  const getFilteredItems = () => {
    if (!previewResult) return [];

    let items: ImportPreviewItem[] = [];

    switch (previewTab) {
      case 'all':
        items = Object.values(previewResult.preview_items ?? {}).flat();
        break;
      case 'Professors':
        items = previewResult.preview_items?.Professors ?? [];
        break;
      case 'Subjects':
        items = previewResult.preview_items?.Subjects ?? [];
        break;
      case 'SectionsRooms':
        items = [
          ...(previewResult.preview_items?.Sections ?? []),
          ...(previewResult.preview_items?.Rooms ?? []),
        ];
        break;
      case 'Assignments':
        items = previewResult.preview_items?.Assignments ?? [];
        break;
      case 'Errors':
        items = Object.values(previewResult.preview_items ?? {}).flat().filter(
          (i) => i.action === 'error'
        );
        break;
    }

    if (previewFilter !== 'all') {
      items = items.filter((i) => i.action === previewFilter);
    }

    return items;
  };

  const statusPill = (action: string) => {
    switch (action) {
      case 'create':
        return 'bg-apple-green-50 text-apple-green-700';
      case 'update':
        return 'bg-amber-50 text-amber-700';
      case 'error':
        return 'bg-red-50 text-red-700';
      default:
        return 'bg-surface-secondary text-text-tertiary';
    }
  };

  const statusLabel = (action: string) => {
    switch (action) {
      case 'create':
        return 'New';
      case 'update':
        return 'Updated';
      case 'error':
        return 'Error';
      default:
        return action;
    }
  };

  const renderRowDetails = (item: ImportPreviewItem) => {
    const d = item.data as Record<string, string | number | boolean | null>;
    if (previewTab === 'Errors') return '';

    switch (d.user_id !== undefined ? 'Professors' : previewTab) {
      case 'Professors':
        return (
          <>
            <span className='text-text-primary'>User #{d.user_id}</span>{' '}
            <span className='text-text-tertiary'>· Dept #{d.department_id}</span>
          </>
        );
      case 'Subjects':
        return (
          <>
            <span className='text-text-primary font-medium'>{d.code}</span>{' '}
            <span className='text-text-tertiary'>{d.title}</span>
          </>
        );
      case 'SectionsRooms':
        if (d.name !== undefined && d.headcount !== undefined) {
          return (
            <>
              <span className='text-text-primary font-medium'>{d.name}</span>{' '}
              <span className='text-text-tertiary'>
                · {d.headcount} students
              </span>
            </>
          );
        }
        return (
          <>
            <span className='text-text-primary font-medium'>{d.name}</span>{' '}
            <span className='text-text-tertiary'>· Cap {d.capacity}</span>
          </>
        );
      case 'Assignments':
        return (
          <>
            <span className='text-text-tertiary'>Prof #{d.professor_id}</span>{' · '}
            <span className='text-text-tertiary'>Subj #{d.subject_id}</span>{' · '}
            <span className='text-text-tertiary'>Sec #{d.section_id}</span>
          </>
        );
      default:
        return Object.entries(d)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ');
    }
  };

  const getImportItemKey = (item: ImportPreviewItem) => {
    const sheet = Object.entries(previewResult?.preview_items ?? {}).find(
      ([, items]) => items.includes(item)
    )?.[0];
    return sheet ? `${sheet}:${item.row}` : '';
  };

  const toggleImportSelection = (key: string) => {
    setSelectedImportKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const renderPreviewRows = () => {
    if (!previewResult) return null;

    const items = getFilteredItems();
    return items.map((item) => (
      <tr
        key={getImportItemKey(item)}
        className={`border-b border-border-light hover:bg-surface-secondary ${
          item.errors.length > 0
            ? 'border-l-4 border-red-500 bg-red-50/50'
            : ''
        }`}
      >
        {previewTab === 'Errors' ? (
          <>
            <td className='px-3 py-2 text-text-tertiary'>
              {String(item.data.sheet ?? '')}
            </td>
            <td className='px-3 py-2 text-text-tertiary'>{item.row}</td>
            <td className='px-3 py-2 text-text-tertiary'>
              {String(item.data.field ?? '')}
            </td>
            <td className='px-3 py-2 text-red-600 truncate max-w-xs'>
              {item.errors.join(', ')}
            </td>
          </>
        ) : (
          <>
            <td className='px-3 py-2'>
              <input
                type='checkbox'
                aria-label={`Select row ${item.row}`}
                checked={selectedImportKeys.has(getImportItemKey(item))}
                onChange={() => toggleImportSelection(getImportItemKey(item))}
                className='rounded border-border text-apple-green-600 focus:ring-apple-green-500'
              />
            </td>
            <td className='px-3 py-2'>
              <span
                className={`px-2 py-0.5 rounded-full text-[9px] font-medium ${statusPill(item.action)}`}
              >
                {statusLabel(item.action)}
              </span>
            </td>
            <td className='px-3 py-2 text-text-tertiary truncate'>
              {String(item.data.sheet ?? previewTab)}
            </td>
            <td className='px-3 py-2 text-text-tertiary'>{item.row}</td>
            <td className='px-3 py-2 text-text-primary truncate max-w-xs'>
              {renderRowDetails(item)}
              {item.errors.length > 0 && (
                <div className='mt-1 text-[10px] text-red-600 font-medium'>
                  {item.errors.join(' · ')}
                </div>
              )}
            </td>
          </>
        )}
      </tr>
    ));
  };

  const selectableImportKeys = previewResult
    ? getSelectableImportKeys(previewResult)
    : [];

  const activeTerms = (terms ?? []).filter((t) => t.is_active);
  const effectiveTermId = selectedTermId ?? activeTerms[0]?.id ?? null;

  return (
    <section className='w-full max-w-7xl px-6 py-6'>
      <div className='flex items-center justify-between mb-6'>
        <div>
          <Link
            to='/registrar/dashboard'
            className='mb-2 inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary'
          >
            <ArrowLeft size={15} />
            Back to dashboard
          </Link>
          <h1 className='text-lg font-medium text-text-primary mt-1'>
            Registrar: Schedule Management
          </h1>
        </div>
      </div>
      <p className='mb-6 text-sm text-text-secondary'>
        Import academic data and generate schedules for the active term.
      </p>

      {/* Import Section */}
      <div className='rounded-card border border-border bg-surface p-6 mb-8'>
        <div className='flex items-center justify-between mb-4'>
          <h2 className='text-sm font-medium text-text-primary'>
            Import Academic Data
          </h2>
          <div className='flex gap-2'>
            <button
              type='button'
              onClick={() => handleDownloadTemplate('xlsx')}
              disabled={importTemplate.isPending}
              className='flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 text-xs font-medium text-text-primary transition hover:bg-surface-secondary disabled:opacity-60'
            >
              <Download size={14} />
              {importTemplate.isPending ? 'Preparing…' : 'Download Excel Template'}
            </button>
            <button
              type='button'
              onClick={() => handleDownloadTemplate('csv')}
              disabled={importTemplate.isPending}
              className='flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 text-xs font-medium text-text-primary transition hover:bg-surface-secondary disabled:opacity-60'
            >
              <Download size={14} />
              {importTemplate.isPending ? 'Preparing…' : 'Download Sample CSV'}
            </button>
          </div>
        </div>
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => {
            const input = document.querySelector(
              'input[type="file"]'
            ) as HTMLInputElement | null;
            input?.click();
          }}
          className='relative rounded-lg border border-dashed border-border bg-surface-secondary p-8 text-center cursor-pointer hover:bg-apple-green-50 hover:border-apple-green-300 transition'
        >
          <Download size={32} className='mx-auto mb-3 text-apple-green-400' />
          <p className='text-sm font-medium text-text-primary mb-1'>
            Drag &amp; drop a file here
          </p>
          <p className='text-xs text-text-secondary mb-4'>or click to browse</p>
          <input
            type='file'
            accept='.xlsx,.xls,.csv'
            onChange={handleFileChange}
            className='sr-only'
          />
        </div>

        {file && (
          <div className='mt-4 rounded-lg border border-border bg-surface p-4 flex items-center gap-3'>
            <Download size={16} className='text-text-secondary' />
            <div className='flex-1'>
              <p className='text-sm font-medium text-text-primary'>
                {file.name}
              </p>
              <p className='text-xs text-text-secondary'>
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <button
              type='button'
              onClick={handleRemoveFile}
              className='text-xs text-apple-green-600 hover:text-apple-green-700 underline'
            >
              Remove
            </button>
          </div>
        )}

        {/* Format Guide */}
        <div className='mt-6 rounded-lg border border-border bg-surface p-5'>
          <h3 className='text-xs font-medium text-text-primary mb-3 flex items-center gap-1.5'>
            <Download size={13} className='text-text-secondary' />
            Format Guide
          </h3>
          <div className='grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3'>
            <div className='rounded-lg border border-border bg-surface-secondary p-3'>
              <p className='font-medium text-text-primary mb-1'>Expected sheets</p>
              <ul className='list-disc pl-4 space-y-1 text-text-secondary leading-relaxed'>
                <li>Departments</li>
                <li>Rooms</li>
                <li>Subjects</li>
                <li>Sections</li>
                <li>Professors</li>
                <li>Assignments</li>
                <li>Meetings</li>
                <li>Availability</li>
                <li>BusyBlocks</li>
              </ul>
            </div>
            <div className='rounded-lg border border-border bg-surface-secondary p-3'>
              <p className='font-medium text-text-primary mb-1'>Required columns (per sheet)</p>
              <ul className='list-disc pl-4 space-y-1 text-text-secondary leading-relaxed text-[10px]'>
                <li>Departments: name</li>
                <li>Rooms: name, capacity</li>
                <li>Subjects: code, title</li>
                <li>Sections: name, headcount</li>
                <li>Professors: user_id</li>
                <li>Assignments: professor_id, subject_id, section_id</li>
                <li>Meetings: assignment_id, order, mode</li>
                <li>Availability: professor_id, day, start_time, end_time</li>
                <li>BusyBlocks: professor_id, day, start_time, end_time</li>
              </ul>
            </div>
            <div className='rounded-lg border border-border bg-surface-secondary p-3'>
              <p className='font-medium text-text-primary mb-1'>Allowed values</p>
              <ul className='list-disc pl-4 space-y-1 text-text-secondary leading-relaxed text-[10px]'>
                <li>
                  Delivery mode: <span className='font-mono text-text-primary'>async</span>,
                  {' '}<span className='font-mono text-text-primary'>sync</span>,{' '}
                  <span className='font-mono text-text-primary'>lab</span>
                </li>
                <li>Day: <span className='font-mono text-text-primary'>0-5</span> (Mon-Sat)</li>
                <li>Room types: use descriptive names (e.g.{' '}
                  <span className='font-mono text-text-primary'>CS Lecture Room 1</span>)
                </li>
                <li>Time format: <span className='font-mono text-text-primary'>HH:MM</span> (24-hour)</li>
                <li>Capacity, headcount, units: positive integers</li>
              </ul>
            </div>
          </div>
          <p className='mt-3 text-[10px] text-text-tertiary leading-relaxed'>
            Download the Excel template or CSV bundle above for ready-to-fill sample
            rows matching this exact schema. Leave 'id' blank to create new records;
            provide an existing id to update them.
          </p>
        </div>

        {file && (
          <button
            type='button'
            onClick={handlePreview}
            disabled={importPreview.isPending}
            className='mt-4 flex w-full h-10 items-center justify-center gap-2 rounded-lg bg-apple-green-600 text-sm font-medium text-white transition hover:bg-apple-green-700 disabled:opacity-60'
          >
            {importPreview.isPending ? 'Previewing…' : 'Preview Import'}
          </button>
        )}

        {previewError && (
          <div className='mt-3 rounded-lg border border-red-200 bg-red-50 p-3'>
            <p className='text-sm text-red-700'>{previewError}</p>
          </div>
        )}

        {previewResult && (
          <div className='mt-4 rounded-lg border border-border bg-surface p-4'>
            {/* Summary bar */}
            <div className='flex gap-4 text-xs mb-3'>
              <span className='text-apple-green-600 font-medium'>
                {previewResult.summary.creates} new
              </span>
              <span className='text-amber-600 font-medium'>
                {previewResult.summary.updates} updated
              </span>
              <span className='text-red-600 font-medium'>
                {previewResult.errors.length} errors
              </span>
            </div>

            {/* Tab navigation */}
            <div className='flex gap-1 overflow-x-auto pb-2 mb-3 scrollbar-hide'>
              <button
                onClick={() => setPreviewTab('all')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                  previewTab === 'all'
                    ? 'bg-apple-green-100 text-apple-green-700'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-secondary'
                }`}
              >
                All Changes ({Object.values(previewResult.preview_items ?? {}).flat().length})
              </button>
              <button
                onClick={() => setPreviewTab('Professors')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                  previewTab === 'Professors'
                    ? 'bg-apple-green-100 text-apple-green-700'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-secondary'
                }`}
              >
                Professors ({previewResult.preview_items?.Professors?.length ?? 0})
              </button>
              <button
                onClick={() => setPreviewTab('Subjects')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                  previewTab === 'Subjects'
                    ? 'bg-apple-green-100 text-apple-green-700'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-secondary'
                }`}
              >
                Subjects ({previewResult.preview_items?.Subjects?.length ?? 0})
              </button>
              <button
                onClick={() => setPreviewTab('SectionsRooms')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                  previewTab === 'SectionsRooms'
                    ? 'bg-apple-green-100 text-apple-green-700'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-secondary'
                }`}
              >
                Sections / Rooms ({(previewResult.preview_items?.Sections?.length ?? 0) + (previewResult.preview_items?.Rooms?.length ?? 0)})
              </button>
              <button
                onClick={() => setPreviewTab('Assignments')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                  previewTab === 'Assignments'
                    ? 'bg-apple-green-100 text-apple-green-700'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-secondary'
                }`}
              >
                Assignments ({previewResult.preview_items?.Assignments?.length ?? 0})
              </button>
              {previewResult.errors.length > 0 && (
                <button
                  onClick={() => setPreviewTab('Errors')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                    previewTab === 'Errors'
                      ? 'bg-red-50 text-red-700 border border-red-100'
                      : 'text-red-600 hover:text-red-700 hover:bg-red-50'
                  }`}
                >
                  Errors ({previewResult.errors.length})
                </button>
              )}
            </div>

            {/* Filter toggle */}
            <div className='flex items-center gap-2 mb-3'>
              <span className='text-[10px] text-text-tertiary'>Filter:</span>
              {[
                { label: 'All', value: 'all' },
                { label: 'New', value: 'create' },
                { label: 'Updated', value: 'update' },
                { label: 'Errors', value: 'error' },
              ].map((f) => (
                <button
                  key={f.value}
                  onClick={() => setPreviewFilter(f.value as typeof previewFilter)}
                  className={`px-2 py-1 text-[10px] rounded-md border transition ${
                    previewFilter === f.value
                      ? 'border-apple-green-500 text-apple-green-700 bg-apple-green-50'
                      : 'border-transparent text-text-tertiary hover:text-text-primary'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Preview table */}
            <div className='max-h-72 overflow-y-auto border border-border rounded-lg'>
              <table className='w-full text-xs border-collapse'>
                <thead>
                  <tr className='sticky top-0 z-10 bg-surface border-b border-border'>
                    {previewTab === 'Errors' ? (
                      <>
                        <th className='px-3 py-1.5 text-left text-text-secondary'>Sheet</th>
                        <th className='px-3 py-1.5 text-left text-text-secondary'>Row</th>
                        <th className='px-3 py-1.5 text-left text-text-secondary'>Field</th>
                        <th className='px-3 py-1.5 text-left text-text-secondary'>Message</th>
                      </>
                    ) : (
                      <>
                        <th className='px-3 py-1.5 text-left text-text-secondary w-8'>
                          <input
                            type='checkbox'
                            aria-label='Select All / Deselect All'
                            title='Select All / Deselect All'
                            checked={
                              selectableImportKeys.length > 0 &&
                              selectableImportKeys.every((key) =>
                                selectedImportKeys.has(key)
                              )
                            }
                            onChange={(e) =>
                              setSelectedImportKeys(
                                e.target.checked
                                  ? new Set(selectableImportKeys)
                                  : new Set()
                              )
                            }
                            className='rounded border-border text-apple-green-600 focus:ring-apple-green-500'
                          />
                        </th>
                        <th className='px-3 py-1.5 text-left text-text-secondary'>Status</th>
                        <th className='px-3 py-1.5 text-left text-text-secondary'>Type</th>
                        <th className='px-3 py-1.5 text-left text-text-secondary'>Row</th>
                        <th className='px-3 py-1.5 text-left text-text-secondary'>Details</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {renderPreviewRows()}
                </tbody>
              </table>
              {getFilteredItems().length === 0 && (
                <div className='flex flex-col items-center justify-center py-12 text-text-tertiary text-sm'>
                  No items to display.
                </div>
              )}
            </div>

            {/* Save Import button */}
            <div className='mt-4 flex justify-end gap-2'>
              <button
                type='button'
                onClick={handleCommitImport}
                disabled={
                  !previewResult?.preview_token ||
                  importCommit.isPending
                }
                className='flex h-8 items-center justify-center gap-2 rounded-md bg-apple-green-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-apple-green-700 disabled:opacity-60'
              >
                {importCommit.isPending ? 'Committing…' : 'Save Import'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Schedule Generation Section */}
      <div className='rounded-card border border-border bg-surface p-6 mb-8'>
        <h2 className='text-sm font-medium text-text-primary mb-4'>
          Generate Schedule
        </h2>
        <p className='text-sm text-text-secondary mb-4'>
          Generate schedules for the active term.
        </p>

        <div className='grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-4'>
          <div className='flex flex-col gap-2'>
            <label className='text-xs font-medium text-text-secondary'>
              Algorithm
            </label>
            <select
              value={algorithm}
              onChange={(e) => setAlgorithm(e.target.value as typeof algorithm)}
              className='h-10 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary outline-none transition focus:border-apple-green-400 focus:ring-2 focus:ring-apple-green-100'
            >
              <option value='greedy'>Greedy</option>
              <option value='min_conflicts'>Min Conflicts</option>
              <option value='backtracking'>Backtracking</option>
            </select>
          </div>

          <div className='flex flex-col gap-2'>
            <label className='text-xs font-medium text-text-secondary'>
              Time limit (s)
            </label>
            <select
              value={timeLimitS ?? ''}
              onChange={(e) =>
                setTimeLimitS(e.target.value ? Number(e.target.value) : null)}
              className='h-10 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary outline-none transition focus:border-apple-green-400 focus:ring-2 focus:ring-apple-green-100'
            >
              <option value='30'>30s</option>
              <option value='60'>60s</option>
              <option value='120'>120s</option>
              <option value='300'>300s</option>
              <option value='600'>600s</option>
            </select>
          </div>

          <div className='flex flex-col gap-2 sm:col-span-2'>
            <label className='text-xs font-medium text-text-secondary'>
              Academic Term
            </label>
            <select
              value={effectiveTermId ?? ''}
              onChange={(e) =>
                setSelectedTermId(e.target.value ? Number(e.target.value) : null)}
              disabled={!terms || terms.length === 0}
              className='h-10 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary outline-none transition focus:border-apple-green-400 focus:ring-2 focus:ring-apple-green-100'
            >
              <option value=''>Select term…</option>
              {(terms ?? []).map((term: AcademicTerm) => (
                <option key={term.id} value={term.id}>
                  {`${term.school_year.split('-')[0]} – ${term.term_type}`}
                </option>
              ))}
            </select>
          </div>
          <div className='flex flex-col gap-2 justify-end'>
            <button
              type='button'
              onClick={handleGenerate}
              disabled={generateSchedule.isPending}
              className='flex h-10 items-center justify-center gap-2 rounded-lg bg-apple-green-600 text-sm font-medium text-white shadow-sm transition hover:bg-apple-green-700 disabled:opacity-60'
            >
              {generateSchedule.isPending ? 'Generating…' : 'Generate Schedule'}
            </button>
          </div>
        </div>

        {generateError && (
          <div className='mt-3 rounded-lg border border-red-200 bg-red-50 p-3'>
            <p className='text-sm text-red-700'>{generateError}</p>
          </div>
        )}

        {generateResult && (
          <div className='mt-4 rounded-lg border border-border bg-surface p-4'>
            <h3 className='text-sm font-medium text-text-primary mb-3'>
              Generation Results
            </h3>
            <div className='grid grid-cols-2 gap-3 text-sm mb-3'>
              <div className='flex items-center gap-2'>
                <span className='text-text-secondary'>Run ID:</span>
                <span className='font-medium text-text-primary'>
                  {generateResult.run_id}
                </span>
              </div>
              <div className='flex items-center gap-2'>
                <span className='text-text-secondary'>Algorithm:</span>
                <span className='font-medium text-text-primary'>
                  {generateResult.algorithm}
                </span>
              </div>
              <div className='flex items-center gap-2'>
                <span className='text-text-secondary'>Classes:</span>
                <span className='font-medium text-text-primary'>
                  {generateResult.class_count}
                </span>
              </div>
              <div className='flex items-center gap-2'>
                <span className='text-text-secondary'>Violations:</span>
                <span className='text-red-600'>
                  {generateResult.violations.length}
                </span>
              </div>
              <div className='flex items-center gap-2'>
                <span className='text-text-secondary'>Unplaced:</span>
                <span className='text-red-600'>
                  {generateResult.unplaced.length}
                </span>
              </div>
              <div className='flex items-center gap-2'>
                <span className='text-text-secondary'>Runtime:</span>
                <span className='font-medium text-text-primary'>
                  {generateResult.runtime_ms}ms
                </span>
              </div>
            </div>

            <div className='flex items-center gap-3 mb-3'>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${generateResult.feasible ? 'bg-apple-green-50 text-apple-green-700' : 'bg-red-50 text-red-700'}`}
              >
                {generateResult.feasible ? 'Feasible' : 'Infeasible'}
              </span>
              {generateResult.soft_score && (
                <span className='text-text-secondary'>
                  Soft score: {generateResult.soft_score}
                </span>
              )}
            </div>

            {generateResult.violations.length > 0 && (
              <div className='mb-3 rounded-lg border border-red-200 bg-red-50 p-3'>
                <p className='text-xs font-medium text-red-700 mb-2'>
                  Violations:
                </p>
                <ul className='text-xs text-red-600 list-disc pl-4'>
                  {generateResult.violations.slice(0, 10).map((v: string, i: number) => (
                    <li key={i}>{v}</li>
                  ))}
                </ul>
              </div>
            )}
            {generateResult.unplaced.length > 0 && (
              <div className='mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3'>
                <p className='text-xs font-medium text-amber-700 mb-2'>
                  Unplaced meetings:
                </p>
                <ul className='text-xs text-amber-700 list-disc pl-4'>
                  {generateResult.unplaced.slice(0, 10).map((u: string, i: number) => (
                    <li key={i}>{u}</li>
                  ))}
                </ul>
              </div>
            )}
            {generateResult.feasible && (
              <button
                type='button'
                onClick={handlePublish}
                disabled={publishRun.isPending}
                className='flex h-8 items-center justify-center gap-2 rounded-md bg-apple-green-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-apple-green-700 disabled:opacity-60'
              >
                {publishRun.isPending ? 'Publishing…' : 'Publish Schedule'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Algorithm Comparison Section */}
      <div className='rounded-card border border-border bg-surface p-6 mb-8'>
        <h2 className='text-sm font-medium text-text-primary mb-4'>
          Algorithm Comparison
        </h2>
        <p className='text-sm text-text-secondary mb-4'>
          Run all scheduling algorithms and compare their results side-by-side.
        </p>

        <div className='flex flex-col gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          <div className='flex flex-col gap-2'>
            <label className='text-xs font-medium text-text-secondary'>
              Time limit (s)
            </label>
            <select
              value={timeLimitS ?? ''}
              onChange={(e) =>
                setTimeLimitS(e.target.value ? Number(e.target.value) : null)}
              className='h-10 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary outline-none transition focus:border-apple-green-400 focus:ring-2 focus:ring-apple-green-100'
            >
              <option value='30'>30s</option>
              <option value='60'>60s</option>
              <option value='120'>120s</option>
              <option value='300'>300s</option>
              <option value='600'>600s</option>
            </select>
          </div>

          <div className='flex flex-col gap-2 justify-end'>
            <button
              type='button'
              onClick={handleCompareAlgorithms}
              disabled={isComparing}
              className='flex h-10 items-center justify-center gap-2 rounded-lg bg-apple-green-600 text-sm font-medium text-white shadow-sm transition hover:bg-apple-green-700 disabled:opacity-60'
            >
              {isComparing ? 'Comparing…' : 'Compare All Algorithms'}
            </button>
          </div>
        </div>

        {comparisonResults && comparisonResults.length > 0 && (
          <div className='mt-6 rounded-lg border border-border bg-surface p-4'>
            <h3 className='text-sm font-medium text-text-primary mb-3'>
              Comparison Results
            </h3>
            <table className='w-full text-sm border-collapse'>
              <thead>
                <tr className='border-b border-border text-left text-text-secondary'>
                  <th className='px-3 py-2 text-left text-text-secondary'>Algorithm</th>
                  <th className='px-3 py-2 text-left text-text-secondary'>Status</th>
                  <th className='px-3 py-2 text-left text-text-secondary'>Classes</th>
                  <th className='px-3 py-2 text-left text-text-secondary'>Violations</th>
                  <th className='px-3 py-2 text-left text-text-secondary'>Unplaced</th>
                  <th className='px-3 py-2 text-left text-text-secondary'>Runtime</th>
                  <th className='px-3 py-2 text-left text-text-secondary'>Soft Score</th>
                  <th className='px-3 py-2 text-left text-text-secondary text-right'>Action</th>
                </tr>
              </thead>
              <tbody>
                {comparisonResults.map((result) => (
                  <tr key={result.run_id} className='border-b border-border-light'>
                    <td className='px-3 py-2 text-text-primary truncate max-w-xs'>
                      {result.algorithm.charAt(0).toUpperCase() +
                        result.algorithm.slice(1)}
                    </td>
                    <td className='px-3 py-2'>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-medium ${
                          result.feasible
                            ? 'bg-apple-green-50 text-apple-green-700'
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {result.feasible ? 'Feasible' : 'Infeasible'}
                      </span>
                    </td>
                    <td className='px-3 py-2 text-text-primary'>
                      {result.class_count}
                    </td>
                    <td className='px-3 py-2 text-text-primary'>
                      {result.violations.length}
                    </td>
                    <td className='px-3 py-2 text-text-primary'>
                      {result.unplaced.length}
                    </td>
                    <td className='px-3 py-2 text-text-primary'>
                      {result.runtime_ms}ms
                    </td>
                    <td className='px-3 py-2 text-text-primary'>
                      {result.soft_score?.toFixed(2) ?? 'N/A'}
                    </td>
                    <td className='px-3 py-2 text-text-secondary text-right'>
                      <button
                        type='button'
                        onClick={() => {
                          setGenerateResult(result);
                          setGenerateError(null);
                        }}
                        className='rounded-md border border-apple-green-200 px-3 py-1 text-xs font-medium text-apple-green-700 transition hover:bg-apple-green-50 sm:text-sm'
                      >
                        Apply
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      </section>
  );
}
