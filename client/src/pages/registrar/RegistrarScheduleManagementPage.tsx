// pages/registrar/RegistrarScheduleManagementPage.tsx
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';
import {
  AlertTriangle,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Loader2,
  Sparkles,
  UploadCloud,
  X,
} from 'lucide-react';
import {
  useImportCommit,
  useImportPreview,
  useImportTemplate,
  useTerms,
} from '../../hooks/Schedule.hooks';
import {
  useGenerateSchedule,
  usePublishRun,
} from '../../hooks/GenerateManagement.hooks';
import { useQueryClient } from '@tanstack/react-query';
import { useMe } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  IconButton,
  LinkButton,
  PageHeader,
  SegmentedControl,
  SelectField,
} from '../../components/ui';
import { cn } from '../../lib/cn';
import type {
  GenerateSchedulePayload,
  GenerateScheduleResponse,
  ImportPreviewItem,
  ImportPreviewResponse,
} from '../../types/Types';

const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

type PreviewTab =
  | 'all'
  | 'Professors'
  | 'Subjects'
  | 'SectionsRooms'
  | 'Assignments'
  | 'Errors';

type PreviewFilter = 'all' | 'create' | 'update' | 'error';

interface SheetItem {
  sheet: string;
  item: ImportPreviewItem;
}

// Mirrors SHEET_MODELS / REQUIRED_COLUMNS in backend/data_transfer/import_utils.py.
const FORMAT_GUIDE_SHEETS = [
  'Departments',
  'Rooms',
  'Subjects',
  'Sections',
  'Professors',
];

const FORMAT_GUIDE_COLUMNS = [
  'Departments: name',
  'Rooms: name, capacity, department_id',
  'Subjects: code, title, units',
  'Sections: name, headcount, program',
  'Professors: email, first_name, last_name, department_id, max_hours',
];

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

function formatAlgorithm(algorithm: string) {
  const labels: Record<string, string> = {
    greedy: 'Greedy',
    min_conflicts: 'Min Conflicts',
    backtracking: 'Backtracking',
  };
  return labels[algorithm] ?? algorithm;
}

