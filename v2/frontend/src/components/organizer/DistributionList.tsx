import { Plus, List, FileText, Clock, ChevronRight } from 'lucide-react';

interface Distribution {
  id: string;
  status: string;
  createdAt?: string;
  created_at?: string;
}

interface DistributionListProps {
  distributions: Distribution[];
  loading?: boolean;
  listLoading?: boolean;
  createLoading?: boolean;
  onCreate: () => void;
  onSelect: (distribution: Distribution) => void;
  onViewResults: (distribution: Distribution) => void;
  onManage: (distribution: Distribution) => void;
}

function formatCreatedAt(distribution: Distribution): string {
  const value = distribution.createdAt ?? distribution.created_at;
  if (!value) {
    return 'Data desconhecida';
  }

  return new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusLabel(status: string): string {
  switch (status) {
    case 'COMPLETED':
      return 'Fase 1 concluida';
    case 'PHASE2':
      return 'Coletando afinidades';
    case 'PHASE2_EXECUTING':
      return 'Executando Fase 2';
    case 'PHASE2_COMPLETED':
      return 'Fluxo final concluido';
    case 'PARTIAL':
      return 'Parcial';
    case 'FAILED':
      return 'Falhou';
    case 'EXECUTING':
      return 'Executando';
    case 'PENDING':
      return 'Rascunho';
    default:
      return status;
  }
}

export function DistributionList({
  distributions,
  loading = false,
  listLoading,
  createLoading,
  onCreate,
  onSelect,
  onViewResults,
  onManage,
}: DistributionListProps) {
  const isListLoading = listLoading ?? loading;
  const isCreateLoading = createLoading ?? loading;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Distribuicoes</h2>
          <p className="text-sm text-slate-600 mt-1">Comece por uma distribuicao e avance no wizard ate os resultados.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onCreate}
            disabled={isCreateLoading}
            className="inline-flex items-center rounded-xl bg-[var(--brand-600)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-700)] disabled:opacity-60"
          >
            <Plus className="h-4 w-4 mr-2" />
            {isCreateLoading ? 'Criando...' : 'Nova distribuicao'}
          </button>
        </div>
      </div>

      {distributions.length === 0 && !isListLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
            <List className="h-7 w-7 text-slate-700" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">Nenhuma distribuicao criada</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
            Crie uma distribuicao para configurar temas, coletar dados de alunos e executar a Fase 1.
          </p>
          <button
            onClick={onCreate}
            disabled={isCreateLoading}
            className="mt-6 inline-flex items-center rounded-xl bg-[var(--brand-600)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-700)] disabled:opacity-60"
          >
            <Plus className="h-4 w-4 mr-2" />
            Criar primeira distribuicao
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="divide-y divide-slate-100">
            {distributions.map((distribution) => (
              <div
                key={distribution.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(distribution)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect(distribution);
                  }
                }}
                className="group flex w-full cursor-pointer items-center justify-between gap-4 p-5 text-left transition hover:bg-slate-50"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm font-semibold text-slate-900">{distribution.id}</p>
                    <p className="mt-1 inline-flex items-center text-xs text-slate-500">
                      <Clock className="mr-1 h-3.5 w-3.5" />
                      {formatCreatedAt(distribution)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 sm:inline">
                    {statusLabel(distribution.status)}
                  </span>

                  {(distribution.status === 'COMPLETED' ||
                    distribution.status === 'PARTIAL' ||
                    distribution.status === 'PHASE2_COMPLETED') && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onViewResults(distribution);
                      }}
                      className="hidden rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 sm:inline"
                    >
                      Ver resultados
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onManage(distribution);
                    }}
                    className="rounded-lg border border-[var(--brand-300)] bg-[var(--brand-50)] px-3 py-1.5 text-xs font-semibold text-[var(--brand-700)] transition hover:bg-[var(--brand-100)]"
                  >
                    Painel
                  </button>

                  <ChevronRight className="h-4 w-4 text-slate-400 transition group-hover:text-slate-700" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

