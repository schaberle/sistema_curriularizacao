import { ExecutionReport } from '../../../types/distribution.types';
import { Button } from '../../common/Button';
import { Card } from '../../common/Card';

interface Phase2ExecutionState {
  isRunning: boolean;
  progress: number;
  elapsedMs: number;
  currentMessage: string;
  error: string | null;
  success: boolean;
}

interface Phase2ExecutionViewProps {
  execState: Phase2ExecutionState;
  loading: boolean;
  errorMessage: string | null;
  report: ExecutionReport | null;
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