function formatRuntime(runtimeMs: number) {
  if (runtimeMs >= 1000) {
    return `${(runtimeMs / 1000).toFixed(2)} s`;
  }
  return `${Math.round(runtimeMs)} ms`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function getSelectableImportKeys(result: ImportPreviewResponse): string[] {
  return Object.entries(result.preview_items ?? {}).flatMap(([sheet, items]) =>
    items
      .filter((item) => item.action !== 'error')
      .map((item) => `${sheet}:${item.row}`)
  );
}

function collectSheetItems(result: ImportPreviewResponse): SheetItem[] {
  return Object.entries(result.preview_items ?? {}).flatMap(([sheet, items]) =>
    items.map((item) => ({ sheet, item }))
  );
}

function statusBadgeTone(action: ImportPreviewItem['action']) {
  switch (action) {
    case 'create':
      return 'success' as const;
    case 'update':
      return 'warning' as const;
    default:
      return 'danger' as const;
  }
}

function statusLabel(action: ImportPreviewItem['action']) {
  switch (action) {
    case 'create':
      return 'New';
    case 'update':
      return 'Updated';
    default:
      return 'Error';
  }
}

function detailSegments(sheet: string, item: ImportPreviewItem): string[] {
  const d = item.data as Record<string, unknown>;
  const parts: string[] = [];

  switch (sheet) {
    case 'Professors':
      if (d.email !== undefined) parts.push(String(d.email));
      if (d.first_name !== undefined || d.last_name !== undefined)
        parts.push([d.first_name, d.last_name].filter(Boolean).join(' '));
      if (d.department_id !== undefined) parts.push(`Dept #${d.department_id}`);
      if (d.user_id !== undefined) parts.push(`User #${d.user_id}`);
      break;
    case 'Subjects':
      if (d.code !== undefined) parts.push(String(d.code));
      if (d.title !== undefined) parts.push(String(d.title));
      break;
    case 'Sections':
      if (d.name !== undefined) parts.push(String(d.name));
      if (d.headcount !== undefined) parts.push(`${d.headcount} students`);
      if (d.program !== undefined && d.program !== '')
        parts.push(String(d.program));
      break;
    case 'Rooms':
      if (d.name !== undefined) parts.push(String(d.name));
      if (d.capacity !== undefined) parts.push(`Cap ${d.capacity}`);
      break;
    case 'Assignments':
      if (d.professor_id !== undefined) parts.push(`Prof #${d.professor_id}`);
      if (d.subject_id !== undefined) parts.push(`Subj #${d.subject_id}`);
      if (d.section_id !== undefined) parts.push(`Sec #${d.section_id}`);
      break;
    default:
      return Object.entries(d).map(([key, value]) => `${key}: ${value}`);
  }

  return parts;
}

export default function RegistrarScheduleManagementPage() {
  const importPreview = useImportPreview();
  const importCommit = useImportCommit();
  const importTemplate = useImportTemplate();
  const generateSchedule = useGenerateSchedule();
  const publishRun = usePublishRun();
  const { data: terms } = useTerms();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const toast = useToast();

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
  const [selectedImportKeys, setSelectedImportKeys] = useState<Set<string>>(
    new Set()
  );
  const [previewTab, setPreviewTab] = useState<PreviewTab>('all');
  const [previewFilter, setPreviewFilter] = useState<PreviewFilter>('all');
  const [isGuideOpen, setIsGuideOpen] = useState(false);

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
  const [published, setPublished] = useState(false);

  const isRegistrar = !!me?.is_staff;

  useEffect(() => {
    if (!isGenerating) return;

    const interval = setInterval(() => {
      setElapsedSeconds((seconds) => seconds + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isGenerating]);

  const triggerPreview = (targetFile: File) => {
    // The backend ImportPreviewView requires IsRegistrar permission.
    if (!isRegistrar) {
      setPreviewError(
        'Please sign in with a registrar account to preview imports.'
      );
      return;
    }

    setPreviewError(null);
    setImportResult(null);
    importPreview.mutate(targetFile, {
      onSuccess: (data: ImportPreviewResponse) => {
        setPreviewResult(data);
        setSelectedImportKeys(new Set(getSelectableImportKeys(data)));
        setPreviewTab('all');
        setPreviewFilter('all');
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
    setSelectedImportKeys(new Set());
    // Dry-run the import as soon as a file is staged.
    triggerPreview(nextFile);
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
    setSelectedImportKeys(new Set());
    setPreviewTab('all');
    setPreviewFilter('all');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownloadTemplate = (format: 'xlsx' | 'csv') => {
    importTemplate.mutate(format, {
      onSuccess: (blob: Blob) => {
        downloadBlob(
          blob,
          format === 'xlsx'
            ? 'schedule_import_template.xlsx'
            : 'schedule_import_template.zip'
        );
        toast.addToast({
          type: 'success',
          title: `Template downloaded (${
            format === 'xlsx' ? 'Excel' : 'CSV bundle'
          }).`,
          description:
            'Open it in Excel/Sheets or unzip the CSV bundle to fill it in.',
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

  const toggleImportSelection = (key: string) => {
    setSelectedImportKeys((previous) => {
      const next = new Set(previous);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleCommitImport = () => {
    importCommit.mutate(
      {
        previewToken: previewResult?.preview_token ?? '',
        selectedKeys: Array.from(selectedImportKeys),
      },
      {
        onSuccess: (data) => {
          const failed = data.errors?.length ?? 0;
          setImportResult({
            type: failed > 0 ? 'error' : 'success',
            message:
              failed > 0
                ? `Import partially failed: ${failed} row${
                    failed === 1 ? '' : 's'
                  } could not be saved.`
                : `Import committed: ${data.summary.creates} new, ${
                    data.summary.updates
                  } updated.`,
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
          setSelectedImportKeys(new Set());
          setPreviewTab('all');
          setPreviewFilter('all');
          if (fileInputRef.current) fileInputRef.current.value = '';
        },
        onError: (error: Error) => {
          setImportResult({
            type: 'error',
            message: error.message || 'Import commit failed.',
          });
        },
      }
    );
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
      ...(effectiveTermId !== null ? { term_id: effectiveTermId } : {}),
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

  const activeTerms = (terms ?? []).filter((term) => term.is_active);
  const effectiveTermId = selectedTermId ?? activeTerms[0]?.id ?? null;

  const previewErrors = previewResult?.errors ?? [];
  const sheetItems = previewResult ? collectSheetItems(previewResult) : [];
  const errorRowCount = sheetItems.filter(
    ({ item }) => item.action === 'error'
  ).length;

  const tabFilteredItems: SheetItem[] = (() => {
    switch (previewTab) {
      case 'Professors':
        return sheetItems.filter(({ sheet }) => sheet === 'Professors');
      case 'Subjects':
        return sheetItems.filter(({ sheet }) => sheet === 'Subjects');
      case 'SectionsRooms':
        return sheetItems.filter(
          ({ sheet }) => sheet === 'Sections' || sheet === 'Rooms'
        );
      case 'Assignments':
        return sheetItems.filter(({ sheet }) => sheet === 'Assignments');
      case 'Errors':
        return sheetItems.filter(({ item }) => item.action === 'error');
      default:
        return sheetItems;
    }
  })();

  const filteredItems =
    previewFilter === 'all'
      ? tabFilteredItems
      : tabFilteredItems.filter(({ item }) => item.action === previewFilter);

  const selectableImportKeys = previewResult
    ? getSelectableImportKeys(previewResult)
    : [];
  const allSelectableSelected =
    selectableImportKeys.length > 0 &&
    selectableImportKeys.every((key) => selectedImportKeys.has(key));

  const importItemKey = ({ sheet, item }: SheetItem) => `${sheet}:${item.row}`;

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
            <CardDescription className='mt-1'>
              Upload a spreadsheet to create or update courses, sections,
              teachers, and assignments.
            </CardDescription>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Button
              variant='secondary'
              size='sm'
              onClick={() => handleDownloadTemplate('xlsx')}
              loading={importTemplate.isPending}
              icon={<Download size={14} aria-hidden='true' />}
            >
              {importTemplate.isPending
                ? 'Preparing…'
                : 'Download Excel Template'}
            </Button>
            <Button
              variant='secondary'
              size='sm'
              onClick={() => handleDownloadTemplate('csv')}
              loading={importTemplate.isPending}
              icon={<Download size={14} aria-hidden='true' />}
            >
              {importTemplate.isPending ? 'Preparing…' : 'Download Sample CSV'}
            </Button>
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

          <div className='rounded-control border border-border bg-surface-secondary'>
            <button
              type='button'
              onClick={() => setIsGuideOpen((open) => !open)}
              aria-expanded={isGuideOpen}
              className='flex w-full items-center justify-between gap-2 px-4 py-3 text-left'
            >
              <span className='text-body-sm font-medium text-text-primary'>
                View required sheets &amp; column format
              </span>
              <ChevronDown
                size={16}
                aria-hidden='true'
                className={cn(
                  'shrink-0 text-text-tertiary transition-transform',
                  isGuideOpen && 'rotate-180'
                )}
              />
            </button>

            {isGuideOpen && (
              <div className='border-t border-border px-4 py-4'>
                <div className='grid gap-3 text-caption sm:grid-cols-2 lg:grid-cols-3'>
                  <div className='rounded-control border border-border bg-surface p-3'>
                    <p className='font-medium text-text-primary'>
                      Expected sheets
                    </p>
                    <ul className='mt-2 list-disc space-y-1 pl-4 leading-relaxed text-text-secondary'>
                      {FORMAT_GUIDE_SHEETS.map((sheet) => (
                        <li key={sheet}>{sheet}</li>
                      ))}
                    </ul>
                  </div>
                  <div className='rounded-control border border-border bg-surface p-3'>
                    <p className='font-medium text-text-primary'>
                      Required columns (per sheet)
                    </p>
                    <ul className='mt-2 list-disc space-y-1 pl-4 leading-relaxed text-text-secondary'>
                      {FORMAT_GUIDE_COLUMNS.map((entry) => (
                        <li key={entry}>{entry}</li>
                      ))}
                    </ul>
                  </div>
                  <div className='rounded-control border border-border bg-surface p-3'>
                    <p className='font-medium text-text-primary'>
                      Allowed values
                    </p>
                    <ul className='mt-2 list-disc space-y-1 pl-4 leading-relaxed text-text-secondary'>
                      <li>
                        Delivery mode:{' '}
                        <span className='font-mono text-text-primary'>
                          async
                        </span>
                        ,{' '}
                        <span className='font-mono text-text-primary'>
                          sync
                        </span>
                        ,{' '}
                        <span className='font-mono text-text-primary'>lab</span>
                      </li>
                      <li>
                        Day:{' '}
                        <span className='font-mono text-text-primary'>0-5</span>{' '}
                        (Mon–Sat)
                      </li>
                      <li>
                        Time format:{' '}
                        <span className='font-mono text-text-primary'>
                          HH:MM
                        </span>{' '}
                        (24-hour)
                      </li>
                      <li>
                        Capacity, headcount, units, max_hours: positive
                        integers
                      </li>
                      <li>
                        Professor rows are keyed by email (lowercase); a new
                        email auto-creates the user account (no password — they
                        use password reset)
                      </li>
                      <li>
                        <span className='font-mono text-text-primary'>
                          program
                        </span>{' '}
                        is optional on Sections; blank derives it from the
                        section name
                      </li>
                      <li>
                        Legacy workbooks containing Assignments, Meetings,
                        Availability, or BusyBlocks sheets are still accepted
                      </li>
                      <li>
                        Leave{' '}
                        <span className='font-mono text-text-primary'>id</span>{' '}
                        blank to create; set an existing id to update
                      </li>
                    </ul>
                  </div>
                </div>
                <p className='mt-3 text-caption leading-relaxed text-text-tertiary'>
                  Download the Excel template or CSV bundle above for
                  ready-to-fill sample rows matching this exact schema. Invalid
                  rows are reported in the preview before anything is saved.
                </p>
              </div>
            )}
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

          {file && importPreview.isPending && (
            <div
              className='flex items-center gap-2 text-body-sm text-text-secondary'
              role='status'
            >
              <Loader2
                size={16}
                className='animate-spin text-apple-green-600'
                aria-hidden='true'
              />
              Analyzing file…
            </div>
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
                </div>
              </div>

              {previewErrors.length > 0 && (
                <Alert tone='danger' title='Import errors'>
                  <ul className='list-disc space-y-1 pl-4'>
                    {previewErrors.slice(0, 5).map((error, index) => (
                      <li key={index}>
                        {error.sheet} row {error.row}: {error.field} -{' '}
                        {error.message}
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

              <SegmentedControl<PreviewTab>
                label='Preview category'
                value={previewTab}
                onChange={setPreviewTab}
                options={[
                  {
                    value: 'all',
                    label: 'All changes',
                    count: sheetItems.length,
                  },
                  {
                    value: 'Professors',
                    label: 'Professors',
                    count: sheetItems.filter(
                      ({ sheet }) => sheet === 'Professors'
                    ).length,
                  },
                  {
                    value: 'Subjects',
                    label: 'Subjects',
                    count: sheetItems.filter(
                      ({ sheet }) => sheet === 'Subjects'
                    ).length,
                  },
                  {
                    value: 'SectionsRooms',
                    label: 'Sections / Rooms',
                    count: sheetItems.filter(
                      ({ sheet }) => sheet === 'Sections' || sheet === 'Rooms'
                    ).length,
                  },
                  {
                    value: 'Assignments',
                    label: 'Assignments',
                    count: sheetItems.filter(
                      ({ sheet }) => sheet === 'Assignments'
                    ).length,
                  },
                  ...(errorRowCount > 0
                    ? [
                        {
                          value: 'Errors' as const,
                          label: 'Errors',
                          count: errorRowCount,
                        },
                      ]
                    : []),
                ]}
              />

              <SegmentedControl<PreviewFilter>
                label='Filter by status'
                value={previewFilter}
                onChange={setPreviewFilter}
                className='max-w-md'
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'create', label: 'New' },
                  { value: 'update', label: 'Updated' },
                  { value: 'error', label: 'Errors' },
                ]}
              />

              <div className='max-h-72 overflow-y-auto rounded-control border border-border'>
                <table className='w-full border-collapse text-caption'>
                  <thead>
                    <tr className='sticky top-0 z-10 border-b border-border bg-surface'>
                      {previewTab === 'Errors' ? (
                        <>
                          <th className='px-3 py-2 text-left font-medium text-text-secondary'>
                            Sheet
                          </th>
                          <th className='px-3 py-2 text-left font-medium text-text-secondary'>
                            Row
                          </th>
                          <th className='px-3 py-2 text-left font-medium text-text-secondary'>
                            Field
                          </th>
                          <th className='px-3 py-2 text-left font-medium text-text-secondary'>
                            Message
                          </th>
                        </>
                      ) : (
                        <>
                          <th className='w-8 px-3 py-2 text-left'>
                            <input
                              type='checkbox'
                              aria-label='Select all rows'
                              checked={allSelectableSelected}
                              onChange={(event) =>
                                setSelectedImportKeys(
                                  event.target.checked
                                    ? new Set(selectableImportKeys)
                                    : new Set()
                                )
                              }
                              className='rounded border-border text-apple-green-600 focus:ring-apple-green-500'
                            />
                          </th>
                          <th className='px-3 py-2 text-left font-medium text-text-secondary'>
                            Status
                          </th>
                          <th className='px-3 py-2 text-left font-medium text-text-secondary'>
                            Type
                          </th>
                          <th className='px-3 py-2 text-left font-medium text-text-secondary'>
                            Row
                          </th>
                          <th className='px-3 py-2 text-left font-medium text-text-secondary'>
                            Details
                          </th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((entry) => {
                      const { sheet, item } = entry;

                      if (previewTab === 'Errors') {
                        return (
                          <tr
                            key={importItemKey(entry)}
                            className='border-b border-border-light'
                          >
                            <td className='px-3 py-2 text-text-secondary'>
                              {sheet}
                            </td>
                            <td className='px-3 py-2 text-text-secondary'>
                              {item.row}
                            </td>
                            <td className='px-3 py-2 text-text-secondary'>
                              {String(item.data.field ?? '—')}
                            </td>
                            <td className='max-w-xs truncate px-3 py-2 text-danger'>
                              {item.errors.join(', ')}
                            </td>
                          </tr>
                        );
                      }

                      const parts = detailSegments(sheet, item);

                      return (
                        <tr
                          key={importItemKey(entry)}
                          className={cn(
                            'border-b border-border-light hover:bg-surface-secondary',
                            item.action === 'error' && 'bg-danger-soft/40'
                          )}
                        >
                          <td className='px-3 py-2'>
                            <input
                              type='checkbox'
                              aria-label={`Select row ${item.row}`}
                              checked={selectedImportKeys.has(
                                importItemKey(entry)
                              )}
                              disabled={item.action === 'error'}
                              onChange={() =>
                                toggleImportSelection(importItemKey(entry))
                              }
                              className='rounded border-border text-apple-green-600 focus:ring-apple-green-500'
                            />
                          </td>
                          <td className='px-3 py-2'>
                            <Badge tone={statusBadgeTone(item.action)}>
                              {statusLabel(item.action)}
                            </Badge>
                          </td>
                          <td className='px-3 py-2 text-text-secondary'>
                            {sheet}
                          </td>
                          <td className='px-3 py-2 text-text-secondary'>
                            {item.row}
                          </td>
                          <td className='max-w-xs truncate px-3 py-2 text-text-primary'>
                            {parts.length > 0 ? (
                              <>
                                <span>{parts[0]}</span>
                                {parts.length > 1 && (
                                  <span className='text-text-tertiary'>
                                    {' '}
                                    · {parts.slice(1).join(' · ')}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className='text-text-tertiary'>—</span>
                            )}
                            {item.errors.length > 0 && (
                              <span className='mt-1 block text-caption font-medium text-danger'>
                                {item.errors.join(' · ')}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredItems.length === 0 && (
                  <div className='flex flex-col items-center justify-center py-10 text-body-sm text-text-tertiary'>
                    No items to display.
                  </div>
                )}
              </div>

              <div className='flex flex-wrap items-center justify-end gap-3'>
                {selectedImportKeys.size === 0 && (
                  <p className='mr-auto text-caption text-text-tertiary'>
                    Select at least one row to save.
                  </p>
                )}
                <Button
                  onClick={handleCommitImport}
                  disabled={
                    !previewResult.preview_token || selectedImportKeys.size === 0
                  }
                  loading={importCommit.isPending}
                >
                  {importCommit.isPending ? 'Committing…' : 'Save Import'}
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
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
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

            <SelectField
              id='schedule-term'
              label='Academic term'
              value={effectiveTermId ?? ''}
              onChange={(event) =>
                setSelectedTermId(
                  event.target.value ? Number(event.target.value) : null
                )
              }
              disabled={!terms || terms.length === 0}
            >
              <option value=''>Select term…</option>
              {(terms ?? []).map((term) => (
                <option key={term.id} value={term.id}>
                  {`${term.school_year.split('-')[0]} – ${term.term_type}`}
                </option>
              ))}
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
                  <dd className='mt-0.5 text-body font-medium text-text-primary'>
                    {formatAlgorithm(generateResult.algorithm)}
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
                    {formatRuntime(generateResult.runtime_ms)}
                  </dd>
                </div>
              </dl>

              {generateResult.soft_score != null && (
                <p className='text-body-sm text-text-secondary'>
                  Soft score:{' '}
                  <span className='font-medium text-text-primary'>
                    {generateResult.soft_score.toFixed(1)}
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

              {(generateResult.feasible ||
                generateResult.violations.length > 0 ||
                generateResult.unplaced.length > 0) && (
                <div className='flex flex-wrap items-center gap-3'>
                  {(generateResult.violations.length > 0 ||
                    generateResult.unplaced.length > 0) && (
                    <LinkButton
                      to='/registrar/timetable'
                      variant='secondary'
                      icon={<AlertTriangle size={16} aria-hidden='true' />}
                    >
                      Review conflicts
                    </LinkButton>
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
            </div>
          )}
        </CardBody>
      </Card>
    </section>
  );
}
