import { ExecutionReport, SimulationVisualState, VisualGroupPartition } from '../../../types/distribution.types';
import { Button } from '../../common/Button';
import { Card } from '../../common/Card';
import { SimulationNetwork3D } from '../simulation3d/SimulationNetwork3D';

interface Phase2ExecutionState {
  isRunning: boolean;
  progress: number;
  elapsedMs: number;
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

interface Phase2ExecutionViewProps {
  execState: Phase2ExecutionState;
  loading: boolean;
  errorMessage: string | null;
  report: ExecutionReport | null;
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
  onViewFinalResults: () => void;
  onRetry: () => void;
  onPrevious: () => void;
}

function formatSeconds(ms: number): string {
  return `${Math.floor(ms / 1000)}s`;
}

export function Phase2ExecutionView({
  execState,
  loading,
  errorMessage,
  report,
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
  onViewFinalResults,
  onRetry,
  onPrevious,
}: Phase2ExecutionViewProps) {
  const isCompleted = Boolean(report) && !execState.isRunning;

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="space-y-2">
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Execucao da Fase 2</h2>
        <p className="max-w-3xl text-sm text-slate-600">
          Otimizacao social dos grupos com base nas afinidades coletadas.
        </p>
      </header>

      <Card title="Status da execucao" padding="lg">
        <div className="space-y-4">
          <p className="text-sm font-semibold text-slate-900">{execState.currentMessage}</p>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-700">Progresso</span>
              <span className="font-bold text-[var(--brand-700)]">{Math.round(execState.progress)}%</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--brand-500)] to-[var(--brand-700)] transition-all duration-500"
                style={{ width: `${execState.progress}%` }}
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Tempo decorrido</p>
            <p className="font-mono text-lg font-bold text-slate-900">{formatSeconds(execState.elapsedMs)}</p>
          </div>
        </div>
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

      {isCompleted && report && (
        <Card title="Resumo da Fase 2" padding="lg">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Grupos processados</p>
              <p className="mt-1 text-2xl font-extrabold text-slate-900">{report.groupsCreated}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Tempo</p>
              <p className="mt-1 text-2xl font-extrabold text-slate-900">{(report.executionTimeMs / 1000).toFixed(2)}s</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Resultado</p>
              <p className={`mt-1 text-sm font-semibold ${report.feasible ? 'text-emerald-700' : 'text-amber-700'}`}>
                {report.feasible ? 'Concluida' : 'Com ressalvas'}
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
          <Button
            variant="primary"
            onClick={onExecute}
            disabled={execState.isRunning || loading}
            isLoading={execState.isRunning || loading}
          >
            {execState.isRunning ? 'Executando' : 'Executar Fase 2'}
          </Button>
        ) : (
          <div className="flex gap-2">
            {execState.error && (
              <Button variant="secondary" onClick={onRetry} disabled={loading}>
                Tentar novamente
              </Button>
            )}
            <Button variant="primary" onClick={onViewFinalResults}>
              Ver resultados finais
            </Button>
          </div>
        )}
      </footer>
    </div>
  );
}
