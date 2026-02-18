import {
  ArrowRight,
  AlertTriangle,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  FileText,
  Heart,
  List,
  Users,
} from 'lucide-react';
import { Button } from '../../common/Button';
import { Card } from '../../common/Card';
import { SimulationVisualState, VisualGroupPartition } from '../../../types/distribution.types';
import { OrganizerStep } from '../../../utils/distributionFlow';
import { SimulationNetwork3D } from '../simulation3d/SimulationNetwork3D';

interface StepState extends OrganizerStep {
  route: string;
  isAccessible: boolean;
  isCurrent: boolean;
  isCompleted: boolean;
  isWarning: boolean;
}

interface DistributionOverviewViewProps {
  distributionId: string;
  statusLabel: string;
  createdAtLabel: string;
  updatedAtLabel: string;
  currentStepLabel: string;
  kpis: {
    themes: number;
    students: number;
    preferenceRate: number;
    affinities: number;
    affinityRate: number;
    groups: number;
  };
  steps: StepState[];
  loading: boolean;
  canViewResults: boolean;
  visualState: SimulationVisualState | null;
  effectivePartition: VisualGroupPartition;
  effectiveGroupThemes: Record<
    string,
    {
      themeId?: string;
      themeName?: string;
      themeIndex?: number;
      isRealtimeFallback?: boolean;
    }
  >;
  visualizationLoading: boolean;
  visualizationError: string | null;
  showAffinityEdges: boolean;
  showGroupHulls: boolean;
  forceIntensity: number;
  onToggleAffinityEdges: (value: boolean) => void;
  onToggleGroupHulls: (value: boolean) => void;
  onForceIntensityChange: (value: number) => void;
  onRefreshVisualization: () => void;
  onRefresh: () => void;
  onContinue: () => void;
  onViewResults: () => void;
  onBackToList: () => void;
  onOpenStep: (route: string) => void;
}

export function DistributionOverviewView({
  distributionId,
  statusLabel,
  createdAtLabel,
  updatedAtLabel,
  currentStepLabel,
  kpis,
  steps,
  loading,
  canViewResults,
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
  onRefresh,
  onContinue,
  onViewResults,
  onBackToList,
  onOpenStep,
}: DistributionOverviewViewProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      <Card padding="lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Painel da distribuicao</p>
            <h2 className="font-mono text-lg font-bold text-slate-900">{distributionId}</h2>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">{statusLabel}</span>
              <span className="rounded-full bg-[var(--brand-50)] px-3 py-1 font-medium text-[var(--brand-700)]">
                Etapa atual: {currentStepLabel}
              </span>
            </div>
          </div>

          <div className="space-y-2 text-xs text-slate-500">
            <p className="flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5" />
              Criada em {createdAtLabel}
            </p>
            <p className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              Atualizada em {updatedAtLabel}
            </p>
            <button type="button" onClick={onRefresh} className="text-xs font-semibold text-[var(--brand-700)] hover:underline">
              {loading ? 'Atualizando...' : 'Atualizar dados'}
            </button>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card padding="md">
          <p className="text-xs text-slate-500">Temas</p>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-2xl font-extrabold text-slate-900">{kpis.themes}</p>
            <FileText className="h-5 w-5 text-[var(--brand-600)]" />
          </div>
        </Card>
        <Card padding="md">
          <p className="text-xs text-slate-500">Alunos cadastrados</p>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-2xl font-extrabold text-slate-900">{kpis.students}</p>
            <Users className="h-5 w-5 text-[var(--brand-600)]" />
          </div>
        </Card>
        <Card padding="md">
          <p className="text-xs text-slate-500">Preferencias concluidas</p>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-2xl font-extrabold text-slate-900">{kpis.preferenceRate.toFixed(1)}%</p>
            <BarChart3 className="h-5 w-5 text-[var(--brand-600)]" />
          </div>
        </Card>
        <Card padding="md">
          <p className="text-xs text-slate-500">Afinidades coletadas</p>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-2xl font-extrabold text-slate-900">{kpis.affinities}</p>
            <Heart className="h-5 w-5 text-[var(--brand-600)]" />
          </div>
        </Card>
        <Card padding="md">
          <p className="text-xs text-slate-500">Taxa de afinidades</p>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-2xl font-extrabold text-slate-900">{kpis.affinityRate.toFixed(1)}%</p>
            <Heart className="h-5 w-5 text-[var(--brand-600)]" />
          </div>
        </Card>
        <Card padding="md">
          <p className="text-xs text-slate-500">Grupos gerados</p>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-2xl font-extrabold text-slate-900">{kpis.groups}</p>
            <Users className="h-5 w-5 text-[var(--brand-600)]" />
          </div>
        </Card>
      </div>

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
          isRunning={false}
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

      <Card title="Acoes principais" subtitle="Siga o fluxo com base no status atual" padding="lg">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={onContinue} icon={<ArrowRight className="h-4 w-4" />}>
            Continuar fluxo
          </Button>
          {canViewResults && (
            <Button variant="secondary" onClick={onViewResults} icon={<BarChart3 className="h-4 w-4" />}>
              Ir para resultados
            </Button>
          )}
          <Button variant="outline" onClick={onBackToList} icon={<List className="h-4 w-4" />}>
            Voltar a lista
          </Button>
        </div>
      </Card>

      <Card title="Etapas do wizard" subtitle="Etapas concluidas e atalhos disponiveis" padding="lg">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map((step) => (
            <button
              key={step.id}
              type="button"
              onClick={() => step.isAccessible && onOpenStep(step.route)}
              disabled={!step.isAccessible}
              className={`w-full rounded-xl border p-4 text-left transition ${
                step.isCurrent
                  ? 'border-[var(--brand-300)] bg-[var(--brand-50)]'
                  : step.isWarning
                  ? 'border-amber-300 bg-amber-50 hover:border-amber-400'
                  : step.isCompleted
                  ? 'border-slate-200 bg-white hover:border-[var(--brand-300)]'
                  : 'cursor-not-allowed border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">
                  {step.id}. {step.label}
                </p>
                {step.isCompleted ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : step.isWarning ? (
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                ) : step.isCurrent ? (
                  <Circle className="h-4 w-4 text-[var(--brand-700)]" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                )}
              </div>
              <p className="mt-2 text-xs text-slate-600">
                {step.isAccessible
                  ? step.isWarning
                    ? 'Alteracao nao executada'
                    : 'Abrir etapa'
                  : 'Disponivel apos concluir etapas anteriores'}
              </p>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
