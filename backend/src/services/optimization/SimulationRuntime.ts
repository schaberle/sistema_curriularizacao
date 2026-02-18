import { EventEmitter } from 'events';
import { AffinityMatrix } from '../../domain/AffinityMatrix';
import { Student } from '../../domain';
import {
  ProjectionMode,
  ProjectionWeights,
  VectorState,
  VectorStateConfig,
  VectorStateSnapshot,
} from './VectorState';

export type SimulationPhase = 'phase1' | 'phase2';

export type SimulationSnapshotPosition = {
  studentId: string;
  name: string;
  course: string;
  phase: number;
  x: number;
  y: number;
  z: number;
  groupId?: string;
};

export type SimulationSnapshotEvent = {
  runId: string;
  phase: SimulationPhase;
  stage: 'initial' | 'local_search' | 'annealing' | 'social_optimizer';
  iteration: number;
  acceptedSwaps: number;
  temperature?: number;
  energy: number;
  positions: SimulationSnapshotPosition[];
  emittedAt: string;
};

export type SimulationRunStartPayload = {
  runId: string;
  distributionId: string;
  organizerId: string;
  phase: SimulationPhase;
  axisThemeIds: [string, string, string];
  startedAt: string;
  initialPositions?: SimulationSnapshotPosition[];
};

export type SimulationRunCompletedPayload = {
  runId: string;
  distributionId: string;
  phase: SimulationPhase;
  executionTime: number;
  axisThemeIds: [string, string, string];
  metrics?: any;
  before?: any;
  after?: any;
  groups?: any[];
  changes?: any[];
  socialExecution?: {
    attemptedSwaps: number;
    swapsAccepted: number;
    stabilityPercent: number;
  };
  finalPositions: SimulationSnapshotPosition[];
  completedAt: string;
};

export type SimulationRunErrorPayload = {
  runId: string;
  distributionId: string;
  phase: SimulationPhase;
  message: string;
  at: string;
};

export type SimulationRunEventRecord = {
  type: 'run_started' | 'snapshot' | 'phase_completed' | 'run_error';
  payload:
    | SimulationRunStartPayload
    | SimulationSnapshotEvent
    | SimulationRunCompletedPayload
    | SimulationRunErrorPayload;
};

export type SimulationRuntimeContext = {
  enabled: boolean;
  runId?: string;
  phase: SimulationPhase;
  students: Student[];
  vectorState: VectorState;
  axisThemeIds: [string, string, string];
  projectionMode?: ProjectionMode;
  projectionWeights?: ProjectionWeights;
  lambdaVec?: number;
  snapshotEvery?: number;
  dynamicsConfig?: VectorStateConfig;
  affinityMatrix?: AffinityMatrix;
  onSnapshot?: (event: SimulationSnapshotEvent) => void;
};

export type SimulationRunStatus = 'running' | 'completed' | 'failed';

export type SimulationRunRecord = {
  id: string;
  distributionId: string;
  organizerId: string;
  phase: SimulationPhase;
  axisThemeIds: [string, string, string];
  status: SimulationRunStatus;
  startedAt: string;
  completedAt?: string;
  error?: string;
  events: SimulationRunEventRecord[];
  result?: SimulationRunCompletedPayload;
};

const RUN_TTL_MS = 1000 * 60 * 60;

export class SimulationRunManager {
  private runs = new Map<string, SimulationRunRecord>();
  private activeRunByDistribution = new Map<string, string>();
  private emitter = new EventEmitter();
  private vectorSnapshotByDistribution = new Map<string, VectorStateSnapshot>();

  createRun(
    distributionId: string,
    organizerId: string,
    phase: SimulationPhase,
    axisThemeIds: [string, string, string],
    initialPositions?: SimulationSnapshotPosition[]
  ): SimulationRunStartPayload {
    this.cleanupExpiredRuns();

    const activeRunId = this.activeRunByDistribution.get(distributionId);
    if (activeRunId) {
      this.failRun(activeRunId, 'Run cancelado por nova execucao.');
    }

    const runId = `simrun_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const startedAt = new Date().toISOString();

    const record: SimulationRunRecord = {
      id: runId,
      distributionId,
      organizerId,
      phase,
      axisThemeIds,
      status: 'running',
      startedAt,
      events: [],
    };

    this.runs.set(runId, record);
    this.activeRunByDistribution.set(distributionId, runId);

    const payload: SimulationRunStartPayload = {
      runId,
      distributionId,
      organizerId,
      phase,
      axisThemeIds,
      startedAt,
      initialPositions,
    };

    this.pushEvent(runId, {
      type: 'run_started',
      payload,
    });

    return payload;
  }

  publishSnapshot(runId: string, event: SimulationSnapshotEvent): void {
    this.pushEvent(runId, {
      type: 'snapshot',
      payload: event,
    });
  }

  completeRun(runId: string, payload: SimulationRunCompletedPayload): void {
    const record = this.runs.get(runId);
    if (!record || record.status !== 'running') {
      return;
    }

    record.status = 'completed';
    record.completedAt = payload.completedAt;
    record.result = payload;

    this.pushEvent(runId, {
      type: 'phase_completed',
      payload,
    });

    this.clearActiveRun(record.distributionId, runId);
  }

  failRun(runId: string, message: string): void {
    const record = this.runs.get(runId);
    if (!record || record.status !== 'running') {
      return;
    }

    record.status = 'failed';
    record.completedAt = new Date().toISOString();
    record.error = message;

    this.pushEvent(runId, {
      type: 'run_error',
      payload: {
        runId,
        distributionId: record.distributionId,
        phase: record.phase,
        message,
        at: record.completedAt,
      },
    });

    this.clearActiveRun(record.distributionId, runId);
  }

  getRun(runId: string): SimulationRunRecord | null {
    return this.runs.get(runId) || null;
  }

  getRunResult(runId: string): SimulationRunCompletedPayload | null {
    return this.runs.get(runId)?.result || null;
  }

  getRunEvents(runId: string): SimulationRunEventRecord[] {
    const events = this.runs.get(runId)?.events || [];
    return [...events];
  }

  subscribe(runId: string, listener: (event: SimulationRunEventRecord) => void): () => void {
    const key = this.getEmitterKey(runId);
    this.emitter.on(key, listener);
    return () => {
      this.emitter.off(key, listener);
    };
  }

  setVectorSnapshot(distributionId: string, snapshot: VectorStateSnapshot): void {
    this.vectorSnapshotByDistribution.set(distributionId, snapshot);
  }

  getVectorSnapshot(distributionId: string): VectorStateSnapshot | null {
    return this.vectorSnapshotByDistribution.get(distributionId) || null;
  }

  private pushEvent(runId: string, event: SimulationRunEventRecord): void {
    const record = this.runs.get(runId);
    if (!record) {
      return;
    }

    record.events.push(event);

    const key = this.getEmitterKey(runId);
    this.emitter.emit(key, event);
  }

  private clearActiveRun(distributionId: string, runId: string): void {
    if (this.activeRunByDistribution.get(distributionId) === runId) {
      this.activeRunByDistribution.delete(distributionId);
    }
  }

  private getEmitterKey(runId: string): string {
    return `run:${runId}`;
  }

  private cleanupExpiredRuns(): void {
    const now = Date.now();

    for (const [runId, record] of this.runs.entries()) {
      const referenceTime = record.completedAt ? new Date(record.completedAt).getTime() : new Date(record.startedAt).getTime();
      if (!Number.isFinite(referenceTime)) {
        continue;
      }
      if (now - referenceTime > RUN_TTL_MS) {
        this.runs.delete(runId);
      }
    }
  }
}
