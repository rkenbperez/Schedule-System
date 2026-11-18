// client/src/engine/generate.integration.test.ts
//
// Integration test for the scheduling engine (backend-powered).
// Calls POST /api/schedules/generate for each algorithm and validates
// the response shape. Import and run the exported `runAllTests()` from
// a page or the browser console to manually verify the engine works.
//
// Usage (in browser console after app loads):
//   import { runAllTests } from '/src/engine/generate.integration.test.ts'
//   runAllTests().then(console.log)
//
// Or add the EngineTestPage to your router and navigate to /registrar/engine-test.

import type { GenerateSchedulePayload, GenerateScheduleResponse } from '../types/Types';
import { scheduleService } from '../services/Schedule.service';

const ALGORITHMS: GenerateSchedulePayload['algorithm'][] = [
  'greedy',
  'min_conflicts',
  'backtracking',
];

export type EngineTestResult = {
  algorithm: string;
  passed: boolean;
  response?: GenerateScheduleResponse;
  error?: string;
  durationMs?: number;
};

export type EngineTestSummary = {
  total: number;
  passed: number;
  failed: number;
  results: EngineTestResult[];
};

/**
 * Validate that the generate response has the expected shape and types.
 */
function validateResponse(
  algorithm: string,
  res: GenerateScheduleResponse,
): { ok: boolean; reason?: string } {
  const checks: Array<{ name: string; ok: boolean }> = [
    { name: 'run_id is a number', ok: typeof res.run_id === 'number' && res.run_id > 0 },
    { name: 'algorithm matches', ok: res.algorithm === algorithm },
    { name: 'status is feasible|infeasible', ok: res.status === 'feasible' || res.status === 'infeasible' },
    { name: 'feasible is boolean', ok: typeof res.feasible === 'boolean' },
    { name: 'feasible matches status', ok: res.feasible === (res.status === 'feasible') },
    { name: 'runtime_ms is a number >= 0', ok: typeof res.runtime_ms === 'number' && res.runtime_ms >= 0 },
    { name: 'class_count is a number >= 0', ok: typeof res.class_count === 'number' && res.class_count >= 0 },
    { name: 'violations is an array', ok: Array.isArray(res.violations) },
    { name: 'unplaced is an array', ok: Array.isArray(res.unplaced) },
    { name: 'soft_score is number or null', ok: res.soft_score === null || typeof res.soft_score === 'number' },
  ];

  const failed = checks.filter((c) => !c.ok);
  if (failed.length > 0) {
    return { ok: false, reason: failed.map((c) => c.name).join(', ') };
  }
  return { ok: true };
}

/**
 * Run a single algorithm test.
 */
async function testAlgorithm(
  algorithm: GenerateSchedulePayload['algorithm'],
  timeLimitS: number,
): Promise<EngineTestResult> {
  const start = performance.now();
  const payload: GenerateSchedulePayload = { algorithm, time_limit_s: timeLimitS };

  try {
    const res: GenerateScheduleResponse = await scheduleService.generateSchedule(payload);
    const durationMs = performance.now() - start;

    const validation = validateResponse(algorithm, res);

    return {
      algorithm,
      passed: validation.ok,
      response: res,
      error: validation.ok ? undefined : validation.reason,
      durationMs,
    };
  } catch (err) {
    const durationMs = performance.now() - start;
    return {
      algorithm,
      passed: false,
      error: err instanceof Error ? err.message : String(err),
      durationMs,
    };
  }
}

/**
 * Run all algorithm tests sequentially.
 * @param timeLimitS Time limit in seconds for each algorithm (default 30).
 */
export async function runAllTests(
  timeLimitS: number = 30,
): Promise<EngineTestSummary> {
  const results: EngineTestResult[] = [];

  // eslint-disable-next-line no-console
  console.log(`[EngineTest] Running ${ALGORITHMS.length} algorithm tests (time_limit_s=${timeLimitS})...`);

  for (const algo of ALGORITHMS) {
    // eslint-disable-next-line no-console
    console.log(`[EngineTest] Testing ${algo}...`);
    const result = await testAlgorithm(algo, timeLimitS);
    results.push(result);

    if (result.passed) {
      // eslint-disable-next-line no-console
      console.log(
        `[EngineTest] ✅ ${algo} passed in ${result.durationMs?.toFixed(0)}ms ` +
          `(feasible=${result.response?.feasible}, classes=${result.response?.class_count}, ` +
          `violations=${result.response?.violations.length}, unplaced=${result.response?.unplaced.length})`,
      );
    } else {
      // eslint-disable-next-line no-console
      console.error(
        `[EngineTest] ❌ ${algo} failed: ${result.error}`,
      );
    }
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;

  // eslint-disable-next-line no-console
  console.log(
    `[EngineTest] Summary: ${passed}/${results.length} passed, ${failed} failed.`,
  );

  return { total: results.length, passed, failed, results };
}

export default { runAllTests, testAlgorithm };
