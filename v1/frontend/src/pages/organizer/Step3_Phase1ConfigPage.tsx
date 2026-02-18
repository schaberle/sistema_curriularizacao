/**
 * Step 3: Phase 1 Configuration Page
 * Container for configuring Phase 1 optimization parameters (wPref, wDup, wDiv)
 * and validating distribution requirements before execution
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useDistribution } from '../../hooks/useDistribution';
import { useToast } from '../../hooks/useToast';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Phase1ConfigView } from '../../components/organizer/views/Phase1ConfigView';
import {
  Statistics,
  Phase1Config,
  DEFAULT_PHASE1_CONFIG,
  ValidationResult,
  ValidationCheck
} from '../../types/distribution.types';

/**
 * Validation logic: Check distribution requirements
 */
function validateDistribution(stats: Statistics | null): ValidationResult {
  if (!stats) {
    return {
      status: 'fail',
      checks: [],
      canProceed: false
    };
  }

  const checks: ValidationCheck[] = [
    // CRITICAL: Minimum students
    {
      id: 'min-students',
      label: 'MÃ­nimo de alunos',
      status: stats.totalStudents >= 4 ? 'pass' : 'fail',
      message: stats.totalStudents >= 4
        ? `${stats.totalStudents} alunos cadastrados`
        : `Apenas ${stats.totalStudents} alunos. NecessÃ¡rio: mÃ­nimo 4`,
      severity: 'critical'
    },

    // RECOMMENDED: Preference completion rate
    {
      id: 'preference-rate',
      label: 'Taxa de preferÃªncias',
      status: stats.preferenceCompletionRate >= 50 ? 'pass' : 'warning',
      message: `${stats.preferenceCompletionRate.toFixed(1)}% dos alunos registraram preferÃªncias`,
      severity: 'recommended'
    },

    // RECOMMENDED: Phase diversity
    {
      id: 'phase-diversity',
      label: 'Diversidade de fases',
      status: Object.keys(stats.phaseBreakdown).length >= 2 ? 'pass' : 'warning',
      message: `${Object.keys(stats.phaseBreakdown).length} fase(s) distinta(s)`,
      severity: 'recommended'
    },

    // RECOMMENDED: Electrical engineers availability
    {
      id: 'electrical-engineers',
      label: 'Engenheiros ElÃ©tricos',
      status: stats.courseBreakdown.electrical >= Math.ceil(stats.totalStudents / 4)
        ? 'pass'
        : 'warning',
      message: `${stats.courseBreakdown.electrical} EE disponÃ­veis (${Math.ceil(stats.totalStudents / 4)} recomendado)`,
      severity: 'recommended'
    }
  ];

  // Determine overall status
  const hasCriticalFailure = checks.some(
    (c) => c.severity === 'critical' && c.status === 'fail'
  );
  const hasWarning = checks.some((c) => c.status === 'warning');

  return {
    status: hasCriticalFailure ? 'fail' : hasWarning ? 'warning' : 'pass',
    checks,
    canProceed: !hasCriticalFailure
  };
}

/**
 * Step 3: Phase 1 Configuration Container
 */
export function Step3_Phase1ConfigPage() {
  const { distributionId } = useParams<{ distributionId: string }>();
  const navigate = useNavigate();
  const { phase1Config, statistics, actions } = useDistribution();
  const { addToast } = useToast();
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeDistributionId = distributionId ?? '';

  // Calculate validation based on statistics
  const validation = useMemo(
    () => validateDistribution(statistics),
    [statistics]
  );

  const scheduleMarkExecutionPending = useCallback(() => {
    if (!activeDistributionId) {
      return;
    }

    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
    }

    pendingTimerRef.current = setTimeout(async () => {
      try {
        await actions.markExecutionPending(activeDistributionId, 'phase1');
      } catch {
        addToast({
          type: 'warning',
          message: 'Nao foi possivel registrar a alteracao pendente da Fase 1.',
        });
      }
    }, 500);
  }, [actions, addToast, activeDistributionId]);

  useEffect(() => {
    return () => {
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
      }
    };
  }, []);

  // Handler: Change individual parameter
  const handleParameterChange = (param: keyof Phase1Config, value: number) => {
    actions.setPhase1Config({ [param]: value });
    scheduleMarkExecutionPending();
  };

  // Handler: Reset to defaults
  const handleResetToDefaults = () => {
    actions.setPhase1Config(DEFAULT_PHASE1_CONFIG);
    scheduleMarkExecutionPending();
    addToast({
      type: 'success',
      message: 'ParÃ¢metros resetados para o padrÃ£o'
    });
  };

  // Handler: Navigate to next step
  const handleNext = () => {
    if (!validation.canProceed) {
      addToast({
        type: 'error',
        message: 'Corrija os problemas crÃ­ticos antes de prosseguir'
      });
      return;
    }
    navigate(`/organizer/${activeDistributionId}/step4-phase1-execute`);
  };

  // Handler: Navigate back
  const handlePrevious = () => {
    navigate(`/organizer/${activeDistributionId}/step2-data`);
  };

  if (!activeDistributionId) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Erro: ID da distribuicao nao encontrado</p>
      </div>
    );
  }

  // Render
  return (
    <Phase1ConfigView
      config={phase1Config}
      validation={validation}
      onParameterChange={handleParameterChange}
      onResetToDefaults={handleResetToDefaults}
      onNext={handleNext}
      onPrevious={handlePrevious}
    />
  );
}

