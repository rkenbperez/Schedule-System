// pages/registrar/EngineTestPage.tsx
// Manual test page for the scheduling engine (backend-powered).
// Navigate to /registrar/engine-test to run engine integration tests.

import { useState } from 'react';
import { Play, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { runAllTests, type EngineTestResult } from '../../engine/generate.integration.test';
import type { GenerateSchedulePayload } from '../../types/Types';

const ALGORITHMS: GenerateSchedulePayload['algorithm'][] = [
  'greedy',
  'min_conflicts',
  'backtracking',
];

export default function EngineTestPage() {
  const [timeLimit, setTimeLimit] = useState(30);
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<{
    total: number;
    passed: number;
    failed: number;
    results: EngineTestResult[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
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
  };

  if (!summary) {
    return (
      <section className='w-full max-w-3xl mx-auto p-6'>
        <div className='flex items-center justify-between mb-6'>
          <div>
            <h1 className='text-lg font-medium text-text-primary'>
              Engine Test — Schedule Generation
            </h1>
            <p className='text-sm text-text-secondary'>
              Runs the backend scheduling engine for each algorithm and
              validates the response shape. Engine runs on the backend
              (Python); frontend only invokes the API.
            </p>
          </div>
          <Link
            to='/registrar/dashboard'
            className='inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary'
          >
            <span>← Back to dashboard</span>
          </Link>
        </div>

        <div className='rounded-card border border-border bg-surface p-6 mb-6'>
          <div className='flex flex-col gap-4 sm:flex-row sm:items-end'>
            <div className='flex items-center gap-3'>
              <label className='text-sm font-medium text-text-primary'>
                Time limit (seconds)
              </label>
              <input
                type='number'
                value={timeLimit}
                onChange={(e) => setTimeLimit(Number(e.target.value))}
                min='1'
                max='300'
                className='h-10 w-24 rounded-lg border border-border bg-surface-tertiary px-3 text-sm text-text-primary outline-none transition focus:border-apple-green-400'
              />
            </div>
            <button
              type='button'
              onClick={handleRun}
              disabled={running}
              className='flex h-10 items-center justify-center gap-2 rounded-lg bg-apple-green-600 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-apple-green-700 disabled:opacity-60 disabled:cursor-not-allowed'
            >
              {running ? (
                <RefreshCw size={16} className='animate-spin' />
              ) : (
                <Play size={16} />
              )}
              {running ? 'Running tests…' : 'Run engine tests'}
            </button>
          </div>
          {error && (
            <p className='rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mt-3'>
              {error}
            </p>
          )}
        </div>

        <div className='text-xs text-text-tertiary mt-4'>
          <p>
            Algorithms tested: {ALGORITHMS.join(', ')}. Each test calls{' '}
            <code>POST /api/schedules/generate</code> on the backend and
            validates the response shape.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className='w-full max-w-3xl mx-auto p-6'>
      <div className='flex items-center justify-between mb-6'>
        <div>
          <h1 className='text-lg font-medium text-text-primary'>
            Engine Test Results
          </h1>
          <p className='text-sm text-text-secondary'>
            {summary.passed}/{summary.total} passed •{' '}
            {summary.failed > 0 ? summary.failed : '0'} failed
          </p>
        </div>
        <div className='flex gap-2'>
          <button
            type='button'
            onClick={handleRun}
            disabled={running}
            className='flex h-10 items-center justify-center gap-2 rounded-lg bg-apple-green-600 px-4 text-sm font-medium text-white transition hover:bg-apple-green-700 disabled:opacity-60'
          >
            {running ? <RefreshCw size={16} className='animate-spin' /> : <Play size={16} />}
            Re-run
          </button>
          <Link
            to='/registrar/dashboard'
            className='inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary'
          >
            Back to dashboard
          </Link>
        </div>
      </div>

      <div className='rounded-card border border-border bg-surface p-6'>
        <div className='flex items-center gap-3 mb-4'>
          <span className={`text-${summary.failed === 0 ? 'apple-green' : 'red'}-600 font-medium`}>
            {summary.failed === 0 ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          </span>
          <span className='text-sm font-medium text-text-primary'>
            {summary.passed}/{summary.total} tests passed
          </span>
          <span className='ml-auto text-xs text-text-tertiary'>
            time_limit_s={timeLimit}
          </span>
        </div>

        <table className='w-full text-xs'>
          <thead>
            <tr className='border-b border-border text-left text-text-secondary'>
              <th className='px-4 py-3'>Algorithm</th>
              <th className='px-4 py-3'>Result</th>
              <th className='px-4 py-3'>Time</th>
              <th className='px-4 py-3'>Feasible</th>
              <th className='px-4 py-3'>Classes</th>
              <th className='px-4 py-3'>Violations</th>
              <th className='px-4 py-3'>Unplaced</th>
              <th className='px-4 py-3'>Error</th>
            </tr>
          </thead>
          <tbody>
            {summary.results.map((r) => (
              <tr
                key={r.algorithm}
                className='border-b border-border-light'
              >
                <td className='px-4 py-3 text-text-primary'>
                  {r.algorithm}
                </td>
                <td className='px-4 py-3'>
                  {r.passed ? (
                    <span className='flex items-center gap-1.5 text-apple-green-600'>
                      <CheckCircle2 size={12} /> Passed
                    </span>
                  ) : (
                    <span className='text-red-600'>Failed</span>
                  )}
                </td>
                <td className='px-4 py-3 text-text-secondary'>
                  {r.durationMs?.toFixed(0)}ms
                </td>
                <td className='px-4 py-3 text-text-secondary'>
                  {r.response?.feasible ? 'Yes' : 'No'}
                </td>
                <td className='px-4 py-3 text-text-secondary'>
                  {r.response?.class_count ?? '—'}
                </td>
                <td className='px-4 py-3 text-text-secondary'>
                  {r.response?.violations.length ?? '—'}
                </td>
                <td className='px-4 py-3 text-text-secondary'>
                  {r.response?.unplaced.length ?? '—'}
                </td>
                <td className='px-4 py-3 text-red-600 text-[10px] truncate max-w-xs'>
                  {r.error ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {summary.failed > 0 && (
          <p className='mt-4 text-sm text-red-600'>
            Some tests failed. Check the backend logs and ensure the API is
            running on {import.meta.env.VITE_API_URL ?? 'http://localhost:8000'}.
          </p>
        )}
      </div>
    </section>
  );
}
