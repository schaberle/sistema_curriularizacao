import { SimulationRunManager } from './SimulationRuntime';

describe('SimulationRunManager', () => {
  it('emits ordered events and stores result', () => {
    const manager = new SimulationRunManager();
    const run = manager.createRun('dist-1', 'org-1', 'phase1', ['T1', 'T2', 'T3']);

    manager.publishSnapshot(run.runId, {
      runId: run.runId,
      phase: 'phase1',
      stage: 'initial',
      iteration: 0,
      acceptedSwaps: 0,
      energy: -10,
      positions: [],
      emittedAt: new Date().toISOString(),
    });

    manager.completeRun(run.runId, {
      runId: run.runId,
      distributionId: 'dist-1',
      phase: 'phase1',
      executionTime: 123,
      axisThemeIds: ['T1', 'T2', 'T3'],
      finalPositions: [],
      completedAt: new Date().toISOString(),
    });

    const events = manager.getRunEvents(run.runId);
    expect(events.map((event) => event.type)).toEqual(['run_started', 'snapshot', 'phase_completed']);

    const result = manager.getRunResult(run.runId);
    expect(result?.executionTime).toBe(123);
    expect(result?.phase).toBe('phase1');
  });
});
