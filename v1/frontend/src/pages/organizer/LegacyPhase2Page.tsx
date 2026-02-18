/**
 * Legacy Phase 2 page (temporary)
 */

import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Phase2Execution } from '../../components/organizer/Phase2Execution';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { useDistribution } from '../../hooks/useDistribution';
import { useToast } from '../../hooks/useToast';

export function LegacyPhase2Page() {
  const { distributionId } = useParams<{ distributionId: string }>();
  const navigate = useNavigate();
  const { currentDistribution, phase2Config, loading, errors, actions } = useDistribution();
  const { addToast } = useToast();

  useEffect(() => {
    if (!distributionId) return;

    if (!currentDistribution || currentDistribution.id !== distributionId) {
      actions.loadDistribution(distributionId).catch(() => {
        addToast({ type: 'error', message: 'Nao foi possivel carregar a distribuicao' });
      });
    }
  }, [distributionId, currentDistribution, actions, addToast]);

  if (!distributionId) {
    return (
      <ErrorAlert
        title="Distribuicao invalida"
        message="Nao foi possivel identificar a distribuicao."
        onRetry={() => navigate('/organizer')}
      />
    );
  }

  if (errors.loadDistribution) {
    return (
      <ErrorAlert
        title="Erro ao carregar"
        message={errors.loadDistribution}
        onRetry={() => actions.loadDistribution(distributionId)}
      />
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Fluxo temporario: a Fase 2 ainda esta no modo legado enquanto os Steps 6-9 sao finalizados.
      </div>

      <Phase2Execution
        distributionId={distributionId}
        config={{
          wSoc: phase2Config.wSoc,
          maxIterations: phase2Config.maxIterations,
          temperature: phase2Config.temperature,
        }}
        setConfig={(config) =>
          actions.setPhase2Config({
            wSoc: config.wSoc,
            maxIterations: config.maxIterations,
            temperature: config.temperature,
          })
        }
        loading={loading.executePhase2}
        onExecute={async () => {
          try {
            actions.setPhase2Enabled(true);
            await actions.executePhase2(distributionId, phase2Config);
            addToast({ type: 'success', message: 'Fase 2 executada com sucesso' });
            navigate(`/organizer/${distributionId}/step5-phase1-results`);
          } catch {
            addToast({ type: 'error', message: 'Erro ao executar Fase 2' });
          }
        }}
        onBack={() => navigate(`/organizer/${distributionId}/step5-phase1-results`)}
        onViewResults={() => navigate(`/organizer/${distributionId}/step5-phase1-results`)}
      />
    </div>
  );
}

