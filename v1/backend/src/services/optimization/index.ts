/**
 * Optimization Services - Serviços de otimização de distribuição
 */

export { ConstraintValidator } from './ConstraintValidator';
export { PreferenceScorer } from './PreferenceScorer';
export { SolutionGenerator } from './SolutionGenerator';
export { LocalSearch } from './LocalSearch';
export { SimulatedAnnealing } from './SimulatedAnnealing';
export { DistributionEngine } from './DistributionEngine';
export { SimulationIdealMetricsService } from './SimulationIdealMetricsService';
export { VectorState } from './VectorState';
export { SimulationRunManager } from './SimulationRuntime';
export type {
  SimulationRuntimeContext,
  SimulationSnapshotEvent,
  SimulationRunStartPayload,
  SimulationRunCompletedPayload,
  SimulationRunErrorPayload,
  SimulationRunEventRecord,
  SimulationPhase,
  SimulationSnapshotPosition,
} from './SimulationRuntime';
