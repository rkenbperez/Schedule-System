// pages/registrar/RegistrarScheduleManagementPage.tsx
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';
import {
  FileSpreadsheet,
  Loader2,
  Sparkles,
  UploadCloud,
  X,
} from 'lucide-react';
import {
  useImportPreview,
  useImportCommit,
  useGenerateSchedule,
  usePublishRun,
} from '../../hooks/GenerateManagement.hooks';
import { useQueryClient } from '@tanstack/react-query';
import { useMe } from '../../hooks/useAuth';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  IconButton,
  PageHeader,
  SelectField,
} from '../../components/ui';
import { cn } from '../../lib/cn';
import type {
  GenerateSchedulePayload,
  GenerateScheduleResponse,
  ImportPreviewResponse,
} from '../../types/Types';

const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

function validateFile(file: File) {
  const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return 'Please upload a valid Excel or CSV file (.xlsx, .xls, .csv).';
  }
  return null;
}

function formatElapsed(totalSeconds: number) {
  return `${Math.floor(totalSeconds / 60)}:${String(
    totalSeconds % 60
  ).padStart(2, '0')}`;
}

export default function RegistrarScheduleManagementPage() {
  const importPreview = useImportPreview();
  const importCommit = useImportCommit();
  const generateSchedule = useGenerateSchedule();
  const publishRun = usePublishRun();
  const queryClient = useQueryClient();
  const { data: me } = useMe();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
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
  const [published, setPublished] = useState(false);

  const isRegistrar = !!me?.is_staff;

  useEffect(() => {
    if (!isGenerating) return;

    const interval = setInterval(() => {
      setElapsedSeconds((seconds) => seconds + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isGenerating]);

  const selectFile = (nextFile: File) => {
    const error = validateFile(nextFile);
    if (error) {
      setPreviewError(error);
      return;
    }

    setFile(nextFile);
    setPreviewError(null);
    setPreviewResult(null);
    setImportResult(null);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) selectFile(selectedFile);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const droppedFile = event.dataTransfer.files?.[0];
    if (droppedFile) selectFile(droppedFile);
  };

  const handleRemoveFile = () => {
    setFile(null);
    setPreviewResult(null);
    setPreviewError(null);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePreview = () => {
    if (!file) return;

    if (!isRegistrar) {
      setPreviewError(
        'Please sign in with a registrar account to preview imports.'
      );
      return;
    }

    setPreviewError(null);
    setImportResult(null);
    importPreview.mutate(file, {
      onSuccess: (data: ImportPreviewResponse) => {
        setPreviewResult(data);
      },
      onError: (error: Error) => {
        setPreviewError(
          error.message.includes('403') || error.message.includes('Forbidden')
            ? 'Access denied: please sign in with a registrar account to preview imports.'
            : error.message
        );
      },
    });
  };

  const handleCommitImport = () => {
    importCommit.mutate(previewResult?.preview_token ?? '', {
      onSuccess: () => {
        setImportResult({
          type: 'success',
          message: 'Import committed successfully.',
        });
        queryClient.invalidateQueries({ queryKey: ['all-assignments'] });
        queryClient.invalidateQueries({
          queryKey: ['registrar-all-assignments'],
        });
        queryClient.invalidateQueries({
          queryKey: ['registrar-all-schedules'],
        });
        setPreviewResult(null);
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      },
      onError: (error: Error) => {
        setImportResult({
          type: 'error',
          message: error.message || 'Import commit failed.',
        });
      },
    });
  };

  const handleGenerate = () => {
    setGenerateError(null);
    setGenerateResult(null);
    setPublished(false);
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
      },
      onError: (error: Error) => {
        setGenerateError(error.message);
        setIsGenerating(false);
      },
    });
  };

  const handlePublish = () => {
    if (!generateResult?.run_id) return;
    publishRun.mutate(generateResult.run_id, {
      onSuccess: () => setPublished(true),
      onError: () => setGenerateError('Unable to publish schedule.'),
    });
  };

  if (isGenerating) {
    return (
      <section className='w-full space-y-6'>
        <PageHeader
          backTo='/registrar/dashboard'
          backLabel='Back to dashboard'
          eyebrow='Registrar'
          title='Schedule management'
          description='Import academic data and generate schedules for the active term.'
        />

        <Card>
          <CardBody className='space-y-5'>
            <div className='flex items-center gap-3' role='status'>
              <Loader2
                size={20}
                className='animate-spin text-apple-green-600'
                aria-hidden='true'
              />
              <div>
                <h2 className='text-h3 text-text-primary'>
                  Generating academic schedule
                </h2>
                <p className='text-body-sm text-text-secondary'>
                  Processing all assignments for the active academic term.
                </p>
              </div>
            </div>

            <dl className='grid gap-3 sm:grid-cols-3'>
              <div className='rounded-control border border-border bg-surface-secondary p-3'>
                <dt className='text-caption text-text-secondary'>Algorithm</dt>
                <dd className='mt-0.5 text-body font-medium text-apple-green-700'>
                  {algorithm}
                </dd>
              </div>
              <div className='rounded-control border border-border bg-surface-secondary p-3'>
                <dt className='text-caption text-text-secondary'>Time limit</dt>
                <dd className='mt-0.5 text-body font-medium text-apple-green-700'>
                  {timeLimitS} seconds
                </dd>
              </div>
              <div className='rounded-control border border-border bg-surface-secondary p-3'>
                <dt className='text-caption text-text-secondary'>
                  Elapsed time
                </dt>
                <dd
                  className='mt-0.5 text-body font-medium tabular-nums text-apple-green-700'
                  aria-live='polite'
                >
                  {formatElapsed(elapsedSeconds)}
                </dd>
              </div>
            </dl>

            <p className='text-body-sm text-text-secondary'>
              Please wait while the scheduling engine calculates the timetable.
            </p>
          </CardBody>
        </Card>
      </section>
    );
  }

  const previewErrors = previewResult?.errors ?? [];
  const previewWarnings: never[] = [];

  return (
    <section className='w-full space-y-6'>
      <PageHeader
        backTo='/registrar/dashboard'
        backLabel='Back to dashboard'
        eyebrow='Registrar'
        title='Schedule management'
        description='Import academic data and generate schedules for the active term.'
      />

      {importResult && (
        <Alert
          tone={importResult.type === 'success' ? 'success' : 'danger'}
          title={
            importResult.type === 'success'
              ? 'Import complete'
              : 'Import failed'
          }
          action={
            <IconButton
              label='Dismiss import message'
              size='sm'
              onClick={() => setImportResult(null)}
            >
              <X size={16} aria-hidden='true' />
            </IconButton>
          }
        >
          {importResult.message}
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Import academic data</CardTitle>
            <p className='mt-1 text-body-sm text-text-secondary'>
              Upload a spreadsheet to create or update courses, sections,
              teachers, and assignments.
            </p>
          </div>
        </CardHeader>
        <CardBody className='space-y-4'>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              'rounded-card border border-dashed p-5 text-center transition-colors sm:p-6',
              isDragging
                ? 'border-apple-green-500 bg-apple-green-50'
                : 'border-border-control bg-surface-secondary'
            )}
          >
            <button
              type='button'
              onClick={() => fileInputRef.current?.click()}
              aria-describedby='import-file-hint'
              className='flex w-full flex-col items-center gap-2 rounded-control py-2 text-center'
            >
              <span className='grid h-12 w-12 place-items-center rounded-full bg-apple-green-50 text-apple-green-700'>
                <UploadCloud size={24} aria-hidden='true' />
              </span>
              <span className='text-body font-medium text-text-primary'>
                Choose a file or drag and drop
              </span>
              <span
                id='import-file-hint'
                className='text-body-sm text-text-secondary'
              >
                Excel or CSV (.xlsx, .xls, .csv)
              </span>
            </button>
            <input
              ref={fileInputRef}
              type='file'
              accept='.xlsx,.xls,.csv'
              onChange={handleFileChange}
              className='sr-only'
              tabIndex={-1}
            />
          </div>

          {file && (
            <div className='flex items-center gap-3 rounded-control border border-border bg-surface p-3'>
              <FileSpreadsheet
                size={20}
                className='shrink-0 text-apple-green-700'
                aria-hidden='true'
              />
              <div className='min-w-0 flex-1'>
                <p className='truncate text-body font-medium text-text-primary'>
                  {file.name}
                </p>
                <p className='text-caption text-text-secondary'>
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <IconButton
                label='Remove selected file'
                size='sm'
                onClick={handleRemoveFile}
              >
                <X size={16} aria-hidden='true' />
              </IconButton>
            </div>
          )}

          {file && (
            <Button
              onClick={handlePreview}
              loading={importPreview.isPending}
              icon={<FileSpreadsheet size={16} aria-hidden='true' />}
              className='w-full sm:w-auto'
            >
              {importPreview.isPending ? 'Previewing…' : 'Preview import'}
            </Button>
          )}

          {previewError && <Alert tone='danger'>{previewError}</Alert>}

          {previewResult && (
            <div className='space-y-4 rounded-card border border-border bg-surface p-4 sm:p-5'>
              <div className='flex flex-wrap items-center justify-between gap-3'>
                <h3 className='text-h3 text-text-primary'>Preview results</h3>
                <div className='flex flex-wrap gap-2'>
                  <Badge tone='success'>
                    {previewResult.summary.creates} new
                  </Badge>
                  <Badge tone='warning'>
                    {previewResult.summary.updates} updated
                  </Badge>
                  <Badge tone={previewErrors.length > 0 ? 'danger' : 'neutral'}>
                    {previewErrors.length} errors
                  </Badge>
                  <Badge
                    tone={previewWarnings.length > 0 ? 'warning' : 'neutral'}
                  >
                    {previewWarnings.length} warnings
                  </Badge>
                </div>
              </div>

              {previewErrors.length > 0 && (
                <Alert tone='danger' title='Import errors'>
                  <ul className='list-disc space-y-1 pl-4'>
                    {previewErrors.slice(0, 5).map((error, index) => (
                      <li key={index}>
                        {error.sheet} row {error.row}: {error.field} - {error.message}
                      </li>
                    ))}
                  </ul>
                  {previewErrors.length > 5 && (
                    <p className='mt-1'>
                      and {previewErrors.length - 5} more error
                      {previewErrors.length - 5 === 1 ? '' : 's'}.
                    </p>
                  )}
                </Alert>
              )}

              {previewWarnings.length > 0 && (
                <Alert tone='warning' title='Warnings'>
                  <ul className='list-disc space-y-1 pl-4'>
                    {previewWarnings.slice(0, 5).map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                  {previewWarnings.length > 5 && (
                    <p className='mt-1'>
                      and {previewWarnings.length - 5} more warning
                      {previewWarnings.length - 5 === 1 ? '' : 's'}.
                    </p>
                  )}
                </Alert>
              )}

              <div className='flex flex-wrap gap-2'>
                <Button
                  onClick={handleCommitImport}
                  disabled={!previewResult.preview_token}
                  loading={importCommit.isPending}
                >
                  {importCommit.isPending ? 'Committing…' : 'Save import'}
                </Button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Generate schedule</CardTitle>
            <p className='mt-1 text-body-sm text-text-secondary'>
              Run the scheduling engine for all assignments in the active term.
            </p>
          </div>
        </CardHeader>
        <CardBody className='space-y-4'>
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
            <SelectField
              id='schedule-algorithm'
              label='Algorithm'
              value={algorithm}
              onChange={(event) =>
                setAlgorithm(event.target.value as typeof algorithm)
              }
            >
              <option value='greedy'>Greedy</option>
              <option value='min_conflicts'>Min conflicts</option>
              <option value='backtracking'>Backtracking</option>
            </SelectField>

            <SelectField
              id='schedule-time-limit'
              label='Time limit'
              value={timeLimitS ?? ''}
              onChange={(event) =>
                setTimeLimitS(event.target.value ? Number(event.target.value) : null)
              }
            >
              <option value='30'>30 seconds</option>
              <option value='60'>60 seconds</option>
              <option value='120'>120 seconds</option>
              <option value='300'>300 seconds</option>
              <option value='600'>600 seconds</option>
            </SelectField>

            <div className='flex items-end'>
              <Button
                onClick={handleGenerate}
                loading={generateSchedule.isPending}
                icon={<Sparkles size={16} aria-hidden='true' />}
                className='w-full'
              >
                {generateSchedule.isPending
                  ? 'Generating…'
                  : 'Generate schedule'}
              </Button>
            </div>
          </div>

          {generateError && <Alert tone='danger'>{generateError}</Alert>}

          {generateResult && (
            <div className='space-y-4 rounded-card border border-border bg-surface p-4 sm:p-5'>
              <div className='flex flex-wrap items-center gap-2'>
                <h3 className='mr-auto text-h3 text-text-primary'>
                  Generation results
                </h3>
                <Badge
                  tone={generateResult.feasible ? 'success' : 'danger'}
                  size='md'
                >
                  {generateResult.feasible ? 'Feasible' : 'Infeasible'}
                </Badge>
              </div>

              <dl className='grid grid-cols-2 gap-3 sm:grid-cols-3'>
                <div className='rounded-control border border-border bg-surface-secondary p-3'>
                  <dt className='text-caption text-text-secondary'>Run ID</dt>
                  <dd className='mt-0.5 text-body font-medium text-text-primary'>
                    {generateResult.run_id}
                  </dd>
                </div>
                <div className='rounded-control border border-border bg-surface-secondary p-3'>
                  <dt className='text-caption text-text-secondary'>
                    Algorithm
                  </dt>
                  <dd className='mt-0.5 text-body font-medium capitalize text-text-primary'>
                    {generateResult.algorithm}
                  </dd>
                </div>
                <div className='rounded-control border border-border bg-surface-secondary p-3'>
                  <dt className='text-caption text-text-secondary'>Classes</dt>
                  <dd className='mt-0.5 text-body font-medium text-text-primary'>
                    {generateResult.class_count}
                  </dd>
                </div>
                <div className='rounded-control border border-border bg-surface-secondary p-3'>
                  <dt className='text-caption text-text-secondary'>
                    Violations
                  </dt>
                  <dd
                    className={cn(
                      'mt-0.5 text-body font-medium',
                      generateResult.violations.length > 0
                        ? 'text-danger'
                        : 'text-text-primary'
                    )}
                  >
                    {generateResult.violations.length}
                  </dd>
                </div>
                <div className='rounded-control border border-border bg-surface-secondary p-3'>
                  <dt className='text-caption text-text-secondary'>Unplaced</dt>
                  <dd
                    className={cn(
                      'mt-0.5 text-body font-medium',
                      generateResult.unplaced.length > 0
                        ? 'text-danger'
                        : 'text-text-primary'
                    )}
                  >
                    {generateResult.unplaced.length}
                  </dd>
                </div>
                <div className='rounded-control border border-border bg-surface-secondary p-3'>
                  <dt className='text-caption text-text-secondary'>Runtime</dt>
                  <dd className='mt-0.5 text-body font-medium tabular-nums text-text-primary'>
                    {generateResult.runtime_ms} ms
                  </dd>
                </div>
              </dl>

              {generateResult.soft_score !== undefined && (
                <p className='text-body-sm text-text-secondary'>
                  Soft score:{' '}
                  <span className='font-medium text-text-primary'>
                    {generateResult.soft_score}
                  </span>
                </p>
              )}

              {generateResult.violations.length > 0 && (
                <Alert tone='danger' title='Violations'>
                  <ul className='list-disc space-y-1 pl-4'>
                    {generateResult.violations.slice(0, 10).map((violation, index) => (
                      <li key={index}>{violation}</li>
                    ))}
                  </ul>
                  {generateResult.violations.length > 10 && (
                    <p className='mt-1'>
                      and {generateResult.violations.length - 10} more.
                    </p>
                  )}
                </Alert>
              )}

              {generateResult.unplaced.length > 0 && (
                <Alert tone='warning' title='Unplaced meetings'>
                  <ul className='list-disc space-y-1 pl-4'>
                    {generateResult.unplaced.slice(0, 10).map((meeting, index) => (
                      <li key={index}>{meeting}</li>
                    ))}
                  </ul>
                  {generateResult.unplaced.length > 10 && (
                    <p className='mt-1'>
                      and {generateResult.unplaced.length - 10} more.
                    </p>
                  )}
                </Alert>
              )}

              {generateResult.feasible && (
                <Button
                  onClick={handlePublish}
                  loading={publishRun.isPending}
                  disabled={published}
                  className='w-full sm:w-auto'
                >
                  {published
                    ? 'Published'
                    : publishRun.isPending
                      ? 'Publishing…'
                      : 'Publish schedule'}
                </Button>
              )}
            </div>
          )}
        </CardBody>
      </Card>
    </section>
  );
}
