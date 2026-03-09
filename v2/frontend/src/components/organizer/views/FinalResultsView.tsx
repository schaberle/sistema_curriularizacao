import { BarChart3, Download, LayoutPanelLeft, RotateCcw, Users } from 'lucide-react';
import { Button } from '../../common/Button';
import { ManualStudentMovePanel } from '../ManualStudentMovePanel';
import { ExecutionReport, Group, SocialMetrics } from '../../../types/distribution.types';
import { downloadGroupsCSV } from '../../../utils/downloadGroupsCSV';

interface FinalResultsViewProps {
  phase1Report: ExecutionReport | null;
  phase2Report: ExecutionReport | null;
  groups: Group[] | null;
  socialMetrics: SocialMetrics | null;
  loading: boolean;
  onList: () => void;
  onBackPhase1: () => void;
  onReexecutePhase2: () => void;
  onManualMove: (sourceStudentId: string, targetStudentId: string) => Promise<void> | void;
  movingStudent?: boolean;
}

export function FinalResultsView({
  phase1Report,
  phase2Report,
  groups,
  socialMetrics,
  loading,
  onList,
  onBackPhase1,
  onReexecutePhase2,
  onManualMove,
  movingStudent = false,
}: FinalResultsViewProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      <header className="space-y-2">
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Resultados finais</h2>
        <p className="max-w-3xl text-sm text-slate-600">Resumo consolidado da distribuicao apos Fase 1 e Fase 2.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Grupos</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">{groups?.length ?? 0}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Fase 1</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{phase1Report ? 'Executada' : 'Sem relatorio'}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Fase 2</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{phase2Report ? 'Executada' : 'Nao executada'}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Tempo Fase 2</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {phase2Report ? `${(phase2Report.executionTimeMs / 1000).toFixed(2)}s` : '-'}
          </p>
        </div>
      </div>

      {socialMetrics && (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
            <BarChart3 className="h-4 w-4 text-[var(--brand-600)]" />
            <h3 className="text-base font-bold text-slate-900">Metricas sociais</h3>
          </header>
          <div className="p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              {socialMetrics.groups.map((group) => (
                <div key={group.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">{group.theme}</p>
                    <span className="text-xs text-slate-600">{group.students} alunos</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{group.status}</p>
                  <p className="mt-2 font-mono text-sm text-slate-800">Coesao: {group.socialCohesionScore.toFixed(4)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <ManualStudentMovePanel
        groups={groups}
        loading={movingStudent}
        onMove={onManualMove}
      />

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="flex items-center text-base font-bold text-slate-900">
            <Users className="mr-2 h-4 w-4 text-[var(--brand-600)]" />
            Grupos finais
          </h3>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {groups?.length ?? 0} grupos
            </span>
            {groups && groups.length > 0 && (
              <Button
                variant="outline"
                icon={<Download className="h-4 w-4" />}
                onClick={() => downloadGroupsCSV(groups, 'grupos-finais.csv')}
              >
                Baixar tabela
              </Button>
            )}
          </div>
        </header>
        <div className="p-5">
          {loading && (
            <div className="space-y-3">
              <div className="h-14 animate-pulse rounded-lg bg-slate-100" />
              <div className="h-14 animate-pulse rounded-lg bg-slate-100" />
            </div>
          )}

          {!loading && (!groups || groups.length === 0) && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Nenhum grupo encontrado para esta distribuicao.
            </p>
          )}

          {!loading && groups && groups.length > 0 && (
            <div className="space-y-4">
              {groups.map((group) => (
                <article key={group.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">{group.themeName}</h4>
                      <p className="text-xs text-slate-500">{group.id}</p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                      {group.members.length} membros
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {group.members.map((member) => (
                      <div key={member.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                        <p className="font-medium text-slate-900">{member.name}</p>
                        <p className="text-xs text-slate-500">
                          {member.course === 'MECHANICAL' ? 'Mecanica' : 'Eletrica'} • Fase {member.phase}
                        </p>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
        <Button variant="outline" onClick={onBackPhase1}>
          Voltar para Fase 1
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onReexecutePhase2} icon={<RotateCcw className="h-4 w-4" />}>
            Reexecutar Fase 2
          </Button>
          <Button variant="primary" onClick={onList} icon={<LayoutPanelLeft className="h-4 w-4" />}>
            Voltar ao painel
          </Button>
        </div>
      </footer>
    </div>
  );
}
