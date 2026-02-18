import { DistributionStatus } from '../types/distribution.types';

export interface OrganizerStep {
  id: number;
  label: string;
  path: string;
}

export const ORGANIZER_STEPS: OrganizerStep[] = [
  { id: 1, label: 'Temas', path: 'step1-themes' },
  { id: 2, label: 'Dados', path: 'step2-data' },
  { id: 3, label: 'Config Fase 1', path: 'step3-phase1-config' },
  { id: 4, label: 'Exec Fase 1', path: 'step4-phase1-execute' },
  { id: 5, label: 'Res Fase 1', path: 'step5-phase1-results' },
  { id: 6, label: 'Afinidades', path: 'step6-affinities' },
  { id: 7, label: 'Config Fase 2', path: 'step7-phase2-config' },
  { id: 8, label: 'Exec Fase 2', path: 'step8-phase2-execute' },
  { id: 9, label: 'Final', path: 'step9-final-results' },
];

function toStepRoute(distributionId: string, path: string): string {
  return `/organizer/${distributionId}/${path}`;
}

interface ProgressContext {
  phase2ReportExists?: boolean;
  affinityCount?: number;
  phase1NeedsRerun?: boolean;
  phase2NeedsRerun?: boolean;
}

function getStepPathByStage(stage: number): string {
  const step = ORGANIZER_STEPS.find((item) => item.id === stage) ?? ORGANIZER_STEPS[0];
  return step.path;
}

export function getProgressStage(
  status: DistributionStatus | string,
  context: ProgressContext = {}
): number {
  const phase2ReportExists = context.phase2ReportExists ?? false;
  const affinityCount = context.affinityCount ?? 0;

  let baseStage = 1;

  switch (status) {
    case 'PENDING':
      baseStage = 1;
      break;
    case 'THEMED':
    case 'COLLECTING':
      baseStage = 2;
      break;
    case 'EXECUTING':
      baseStage = 4;
      break;
    case 'COMPLETED':
    case 'PARTIAL':
      baseStage = 5;
      break;
    case 'PHASE2':
      baseStage = 6;
      break;
    case 'PHASE2_EXECUTING':
      baseStage = 8;
      break;
    case 'PHASE2_COMPLETED':
      baseStage = 9;
      break;
    case 'FAILED':
      baseStage = phase2ReportExists ? 8 : 4;
      break;
    default:
      baseStage = 1;
      break;
  }

  if (affinityCount > 0) {
    if (baseStage <= 4) {
      baseStage = 6;
    } else if (baseStage <= 6) {
      baseStage = 7;
    }
  }

  if (phase2ReportExists) {
    baseStage = Math.max(baseStage, 9);
  }

  return baseStage;
}

export function getContinueRoute(
  distributionId: string,
  status: DistributionStatus | string,
  context: ProgressContext = {}
): string {
  if (context.phase1NeedsRerun) {
    return toStepRoute(distributionId, 'step4-phase1-execute');
  }

  if (context.phase2NeedsRerun) {
    return toStepRoute(distributionId, 'step8-phase2-execute');
  }

  const stage = getProgressStage(status, context);
  return toStepRoute(distributionId, getStepPathByStage(stage));
}

export function getResultsRoute(
  distributionId: string,
  status: DistributionStatus | string
): string {
  if (status === 'PHASE2_COMPLETED') {
    return toStepRoute(distributionId, 'step9-final-results');
  }
  return toStepRoute(distributionId, 'step5-phase1-results');
}

export function isStepWarning(
  stepId: number,
  context: Pick<ProgressContext, 'phase1NeedsRerun' | 'phase2NeedsRerun'>
): boolean {
  if (context.phase1NeedsRerun && (stepId === 4 || stepId === 5)) {
    return true;
  }

  if (context.phase2NeedsRerun && (stepId === 8 || stepId === 9)) {
    return true;
  }

  return false;
}
