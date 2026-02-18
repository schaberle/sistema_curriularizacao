/**
 * Data Collection View
 * Presentation layer for student data collection step
 */

import { Statistics } from '../../../types/distribution.types';
import { Card } from '../../common/Card';
import { Button } from '../../common/Button';
import { SeedDataSection } from '../sections/SeedDataSection';
import { StatisticsSection } from '../sections/StatisticsSection';
import { StudentLinkSection } from '../sections/StudentLinkSection';

interface DataCollectionViewProps {
  statistics: Statistics | null;
  distributionLink: string;
  loading: {
    fetchStatistics: boolean;
    generateSeed: boolean;
  };
  onGenerateSeed: (count: number) => Promise<void>;
  onRefreshStatistics?: () => void;
  onNext: () => void;
  onPrevious: () => void;
}

export function DataCollectionView({
  statistics,
  distributionLink,
  loading,
  onGenerateSeed,
  onRefreshStatistics,
  onNext,
  onPrevious,
}: DataCollectionViewProps) {
  const totalStudents = statistics?.totalStudents ?? 0;
  const studentsWithPreferences = statistics?.studentsWithPreferences ?? 0;
  const canProceed = totalStudents > 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="space-y-2">
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Coleta de dados</h2>
        <p className="max-w-3xl text-sm text-slate-600">
          Compartilhe o link com a turma e acompanhe o progresso em tempo real. Use dados simulados apenas quando quiser testar rapidamente.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <Card title="Link para alunos" subtitle="Copie e compartilhe" padding="lg">
            <StudentLinkSection
              distributionLink={distributionLink}
              totalStudents={totalStudents}
              studentsWithPreferences={studentsWithPreferences}
            />
          </Card>

          <Card
            title="Progresso da coleta"
            subtitle={`Atualizacao automatica • ${totalStudents} alunos`}
            padding="lg"
          >
            <StatisticsSection
              statistics={statistics}
              loading={loading.fetchStatistics}
              onRefresh={onRefreshStatistics}
            />
          </Card>
        </div>

        <div>
          <Card title="Dados de teste" subtitle="Opcional" padding="lg">
            <SeedDataSection
              onGenerateSeed={onGenerateSeed}
              loading={loading.generateSeed}
              currentStudentCount={totalStudents}
            />
          </Card>
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
        <Button variant="outline" onClick={onPrevious} disabled={loading.generateSeed || loading.fetchStatistics}>
          Voltar
        </Button>

        {canProceed ? (
          <Button variant="primary" onClick={onNext} disabled={loading.generateSeed || loading.fetchStatistics}>
            Proximo
          </Button>
        ) : (
          <span className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            Adicione pelo menos um aluno para continuar
          </span>
        )}
      </footer>
    </div>
  );
}

