import { ArrowLeft, Heart, Settings, Users } from 'lucide-react';

interface Phase2Config {
  wSoc: number;
  maxIterations: number;
  temperature: number;
}

interface Phase2ExecutionProps {
  distributionId: string;
  config: Phase2Config;
  setConfig: (config: Phase2Config) => void;
  loading: boolean;
  onExecute: () => void;
  onBack: () => void;
  onViewResults: () => void;
}

export function Phase2Execution({
  distributionId,
  config,
  setConfig,
  loading,
  onExecute,
  onBack,
  onViewResults,
}: Phase2ExecutionProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm animate-fade-in">
      <header className="border-b border-slate-100 bg-slate-50 px-6 py-4">
        <h2 className="text-lg font-extrabold tracking-tight text-slate-900">Fase 2: Otimizacao social (legado)</h2>
        <p className="mt-1 text-xs font-mono text-slate-500">{distributionId}</p>
      </header>

      <div className="space-y-6 p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          A Fase 2 segue temporariamente no fluxo legado. Configure os parametros e execute para ajustar coesao social.
        </div>

        <section className="space-y-4">
          <h3 className="flex items-center text-sm font-semibold uppercase tracking-wide text-slate-700">
            <Settings className="mr-2 h-4 w-4" />
            Parametros
          </h3>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Peso social (wSoc)</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="5.0"
                value={config.wSoc}
                onChange={(event) => setConfig({ ...config, wSoc: Number.parseFloat(event.target.value) || 1.0 })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Iteracoes</label>
              <input
                type="number"
                step="1000"
                min="5000"
                max="50000"
                value={config.maxIterations}
                onChange={(event) => setConfig({ ...config, maxIterations: Number.parseInt(event.target.value, 10) || 20000 })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Temperatura</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="2.0"
                value={config.temperature}
                onChange={(event) => setConfig({ ...config, temperature: Number.parseFloat(event.target.value) || 0.8 })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
          <button
            onClick={onBack}
            className="inline-flex items-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </button>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={onViewResults}
              className="inline-flex items-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <Users className="mr-2 h-4 w-4" />
              Ver resultados
            </button>

            <button
              onClick={onExecute}
              disabled={loading}
              className="inline-flex items-center rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
            >
              <Heart className="mr-2 h-4 w-4" />
              {loading ? 'Executando...' : 'Executar Fase 2'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
