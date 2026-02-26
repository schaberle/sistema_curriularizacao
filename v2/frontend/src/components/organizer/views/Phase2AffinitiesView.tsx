import { RefreshCw } from 'lucide-react';
import { Button } from '../../common/Button';
import { Card } from '../../common/Card';
import { OrganizerStudentSearchCandidate, Statistics } from '../../../types/distribution.types';
import { StudentRemovalSection } from '../sections/StudentRemovalSection';

interface Phase2AffinitiesViewProps {
  statistics: Statistics | null;
  phase2Enabled: boolean;
  loading: {
    fetchStatistics: boolean;
  };
  onEnabledChange: (enabled: boolean) => void;
  onRefresh: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSearchStudentsToRemove: (query: string) => Promise<OrganizerStudentSearchCandidate[]>;
  onRemoveStudent: (student: OrganizerStudentSearchCandidate) => Promise<void>;
  removingStudentId?: string | null;
}

export function Phase2AffinitiesView({
  statistics,
  phase2Enabled,
  loading,
  onEnabledChange,
  onRefresh,
  onNext,
  onPrevious,
  onSearchStudentsToRemove,
  onRemoveStudent,
  removingStudentId = null,
}: Phase2AffinitiesViewProps) {
  const totalStudents = statistics?.totalStudents ?? 0;
  const studentsWithAffinities = statistics?.studentsWithAffinities ?? 0;
  const affinityRate = statistics?.affinityCompletionRate ?? 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="space-y-2">
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Coleta de afinidades</h2>
        <p className="max-w-3xl text-sm text-slate-600">
          Antes da Fase 2, confirme se os alunos preencheram afinidades sociais.
        </p>
      </header>

      <Card
        title="Status de afinidades"
        subtitle="Base para otimizacao social"
        padding="lg"
        footer={
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={loading.fetchStatistics}
              icon={<RefreshCw className="h-4 w-4" />}
            >
              Atualizar
            </Button>
          </div>
        }
      >
        <div className="mb-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Ativar Fase 2</p>
            <p className="text-xs text-slate-600">Permitir ajustes por afinidade social</p>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={phase2Enabled}
              onChange={(event) => onEnabledChange(event.target.checked)}
            />
            <span className="h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-[var(--brand-600)]" />
            <span className="absolute left-1 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-5" />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Total de alunos</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-900">{totalStudents}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Com afinidades</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-900">{studentsWithAffinities}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Taxa de resposta</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-900">{affinityRate.toFixed(1)}%</p>
          </div>
        </div>
      </Card>

      <Card
        title="Remover aluno"
        subtitle="Pesquise por nome e exclua alunos que sairam da turma"
        padding="lg"
      >
        <StudentRemovalSection
          onSearch={onSearchStudentsToRemove}
          onRemove={onRemoveStudent}
          isRemovingStudentId={removingStudentId}
        />
      </Card>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
        <Button variant="outline" onClick={onPrevious}>
          Voltar
        </Button>
        <Button variant="primary" onClick={onNext}>
          Proximo
        </Button>
      </footer>
    </div>
  );
}
