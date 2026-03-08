/**
 * Phase 1 results presentation
 */

import { ArrowLeft, LayoutPanelLeft, RefreshCw, Heart, Users } from 'lucide-react';
import { Button } from '../../common/Button';
import { ManualStudentMovePanel } from '../ManualStudentMovePanel';
import { ExecutionReport, Group } from '../../../types/distribution.types';

interface Phase1ResultsViewProps {
  report: ExecutionReport | null;
  groups: Group[] | null;
  loading: boolean;
  onBack: () => void;
  onPhase2: () => void;
  onReexecute: () => void;
  onList: () => void;
  onManualMove: (sourceStudentId: string, targetStudentId: string) => Promise<void> | void;
  movingStudent?: boolean;
}

export function Phase1ResultsView({
  report,
  groups,
  loading,
  onBack,
  onPhase2,
  onReexecute,
  onList,
  onManualMove,
  movingStudent = false,
}: Phase1ResultsViewProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Resultados da Fase 1</h2>
        <p className="mt-2 text-sm text-slate-600">
          Revise os grupos gerados e siga para a Fase 2 para concluir a distribuicao.
        </p>
      </div>

      {report && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">Status</p>
            <p className={`mt-1 text-sm font-semibold ${report.feasible ? 'text-emerald-700' : 'text-amber-700'}`}>
              {report.feasible ? 'Viavel' : 'Com ressalvas'}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">Grupos</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-900">{report.groupsCreated}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">Tempo</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-900">{(report.executionTimeMs / 1000).toFixed(2)}s</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">Energia</p>
            <p className="mt-1 text-lg font-extrabold text-slate-900 font-mono">
              {report.totalEnergy === Infinity ? 'INF' : report.totalEnergy.toFixed(2)}
            </p>
          </div>
        </div>
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
            Grupos gerados
          </h3>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            {groups?.length ?? 0} grupos
          </span>
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
              Nenhum grupo encontrado. Reexecute a Fase 1 para gerar os resultados.
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
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 border border-slate-200">
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

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
        <Button variant="outline" onClick={onBack} icon={<ArrowLeft className="h-4 w-4" />}>
          Voltar
        </Button>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onList} icon={<LayoutPanelLeft className="h-4 w-4" />}>
            Voltar ao painel
          </Button>
          <Button variant="secondary" onClick={onReexecute} icon={<RefreshCw className="h-4 w-4" />}>
            Reexecutar Fase 1
          </Button>
          <Button variant="primary" onClick={onPhase2} icon={<Heart className="h-4 w-4" />}>
            Ir para Fase 2
          </Button>
        </div>
      </div>
    </div>
  );
}

