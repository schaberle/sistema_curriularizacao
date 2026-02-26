import { Search, UserMinus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { OrganizerStudentSearchCandidate } from '../../../types/distribution.types';
import { Button } from '../../common/Button';

interface StudentRemovalSectionProps {
  onSearch: (query: string) => Promise<OrganizerStudentSearchCandidate[]>;
  onRemove: (student: OrganizerStudentSearchCandidate) => Promise<void>;
  isRemovingStudentId?: string | null;
}

function formatCourse(course: OrganizerStudentSearchCandidate['course']): string {
  return course === 'ME' ? 'Engenharia Mecanica' : 'Engenharia Eletrica';
}

export function StudentRemovalSection({
  onSearch,
  onRemove,
  isRemovingStudentId = null,
}: StudentRemovalSectionProps) {
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<OrganizerStudentSearchCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const requestCounterRef = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < 2) {
      setCandidates([]);
      setSearchError(null);
      setSearching(false);
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      const currentRequestId = ++requestCounterRef.current;
      setSearching(true);
      setSearchError(null);

      try {
        const nextCandidates = await onSearch(trimmed);
        if (requestCounterRef.current !== currentRequestId) {
          return;
        }
        setCandidates(nextCandidates);
      } catch (error: any) {
        if (requestCounterRef.current !== currentRequestId) {
          return;
        }
        setCandidates([]);
        setSearchError(error?.message || 'Nao foi possivel buscar alunos');
      } finally {
        if (requestCounterRef.current === currentRequestId) {
          setSearching(false);
        }
      }
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [onSearch, query]);

  const handleRemove = async (student: OrganizerStudentSearchCandidate) => {
    await onRemove(student);
    setCandidates((prev) => prev.filter((candidate) => candidate.id !== student.id));
  };

  const activeRemovingStudentId = isRemovingStudentId;
  const showTypeHint = query.trim().length < 2;

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Pesquise pelo nome do aluno"
          className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-200)]"
        />
      </div>

      {showTypeHint && (
        <p className="text-xs text-slate-500">
          Digite pelo menos 2 caracteres para buscar.
        </p>
      )}

      {searching && (
        <p className="text-xs text-slate-500">Buscando alunos...</p>
      )}

      {searchError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {searchError}
        </p>
      )}

      {!searching && !searchError && query.trim().length >= 2 && candidates.length === 0 && (
        <p className="text-xs text-slate-500">Nenhum aluno encontrado para esse nome.</p>
      )}

      {candidates.length > 0 && (
        <div className="space-y-2">
          {candidates.map((student) => {
            const removingCurrent = activeRemovingStudentId === student.id;
            return (
              <div
                key={student.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{student.name}</p>
                  <p className="text-xs text-slate-600">
                    {formatCourse(student.course)} - Fase {student.phase}
                  </p>
                </div>

                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleRemove(student)}
                  disabled={Boolean(activeRemovingStudentId)}
                  isLoading={removingCurrent}
                  icon={<UserMinus className="h-4 w-4" />}
                >
                  Remover
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

