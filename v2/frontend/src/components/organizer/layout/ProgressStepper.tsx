/**
 * ProgressStepper Component
 * Visual indication of progress through wizard steps (phase 1)
 */

import React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Circle } from 'lucide-react';
import { useDistribution } from '../../../hooks/useDistribution';
import { ORGANIZER_STEPS, getProgressStage, isStepWarning } from '../../../utils/distributionFlow';

export function ProgressStepper() {
  const location = useLocation();
  const { distributionId } = useParams();
  const navigate = useNavigate();
  const { currentDistribution, statistics, phase2Report } = useDistribution();

  const currentStep = ORGANIZER_STEPS.find((step) => location.pathname.includes(step.path));

  if (!currentStep) {
    return null;
  }

  const currentStepId = currentStep.id;
  const stage = currentDistribution
    ? getProgressStage(currentDistribution.status, {
        phase2ReportExists: Boolean(phase2Report),
        affinityCount: statistics?.studentsWithAffinities ?? 0,
      })
    : currentStepId;

  const maxReachedStep = Math.max(stage, currentStepId);
  const phase1NeedsRerun = Boolean(currentDistribution?.phase1NeedsRerun);
  const phase2NeedsRerun = Boolean(currentDistribution?.phase2NeedsRerun);

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-[880px] items-center gap-2 sm:gap-3">
        {ORGANIZER_STEPS.map((step) => {
          const isAccessible = step.id <= maxReachedStep;
          const isCurrent = step.id === currentStepId;
          const isWarning = isStepWarning(step.id, { phase1NeedsRerun, phase2NeedsRerun });
          const isCompleted = !isCurrent && isAccessible && !isWarning;
          const isLocked = !isAccessible;
          const isLast = step.id === ORGANIZER_STEPS.length;
          const nextStepWarning = isStepWarning(step.id + 1, { phase1NeedsRerun, phase2NeedsRerun });
          const connectorIsActive = step.id < maxReachedStep;

          return (
            <React.Fragment key={step.id}>
              <button
                type="button"
                onClick={() => {
                  if (distributionId && isAccessible) {
                    navigate(`/organizer/${distributionId}/${step.path}`);
                  }
                }}
                className="group flex flex-col items-center gap-1"
                disabled={!isAccessible}
              >
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
                    isCurrent && isWarning
                      ? 'border-amber-500 bg-amber-50 text-amber-700 ring-4 ring-amber-100'
                      : isCurrent
                      ? 'border-[var(--brand-600)] bg-[var(--brand-50)] text-[var(--brand-700)] ring-4 ring-[var(--brand-100)]'
                      : isWarning
                      ? 'border-amber-400 bg-amber-100 text-amber-700'
                      : isCompleted
                      ? 'border-[var(--brand-600)] bg-[var(--brand-600)] text-white'
                      : isLocked
                      ? 'border-slate-300 bg-white text-slate-400'
                      : 'border-slate-300 bg-slate-100 text-slate-500'
                  }`}
                >
                  {isWarning ? (
                    <AlertTriangle className="h-5 w-5" />
                  ) : isCompleted ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <Circle className="h-5 w-5" />
                  )}
                </div>
                <span
                  className={`hidden text-center text-xs font-medium sm:block ${
                    isCurrent
                      ? 'text-slate-900'
                      : isWarning
                      ? 'text-amber-700'
                      : isCompleted
                      ? 'text-[var(--brand-700)]'
                      : 'text-slate-500'
                  }`}
                >
                  {step.label}
                </span>
              </button>

              {!isLast && (
                <div
                  className={`h-0.5 flex-1 rounded-full transition-colors ${
                    connectorIsActive
                      ? nextStepWarning
                        ? 'bg-amber-400'
                        : 'bg-[var(--brand-500)]'
                      : 'bg-slate-200'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
