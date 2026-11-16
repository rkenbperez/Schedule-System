// pages/registrar/RegistrarScheduleManagementPage.tsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, RefreshCw } from 'lucide-react';
import {
  useImportPreview,
  useImportCommit,
  useGenerateSchedule,
  useRunClasses,
  usePublishRun,
} from '../../hooks/GenerateManagement.hooks';
import { useQueryClient } from '@tanstack/react-query';
import type {
  GenerateSchedulePayload,
  GenerateScheduleResponse,
  ImportPreviewResponse,
  ImportRecord,
  ScheduledClass,
} from '../../types/Types';
import { DAY_LABELS } from '../../pages/registrar/registrarData';

export default function RegistrarScheduleManagementPage() {
  const importPreview = useImportPreview();
  const importCommit = useImportCommit();
  const generateSchedule = useGenerateSchedule();
  const runClassesMutation = useRunClasses();
  const publishRun = usePublishRun();
  const queryClient = useQueryClient();

  const [file, setFile] = useState<File | null>(null);
  const [previewResult, setPreviewResult] =
    useState<ImportPreviewResponse | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const [algorithm, setAlgorithm] = useState<
    'greedy' | 'min_conflicts' | 'backtracking'
  >('greedy');
  const [timeLimitS, setTimeLimitS] = useState<number | null>(30);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generateResult, setGenerateResult] =
    useState<GenerateScheduleResponse | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [runClasses, setRunClasses] = useState<ScheduledClass[]>([]);
  const [showTimetable, setShowTimetable] = useState(false);

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
    setPreviewError(null);
    importPreview.mutate(file, {
      onSuccess: (data: ImportPreviewResponse) => {
        setPreviewResult(data);
      },
      onError: (err: Error) => {
        setPreviewError(err.message);
      },
    });
  };

  const handleRemoveFile = () => {
    setFile(null);
    setPreviewResult(null);
    setPreviewError(null);
  };

  const handleGenerate = () => {
    setGenerateError(null);
    setGenerateResult(null);
    setShowTimetable(false);
    setRunClasses([]);
    setElapsedSeconds(0);
    setIsGenerating(true);

    const payload: GenerateSchedulePayload = {
      algorithm,
      ...(timeLimitS !== null && timeLimitS > 0
        ? { time_limit_s: timeLimitS }
        : {}),
    };

    generateSchedule.mutate(payload, {
      onSuccess: (data) => {
        setGenerateResult(data);
        setIsGenerating(false);
        if (data.feasible && data.run_id) {
          runClassesMutation.mutate(data.run_id, {
            onSuccess: (classesData) => {
              setRunClasses(classesData);
              setShowTimetable(true);
            },
            onError: () => {
              setGenerateError('Unable to fetch generated classes');
            },
          });
        }
      },
      onError: (err: Error) => {
        setGenerateError(err.message);
        setIsGenerating(false);
      },
    });
  };

  const handlePublish = () => {
    if (!generateResult?.run_id) return;
    publishRun.mutate(generateResult.run_id, {
      onSuccess: () => {
        setGenerateResult((prev) =>
          prev ? { ...prev, published: true } : prev
        );
      },
      onError: () => {
        setGenerateError('Unable to publish schedule');
      },
    });
  };

  const handleGenerateSchedule = () => {
    importCommit.mutate(previewResult?.preview_token ?? '', {
      onSuccess: () => {
        setImportResult({
          type: 'success',
          message: 'Import committed successfully.',
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
        setImportResult({
          type: 'error',
          message: err.message || 'Import commit failed.',
        });
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
        <h2 className='text-sm font-medium text-text-primary mb-4'>
          Import Academic Data
        </h2>
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
            <h3 className='text-sm font-medium text-text-primary mb-3'>
              Preview Results
            </h3>
            <div className='flex gap-4 text-xs mb-3'>
              <span className='text-apple-green-600'>
                {previewResult.created_count} new
              </span>
              <span className='text-amber-600'>
                {previewResult.updated_count} updated
              </span>
              <span className='text-red-600'>
                {previewResult.errors.length} errors
              </span>
              <span className='text-amber-500'>
                {previewResult.warnings.length} warnings
              </span>
            </div>
            {previewResult.errors.length > 0 && (
              <div className='mb-3 rounded-lg border border-red-200 bg-red-50 p-3'>
                <p className='text-xs font-medium text-red-700 mb-2'>
                  Errors:
                </p>
                <ul className='text-xs text-red-600 list-disc pl-4'>
                  {previewResult.errors.slice(0, 5).map((e: string, i: number) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
            {previewResult.records.length > 0 && (
              <div className='overflow-x-auto mb-3'>
                <table className='w-full text-xs'>
                  <thead>
                    <tr className='border-b border-border text-left text-[10px] text-text-secondary'>
                      <th className='px-3 py-1'>Course</th>
                      <th className='px-3 py-1'>Section</th>
                      <th className='px-3 py-1'>Teacher</th>
                      <th className='px-3 py-1'>Term</th>
                      <th className='px-3 py-1'>Type</th>
                      <th className='px-3 py-1'>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewResult.records.map((r: ImportRecord) => (
                      <tr key={r.id} className='border-b border-border-light'>
                        <td className='px-3 py-1 text-[10px] text-text-primary'>
                          {r.course_code}
                        </td>
                        <td className='px-3 py-1 text-[10px] text-text-secondary'>
                          {r.section_code}
                        </td>
                        <td className='px-3 py-1 text-[10px] text-text-secondary'>
                          {r.teacher_employee_no}
                        </td>
                        <td className='px-3 py-1 text-[10px] text-text-secondary'>
                          {r.term_name}
                        </td>
                        <td className='px-3 py-1 text-[10px] text-text-secondary'>
                          {r.component_type}
                        </td>
                        <td className='px-3 py-1 text-[10px]'>
                          <span
                            className={`rounded-full px-1.5 py-0 ${r.is_valid ? 'bg-apple-green-50 text-apple-green-700' : 'bg-red-50 text-red-700'}`}
                          >
                            {r.is_valid ? 'Valid' : 'Error'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className='flex gap-2'>
              <button
                type='button'
                onClick={() =>
                  importCommit.mutate(previewResult?.preview_token ?? '', {
                    onSuccess: () => {
                      setImportResult({
                        type: 'success',
                        message: 'Import committed successfully.',
                      });
                      setPreviewResult(null);
                    },
                    onError: (err: Error) => {
                      setImportResult({
                        type: 'error',
                        message: err.message || 'Import commit failed.',
                      });
                    },
                  )}
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
          </div>
        )}
      </div>

      {/* Timetable View */}
      {showTimetable && runClasses.length > 0 && (
        <div className='rounded-card border border-border bg-surface p-6 mt-8'>
          <h2 className='text-sm font-medium text-text-primary mb-4'>
            Generated Timetable
          </h2>
          <div className='overflow-x-auto'>
            <table className='w-full text-xs'>
              <thead>
                <tr className='border-b border-border text-left text-[10px] text-text-secondary'>
                  <th className='px-3 py-1'>Course</th>
                  <th className='px-3 py-1'>Section</th>
                  <th className='px-3 py-1'>Teacher</th>
                  <th className='px-3 py-1'>Room</th>
                  <th className='px-3 py-1'>Day</th>
                  <th className='px-3 py-1'>Time</th>
                </tr>
              </thead>
              <tbody>
                {runClasses.map((c: ScheduledClass) => (
                  <tr key={c.id} className='border-b border-border-light'>
                    <td className='px-3 py-1 text-[10px] text-text-primary'>
                      {c.course_code}
                    </td>
                    <td className='px-3 py-1 text-[10px] text-text-secondary'>
                      {c.section_code}
                    </td>
                    <td className='px-3 py-1 text-[10px] text-text-secondary'>
                      {c.teacher_name}
                    </td>
                    <td className='px-3 py-1 text-[10px] text-text-secondary'>
                      {c.room_code}
                    </td>
                    <td className='px-3 py-1 text-[10px] text-text-secondary'>
                      {DAY_LABELS[c.day_of_week]}
                    </td>
                    <td className='px-3 py-1 text-[10px] text-text-secondary'>
                      {c.start_time}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
