import { Activity, Play } from 'lucide-react';
import { Button } from '../common/Button';

type SimulationRunControllerProps = {
  canRunPhase1: boolean;
  canRunPhase2: boolean;
  isExecutingPhase1: boolean;
  isExecutingPhase2: boolean;
  runStatusLabel: string;
  runId?: string;
  onStartPhase1: () => void;
  onStartPhase2: () => void;
};

export function SimulationRunController({
  canRunPhase1,
  canRunPhase2,
  isExecutingPhase1,
  isExecutingPhase2,
  runStatusLabel,
  runId,
  onStartPhase1,
  onStartPhase2,
}: SimulationRunControllerProps) {
  return (
    <div className="space-y-2">
      <Button
        variant="primary"
        size="sm"
        className="w-full justify-start"
        isLoading={isExecutingPhase1}
        onClick={onStartPhase1}
        disabled={!canRunPhase1 || isExecutingPhase2}
        icon={<Play className="h-4 w-4" />}
      >
        Iniciar run Fase 1
      </Button>

      <Button
        variant="secondary"
        size="sm"
        className="w-full justify-start"
        isLoading={isExecutingPhase2}
        onClick={onStartPhase2}
        disabled={!canRunPhase2 || isExecutingPhase1}
        icon={<Activity className="h-4 w-4" />}
      >
        Iniciar run Fase 2
      </Button>

      <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        Status run: <strong>{runStatusLabel}</strong>
        {runId ? <span className="mt-1 block font-mono text-[10px] text-slate-500">{runId}</span> : null}
      </p>
    </div>
  );
}
