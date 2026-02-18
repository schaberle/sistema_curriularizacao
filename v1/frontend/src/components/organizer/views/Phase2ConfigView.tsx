import { HeartHandshake } from 'lucide-react';
import { Button } from '../../common/Button';
import { Card } from '../../common/Card';
import { Phase2Config } from '../../../types/distribution.types';

interface Phase2ConfigViewProps {
  config: Phase2Config;
  loading: boolean;
  affinityCount: number;
  totalStudents: number;
  error: string | null;
  onConfigChange: (field: 'wSoc' | 'maxIterations' | 'temperature', value: number) => void;
  onExecute: () => Promise<void>;
  onPrevious: () => void;
}

export function Phase2ConfigView({
  config,
  loading,
  affinityCount,
  totalStudents,
  error,
  onConfigChange,
  onExecute,
  onPrevious,
}: Phase2ConfigViewProps) {
  const hasAffinities = affinityCount > 0 && totalStudents > 0;
  const canExecute = config.enabled && hasAffinities;

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="space-y-2">
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Configurar Fase 2</h2>
        <p className="max-w-3xl text-sm text-slate-600">
          Ajuste os parametros da otimizacao social antes de executar.
        </p>
      </header>

      <Card title="Parametros de otimizacao social" padding="lg">
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Peso social (wSoc)</label>
              <input
                type="number"
                min="0.1"
                max="5"
                step="0.1"
                value={config.wSoc}
                onChange={(event) => onConfigChange('wSoc', Number.parseFloat(event.target.value) || 1)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Iteracoes</label>
              <input
                type="number"
                min="5000"
                max="50000"
                step="1000"
                value={config.maxIterations}
                onChange={(event) => onConfigChange('maxIterations', Number.parseInt(event.target.value, 10) || 20000)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Temperatura</label>
              <input
                type="number"
                min="0.1"
                max="2"
                step="0.1"
                value={config.temperature}
                onChange={(event) => onConfigChange('temperature', Number.parseFloat(event.target.value) || 0.8)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p>
              Afinidades coletadas: <strong>{affinityCount}</strong> de <strong>{totalStudents}</strong> alunos.
            </p>
          </div>
        </div>
      </Card>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {!canExecute && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {!config.enabled
            ? 'Ative a Fase 2 na etapa anterior (coleta de afinidades) para continuar.'
            : 'Garanta afinidades coletadas para continuar.'}
        </div>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
        <Button variant="outline" onClick={onPrevious} disabled={loading}>
          Voltar
        </Button>
        <Button
          variant="primary"
          onClick={onExecute}
          disabled={!canExecute || loading}
          isLoading={loading}
          icon={<HeartHandshake className="h-4 w-4" />}
        >
          Executar Fase 2
        </Button>
      </footer>
    </div>
  );
}
