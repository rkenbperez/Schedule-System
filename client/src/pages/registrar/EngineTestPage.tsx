import { useState } from 'react';
import { AlertCircle, CheckCircle2, FlaskConical, Play } from 'lucide-react';
import {
  runAllTests,
  type EngineTestResult,
} from '../../engine/generate.integration.test';
import type { GenerateSchedulePayload } from '../../types/Types';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  PageHeader,
  Table,
  TableContainer,
  TBody,
  TD,
  TH,
  THead,
  TR,
  TextField,
} from '../../components/ui';

const ALGORITHMS: GenerateSchedulePayload['algorithm'][] = [
  'greedy',
  'min_conflicts',
  'backtracking',
];

type Summary = {
  total: number;
  passed: number;
  failed: number;
  results: EngineTestResult[];
};

export default function EngineTestPage() {
  const [timeLimit, setTimeLimit] = useState(30);
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setError(null);
    setRunning(true);

    try {
      const result = await runAllTests(timeLimit);
      setSummary(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className='space-y-6'>
      <PageHeader
        title={summary ? 'Engine test results' : 'Engine test'}
        description='Run the backend scheduling engine for each algorithm and validate the response shape.'
        backTo='/registrar/dashboard'
        backLabel='Back to dashboard'
        actions={
          summary ? (
            <Button
              icon={<Play size={17} aria-hidden='true' />}
              loading={running}
              onClick={handleRun}
            >
              Re-run tests
            </Button>
          ) : undefined
        }
      />

      {error && (
        <Alert tone='danger' title='Engine test failed'>
          {error}
        </Alert>
      )}

      {!summary ? (
        <>
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Test configuration</CardTitle>
                <p className='mt-0.5 text-body-sm text-text-secondary'>
                  Engine runs on the backend (Python); the frontend only invokes
                  the API.
                </p>
              </div>
            </CardHeader>
            <CardBody>
              <div className='flex flex-col gap-4 sm:flex-row sm:items-end'>
                <TextField
                  id='time-limit'
                  label='Time limit (seconds)'
                  type='number'
                  inputMode='numeric'
                  min={1}
                  max={300}
                  value={timeLimit}
                  onChange={(event) =>
                    setTimeLimit(Number(event.target.value))
                  }
                  containerClassName='w-full sm:w-44'
                />
                <Button
                  icon={<Play size={17} aria-hidden='true' />}
                  loading={running}
                  onClick={handleRun}
                >
                  Run engine tests
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className='flex items-start gap-3'>
              <span className='grid h-10 w-10 shrink-0 place-items-center rounded-control bg-apple-green-50 text-apple-green-700'>
                <FlaskConical size={19} aria-hidden='true' />
              </span>
              <div className='min-w-0'>
                <p className='text-body font-medium text-text-primary'>
                  What this checks
                </p>
                <p className='mt-1 text-body-sm text-text-secondary'>
                  Algorithms tested: {ALGORITHMS.join(', ')}. Each test calls{' '}
                  <code className='rounded bg-surface-secondary px-1.5 py-0.5 text-caption'>
                    POST /api/schedules/generate
                  </code>{' '}
                  and validates the response shape.
                </p>
              </div>
            </CardBody>
          </Card>
        </>
      ) : (
        <>
          <div className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
            <Card className='p-4'>
              <p className='text-body-sm text-text-secondary'>Total tests</p>
              <p className='mt-1 text-numeric tabular-nums text-text-primary'>
                {summary.total}
              </p>
            </Card>
            <Card className='p-4'>
              <p className='text-body-sm text-text-secondary'>Passed</p>
              <p className='mt-1 text-numeric tabular-nums text-success'>
                {summary.passed}
              </p>
            </Card>
            <Card className='p-4'>
              <p className='text-body-sm text-text-secondary'>Failed</p>
              <p className='mt-1 text-numeric tabular-nums text-danger'>
                {summary.failed}
              </p>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className='flex min-w-0 items-center gap-3'>
                <span
                  className={
                    summary.failed === 0 ? 'text-success' : 'text-danger'
                  }
                >
                  {summary.failed === 0 ? (
                    <CheckCircle2 size={20} aria-hidden='true' />
                  ) : (
                    <AlertCircle size={20} aria-hidden='true' />
                  )}
                </span>
                <div>
                  <CardTitle>
                    {summary.failed === 0
                      ? 'All tests passed'
                      : 'Some tests failed'}
                  </CardTitle>
                  <p className='mt-0.5 text-body-sm text-text-secondary'>
                    {summary.passed} of {summary.total} tests passed
                  </p>
                </div>
              </div>
              <Badge tone='neutral'>time_limit_s={timeLimit}</Badge>
            </CardHeader>

            <div className='hidden md:block'>
              <TableContainer className='rounded-none border-0'>
                <Table className='min-w-[960px]'>
                  <caption className='sr-only'>
                    Scheduling engine test results by algorithm
                  </caption>
                  <THead>
                    <TR>
                      <TH>Algorithm</TH>
                      <TH>Result</TH>
                      <TH>Time</TH>
                      <TH>Feasible</TH>
                      <TH>Classes</TH>
                      <TH>Violations</TH>
                      <TH>Unplaced</TH>
                      <TH>Error</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {summary.results.map((result) => (
                      <TR key={result.algorithm}>
                        <TD className='font-medium capitalize'>
                          {result.algorithm.replace('_', ' ')}
                        </TD>
                        <TD>
                          {result.passed ? (
                            <Badge tone='success'>
                              <CheckCircle2 size={13} aria-hidden='true' />
                              Passed
                            </Badge>
                          ) : (
                            <Badge tone='danger'>
                              <AlertCircle size={13} aria-hidden='true' />
                              Failed
                            </Badge>
                          )}
                        </TD>
                        <TD className='tabular-nums text-text-secondary'>
                          {result.durationMs?.toFixed(0)} ms
                        </TD>
                        <TD className='text-text-secondary'>
                          {result.response?.feasible ? 'Yes' : 'No'}
                        </TD>
                        <TD className='tabular-nums text-text-secondary'>
                          {result.response?.class_count ?? '—'}
                        </TD>
                        <TD className='tabular-nums text-text-secondary'>
                          {result.response?.violations.length ?? '—'}
                        </TD>
                        <TD className='tabular-nums text-text-secondary'>
                          {result.response?.unplaced.length ?? '—'}
                        </TD>
                        <TD className='max-w-[240px] text-caption text-danger'>
                          <span className='line-clamp-2' title={result.error}>
                            {result.error ?? '—'}
                          </span>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TableContainer>
            </div>

            <ul className='divide-y divide-border-light md:hidden'>
              {summary.results.map((result) => (
                <li key={result.algorithm} className='space-y-3 px-4 py-4'>
                  <div className='flex items-center justify-between gap-3'>
                    <p className='text-body font-semibold capitalize text-text-primary'>
                      {result.algorithm.replace('_', ' ')}
                    </p>
                    {result.passed ? (
                      <Badge tone='success'>Passed</Badge>
                    ) : (
                      <Badge tone='danger'>Failed</Badge>
                    )}
                  </div>

                  <dl className='grid grid-cols-2 gap-x-4 gap-y-2 text-body-sm'>
                    <div>
                      <dt className='text-caption text-text-tertiary'>Time</dt>
                      <dd className='tabular-nums text-text-primary'>
                        {result.durationMs?.toFixed(0)} ms
                      </dd>
                    </div>
                    <div>
                      <dt className='text-caption text-text-tertiary'>
                        Feasible
                      </dt>
                      <dd className='text-text-primary'>
                        {result.response?.feasible ? 'Yes' : 'No'}
                      </dd>
                    </div>
                    <div>
                      <dt className='text-caption text-text-tertiary'>
                        Classes
                      </dt>
                      <dd className='tabular-nums text-text-primary'>
                        {result.response?.class_count ?? '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className='text-caption text-text-tertiary'>
                        Violations
                      </dt>
                      <dd className='tabular-nums text-text-primary'>
                        {result.response?.violations.length ?? '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className='text-caption text-text-tertiary'>
                        Unplaced
                      </dt>
                      <dd className='tabular-nums text-text-primary'>
                        {result.response?.unplaced.length ?? '—'}
                      </dd>
                    </div>
                  </dl>

                  {result.error && (
                    <p className='rounded-control bg-danger-soft px-3 py-2 text-caption text-danger'>
                      {result.error}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </Card>

          {summary.failed > 0 && (
            <Alert tone='warning' title='Some tests failed'>
              Check the backend logs and make sure the API is running at{' '}
              {import.meta.env.VITE_API_URL ?? 'http://localhost:8000'}.
            </Alert>
          )}
        </>
      )}
    </div>
  );
}
