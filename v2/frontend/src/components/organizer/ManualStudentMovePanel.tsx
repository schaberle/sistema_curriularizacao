import { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { Button } from '../common/Button';
import { Group } from '../../types/distribution.types';

interface ManualStudentMovePanelProps {
  groups: Group[] | null;
  loading?: boolean;
  onMove: (studentId: string, targetGroupId: string) => Promise<void> | void;
}

export function ManualStudentMovePanel({ groups, loading = false, onMove }: ManualStudentMovePanelProps) {
  const availableGroups = groups ?? [];
  const [sourceGroupId, setSourceGroupId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [targetGroupId, setTargetGroupId] = useState('');

  useEffect(() => {
    if (!availableGroups.length) {
      setSourceGroupId('');
      setStudentId('');
      setTargetGroupId('');
      return;
    }

    setSourceGroupId((previous) => previous || availableGroups[0].id);
  }, [availableGroups]);

  const sourceGroup = useMemo(
    () => availableGroups.find((group) => group.id === sourceGroupId) ?? null,
    [availableGroups, sourceGroupId]
  );

  useEffect(() => {
    if (!sourceGroup || sourceGroup.members.length === 0) {
      setStudentId('');
      return;
    }

    setStudentId((previous) => {
      const stillExists = sourceGroup.members.some((member) => member.id === previous);
      return stillExists ? previous : sourceGroup.members[0].id;
    });
  }, [sourceGroup]);

  const destinationGroups = useMemo(
    () => availableGroups.filter((group) => group.id !== sourceGroupId),
    [availableGroups, sourceGroupId]
  );

  useEffect(() => {
    if (!destinationGroups.length) {
      setTargetGroupId('');
      return;
    }

    setTargetGroupId((previous) => {
      const stillExists = destinationGroups.some((group) => group.id === previous);
      return stillExists ? previous : destinationGroups[0].id;
    });
  }, [destinationGroups]);

  const canSubmit = Boolean(studentId && targetGroupId && !loading);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-4 flex items-center gap-2">
        <ArrowRightLeft className="h-4 w-4 text-[var(--brand-600)]" />
        <h3 className="text-base font-bold text-slate-900">Mudanca manual de aluno</h3>
      </header>

      {!availableGroups.length ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Nenhum grupo disponivel para realizar movimentacao manual.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Grupo origem
            <select
              value={sourceGroupId}
              onChange={(event) => setSourceGroupId(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-0 focus:border-[var(--brand-500)]"
            >
              {availableGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.themeName} ({group.members.length} alunos)
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Aluno
            <select
              value={studentId}
              onChange={(event) => setStudentId(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-0 focus:border-[var(--brand-500)]"
              disabled={!sourceGroup || sourceGroup.members.length === 0}
            >
              {(sourceGroup?.members ?? []).map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Grupo destino
            <select
              value={targetGroupId}
              onChange={(event) => setTargetGroupId(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-0 focus:border-[var(--brand-500)]"
              disabled={!destinationGroups.length}
            >
              {destinationGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.themeName} ({group.members.length} alunos)
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          Apos mover, a energia e as metricas sociais sao recalculadas com base na nova composicao.
        </p>
        <Button
          variant="secondary"
          disabled={!canSubmit}
          onClick={() => onMove(studentId, targetGroupId)}
        >
          Aplicar mudanca
        </Button>
      </div>
    </section>
  );
}
