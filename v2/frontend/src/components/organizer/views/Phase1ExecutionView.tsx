/**
 * Phase 1 Execution View
 * Presentation layer for Phase 1 execution and progress monitoring
 */

import { ExecutionReport, SimulationVisualState, VisualGroupPartition } from '../../../types/distribution.types';
import { Button } from '../../common/Button';
import { Card } from '../../common/Card';
import { ExecutionStatusSection } from '../sections/ExecutionStatusSection';
import { SimulationNetwork3D } from '../simulation3d/SimulationNetwork3D';

interface ExecutionState {
  isRunning: boolean;
  progress: number;
  startTime: number | null;
  elapsedMs: number;
  iterationCount: number;
  estimatedTotalMs: number | null;
  currentMessage: string;
  error: string | null;
  success: boolean;
}

type GroupThemeLookup = Record<
  string,
  {
    themeId?: string;
    themeName?: string;
    themeIndex?: number;
    isRealtimeFallback?: boolean;
  }
>;

interface Phase1ExecutionViewProps {
  execState: ExecutionState;
  loading: boolean;
  errorMessage: string | null;
  phase1Report: ExecutionReport | null;
  visualState: SimulationVisualState | null;
  effectivePartition: VisualGroupPartition;
  effectiveGroupThemes: GroupThemeLookup;
  visualizationLoading: boolean;
  visualizationError: string | null;
  showAffinityEdges: boolean;
  showGroupHulls: boolean;
  forceIntensity: number;
  onToggleAffinityEdges: (value: boolean) => void;
  onToggleGroupHulls: (value: boolean) => void;
  onForceIntensityChange: (value: number) => void;
  onRefreshVisualization: () => void;
  onExecute: () => Promise<void>;
  onViewResults: () => void;
  onRetry: () => void;
  onPrevious: () => void;
}

export function Phase1ExecutionView({
  execState,
  loading,
  errorMessage,
  phase1Report,
  visualState,
  effectivePartition,
  effectiveGroupThemes,
  visualizationLoading,
  visualizationError,
  showAffinityEdges,
  showGroupHulls,
  forceIntensity,
  onToggleAffinityEdges,
  onToggleGroupHulls,
  onForceIntensityChange,
  onRefreshVisualization,
  onExecute,
  onViewResults,
  onRetry,
  onPrevious,
}: Phase1ExecutionViewProps) {
  const isCompleted = Boolean(phase1Report) && !execState.isRunning;

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="space-y-2">
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Execucao da Fase 1</h2>
        <p className="max-w-3xl text-sm text-slate-600">
          Execute o algoritmo e acompanhe o progresso em tempo real.
        </p>
      </header>

      <Card title="Status" padding="lg">
        <ExecutionStatusSection execState={execState} phase1Report={phase1Report} loading={loading} />
      </Card>

      <Card
        title="Rede 3D de Leitura"
        subtitle="Camada visual desacoplada da otimizacao (somente leitura de estado)"
        padding="lg"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={showAffinityEdges}
                onChange={(event) => onToggleAffinityEdges(event.target.checked)}
              />
              Arestas de afinidade
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={showGroupHulls}
                onChange={(event) => onToggleGroupHulls(event.target.checked)}
              />
              Envelopes de grupo
            </label>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span>Intensidade das forcas</span>
            <input
              type="range"
              min={0.2}
              max={3}
              step={0.1}
              value={forceIntensity}
              onChange={(event) => onForceIntensityChange(parseFloat(event.target.value))}
              className="w-28"
            />
            <span className="font-mono">{forceIntensity.toFixed(1)}x</span>
            <Button
              variant="outline"
              size="sm"
              onClick={onRefreshVisualization}
              isLoading={visualizationLoading}
            >
              Atualizar
            </Button>
          </div>
        </div>

        <SimulationNetwork3D
          students={visualState?.students ?? []}
          partition={effectivePartition}
          groupThemes={effectiveGroupThemes}
          affinities={visualState?.affinities ?? []}
          isolationScoreByStudentId={visualState?.isolationScoreByStudentId}
          isRunning={execState.isRunning}
          showAffinityEdges={showAffinityEdges}
          showGroupHulls={showGroupHulls}
          forceIntensity={forceIntensity}
        />

        {visualizationError && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            {visualizationError}
          </p>
        )}
      </Card>

      {(execState.error || errorMessage) && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {execState.error || errorMessage}
        </div>
      )}

      {isCompleted && phase1Report && (
        <Card title="Resumo" padding="lg">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Grupos criados</p>
              <p className="mt-1 text-2xl font-extrabold text-slate-900">{phase1Report.groupsCreated}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Tempo</p>
              <p className="mt-1 text-2xl font-extrabold text-slate-900">{(phase1Report.executionTimeMs / 1000).toFixed(2)}s</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Viabilidade</p>
              <p className={`mt-1 text-sm font-semibold ${phase1Report.feasible ? 'text-emerald-700' : 'text-amber-700'}`}>
                {phase1Report.feasible ? 'Viavel' : 'Com ressalvas'}
              </p>
            </div>
          </div>
        </Card>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
        <Button variant="outline" onClick={onPrevious} disabled={execState.isRunning || loading}>
          Voltar
        </Button>

        {!isCompleted ? (
          <Button variant="primary" onClick={onExecute} disabled={execState.isRunning || loading} isLoading={execState.isRunning || loading}>
            {execState.isRunning ? 'Executando' : 'Executar Fase 1'}
          </Button>
        ) : (
          <div className="flex gap-2">
            {execState.error && (
              <Button variant="secondary" onClick={onRetry} disabled={loading}>
                Tentar novamente
              </Button>
            )}
            <Button variant="primary" onClick={onViewResults} disabled={loading}>
              Ver resultados
            </Button>
          </div>
        )}
      </footer>
    </div>
  );
}
