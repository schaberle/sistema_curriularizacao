/**
 * Phase 1 Execution View
 * Presentation layer for Phase 1 execution and progress monitoring
 */

import { ExecutionReport } from '../../../types/distribution.types';
import { Button } from '../../common/Button';
import { Card } from '../../common/Card';
import { ExecutionStatusSection } from '../sections/ExecutionStatusSection';

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

interface Phase1ExecutionViewProps {
  execState: ExecutionState;
  loading: boolean;
  errorMessage: string | null;
  phase1Report: ExecutionReport | null;
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
