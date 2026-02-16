/**
 * Statistics Section
 * Displays real-time distribution statistics
 */

import { AlertCircle, RefreshCw, TrendingUp } from 'lucide-react';
import { Statistics } from '../../../types/distribution.types';
import { Button } from '../../common/Button';

interface StatisticsSectionProps {
  statistics: Statistics | null;
  loading?: boolean;
  onRefresh?: () => void;
}

export function StatisticsSection({ statistics, loading = false, onRefresh }: StatisticsSectionProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="h-16 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-16 animate-pulse rounded-lg bg-slate-100" />
        </div>
        <div className="h-20 animate-pulse rounded-lg bg-slate-100" />
      </div>
    );
  }

  if (!statistics) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <p className="mb-3">Nenhuma estatistica disponivel ainda.</p>
        {onRefresh && (
          <Button variant="outline" size="sm" onClick={onRefresh} icon={<RefreshCw className="h-4 w-4" />}>
            Atualizar agora
          </Button>
        )}
      </div>
    );
  }

  const phaseEntries = Object.entries(statistics.phaseBreakdown).sort(
    (a, b) => Number(a[0]) - Number(b[0])
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs text-slate-500">Engenharia Eletrica</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">{statistics.courseBreakdown.electrical}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs text-slate-500">Engenharia Mecanica</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">{statistics.courseBreakdown.mechanical}</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
          <TrendingUp className="h-4 w-4" />
          Distribuicao por fase
        </p>
        <div className="flex flex-wrap gap-2">
          {phaseEntries.map(([phase, count]) => (
            <span key={phase} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
              Fase {phase}: {count}
            </span>
          ))}
        </div>
      </div>

      {statistics.warnings?.length > 0 && (
        <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
          {statistics.warnings.map((warning, index) => (
            <p key={`${warning}-${index}`} className="flex gap-2 text-xs text-amber-900">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {warning}
            </p>
          ))}
        </div>
      )}

      <p className="text-right text-xs text-slate-500">
        Atualizado em {new Date(statistics.lastUpdated).toLocaleTimeString('pt-BR')}
      </p>
    </div>
  );
}

