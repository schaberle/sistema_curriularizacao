import { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { Button } from '../common/Button';
import { Group, GroupMember } from '../../types/distribution.types';

interface ManualStudentMovePanelProps {
  groups: Group[] | null;
  loading?: boolean;
  onMove: (sourceStudentId: string, targetStudentId: string) => Promise<void> | void;
}

interface SwapViability {
  feasible: boolean;
  reasons: string[];
}

function countElectrical(members: GroupMember[]): number {
  return members.filter((member) => member.course === 'ELECTRICAL').length;
}

function validateGroupComposition(groupLabel: string, members: GroupMember[]): string[] {
  const reasons: string[] = [];
  const size = members.length;

  if (size < 3 || size > 5) {
    reasons.push(`${groupLabel}: quantidade de alunos fora do intervalo permitido (3-5).`);
  }

  const electricalCount = countElectrical(members);
  const maxElectrical = size >= 4 ? 2 : Math.min(2, Math.max(0, size - 1));
  if (electricalCount < 1 || electricalCount > maxElectrical) {
    reasons.push(`${groupLabel}: composicao de Eletrica invalida (${electricalCount} EE).`);
  }

  const distinctPhases = new Set(members.map((member) => member.phase)).size;
  if (distinctPhases < 2) {
    reasons.push(`${groupLabel}: diversidade de fases insuficiente (minimo 2).`);
  }

  return reasons;
}

export function ManualStudentMovePanel({ groups, loading = false, onMove }: ManualStudentMovePanelProps) {
  const availableGroups = groups ?? [];
  const [sourceGroupId, setSourceGroupId] = useState('');
  const [sourceStudentId, setSourceStudentId] = useState('');
  const [targetGroupId, setTargetGroupId] = useState('');
  const [targetStudentId, setTargetStudentId] = useState('');

  useEffect(() => {
    if (!availableGroups.length) {
      setSourceGroupId('');
      setSourceStudentId('');
      setTargetGroupId('');
      setTargetStudentId('');
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
      setSourceStudentId('');
      return;
    }

    setSourceStudentId((previous) => {
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
      setTargetStudentId('');
      return;
    }

    setTargetGroupId((previous) => {
      const stillExists = destinationGroups.some((group) => group.id === previous);
      return stillExists ? previous : destinationGroups[0].id;
    });
  }, [destinationGroups]);

  const targetGroup = useMemo(
    () => destinationGroups.find((group) => group.id === targetGroupId) ?? null,
    [destinationGroups, targetGroupId]
  );

  useEffect(() => {
    if (!targetGroup || targetGroup.members.length === 0) {
      setTargetStudentId('');
      return;
    }

    setTargetStudentId((previous) => {
      const stillExists = targetGroup.members.some((member) => member.id === previous);
      return stillExists ? previous : targetGroup.members[0].id;
    });
  }, [targetGroup]);

  const swapViability = useMemo<SwapViability | null>(() => {
    if (!sourceGroup || !targetGroup || !sourceStudentId || !targetStudentId) {
      return null;
    }

    const sourceStudent = sourceGroup.members.find((member) => member.id === sourceStudentId);
    const targetStudent = targetGroup.members.find((member) => member.id === targetStudentId);

    if (!sourceStudent || !targetStudent) {
      return {
        feasible: false,
        reasons: ['Nao foi possivel identificar os alunos selecionados para troca.'],
      };
    }

    const sourceAfterSwap = sourceGroup.members
      .filter((member) => member.id !== sourceStudent.id)
      .concat(targetStudent);
    const targetAfterSwap = targetGroup.members
      .filter((member) => member.id !== targetStudent.id)
      .concat(sourceStudent);

    const reasons = [
      ...validateGroupComposition('Grupo de origem', sourceAfterSwap),
      ...validateGroupComposition('Grupo de destino', targetAfterSwap),
    ];

    return { feasible: reasons.length === 0, reasons };
  }, [sourceGroup, targetGroup, sourceStudentId, targetStudentId]);

  const canSubmit = Boolean(sourceStudentId && targetStudentId && swapViability?.feasible && !loading);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-4 flex items-center gap-2">
        <ArrowRightLeft className="h-4 w-4 text-[var(--brand-600)]" />
        <h3 className="text-base font-bold text-slate-900">Troca manual de alunos</h3>
      </header>

      {!availableGroups.length ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Nenhum grupo disponivel para realizar troca manual.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-4">
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
            Aluno origem
            <select
              value={sourceStudentId}
              onChange={(event) => setSourceStudentId(event.target.value)}
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

          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Aluno destino
            <select
              value={targetStudentId}
              onChange={(event) => setTargetStudentId(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-0 focus:border-[var(--brand-500)]"
              disabled={!targetGroup || targetGroup.members.length === 0}
            >
              {(targetGroup?.members ?? []).map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs text-slate-500">
            Apos a troca, energia e metricas sociais sao recalculadas com base na nova composicao.
          </p>
          {swapViability ? (
            <p className={`text-xs ${swapViability.feasible ? 'text-emerald-700' : 'text-rose-700'}`}>
              {swapViability.feasible
                ? 'Troca viavel para as regras de composicao dos grupos.'
                : `Troca inviavel: ${swapViability.reasons[0]}`}
            </p>
          ) : (
            <p className="text-xs text-slate-500">
              Selecione os dois alunos para validar a viabilidade da troca.
            </p>
          )}
        </div>
        <Button
          variant="secondary"
          disabled={!canSubmit}
          onClick={() => onMove(sourceStudentId, targetStudentId)}
        >
          Aplicar troca
        </Button>
      </div>
    </section>
  );
}
