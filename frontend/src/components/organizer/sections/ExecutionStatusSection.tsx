/**
 * Execution Status Section
 * Displays real-time progress, elapsed time, and status messages
 */

import { LoaderCircle, Sparkles } from 'lucide-react';
import { ExecutionReport } from '../../../types/distribution.types';

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

interface ExecutionStatusSectionProps {
  execState: ExecutionState;
  phase1Report: ExecutionReport | null;
  loading: boolean;
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);

  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }

  return `${seconds}s`;
}

function estimateRemaining(elapsed: number, progress: number): string {
  if (progress <= 0 || progress >= 100) return '-';

  const rate = elapsed / progress;
  const estimatedTotal = rate * 100;
  const remaining = estimatedTotal - elapsed;

  return formatTime(Math.max(0, remaining));
}

export function ExecutionStatusSection({ execState, phase1Report }: ExecutionStatusSectionProps) {
  const isCompleted = !execState.isRunning && phase1Report !== null;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          {execState.isRunning ? (
            <LoaderCircle className="h-4 w-4 animate-spin text-[var(--brand-600)]" />
          ) : (
            <Sparkles className="h-4 w-4 text-[var(--brand-600)]" />
          )}
          {execState.currentMessage}
        </p>
        {execState.isRunning && (
          <p className="mt-1 text-xs text-slate-600">Mantenha esta pagina aberta ate a conclusao.</p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700">Progresso</span>
          <span className="font-bold text-[var(--brand-700)]">{Math.round(execState.progress)}%</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[var(--brand-500)] to-[var(--brand-700)] transition-all duration-500"
            style={{ width: `${execState.progress}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-xs text-slate-500">Tempo decorrido</p>
          <p className="mt-1 font-mono text-lg font-bold text-slate-900">{formatTime(execState.elapsedMs)}</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-xs text-slate-500">Tempo restante (estimado)</p>
          <p className="mt-1 font-mono text-lg font-bold text-slate-900">
            {execState.isRunning ? estimateRemaining(execState.elapsedMs, execState.progress) : '-'}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-xs text-slate-500">Iteracoes</p>
          <p className="mt-1 text-lg font-bold text-slate-900">{execState.iterationCount}x</p>
        </div>
      </div>

      {isCompleted && phase1Report && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            phase1Report.feasible ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'
          }`}
        >
          {phase1Report.feasible
            ? 'Execucao concluida com sucesso. Os grupos ja podem ser revisados no proximo passo.'
            : 'Execucao concluida com ressalvas. Revise os resultados com atencao.'}
        </div>
      )}
    </div>
  );
}
