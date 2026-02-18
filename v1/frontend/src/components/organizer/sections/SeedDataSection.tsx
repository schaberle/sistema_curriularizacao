/**
 * Seed Data Section
 * Generates test/demo data for testing the distribution process
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp, Info, Zap } from 'lucide-react';
import { Button } from '../../common/Button';

interface SeedDataSectionProps {
  onGenerateSeed: (count: number) => Promise<void>;
  loading?: boolean;
  currentStudentCount?: number;
}

export function SeedDataSection({
  onGenerateSeed,
  loading = false,
  currentStudentCount = 0,
}: SeedDataSectionProps) {
  const [seedCount, setSeedCount] = useState(133);
  const [expanded, setExpanded] = useState(false);

  const handleGenerate = async () => {
    await onGenerateSeed(seedCount);
  };

  const presetCounts = [
    { label: 'Pequeno (20)', value: 20 },
    { label: 'Medio (60)', value: 60 },
    { label: 'Grande (133)', value: 133 },
  ];

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:bg-slate-100"
      >
        <div>
          <p className="text-sm font-semibold text-slate-900">Simulacao de dados</p>
          <p className="text-xs text-slate-600">Use somente para teste rapido do fluxo</p>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-slate-600" /> : <ChevronDown className="h-4 w-4 text-slate-600" />}
      </button>

      {expanded && (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4 animate-fade-in">
          <div className="flex gap-2 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p>
                <strong>Alunos atuais:</strong> {currentStudentCount}
              </p>
              <p className="mt-1">Os dados de teste sao adicionados aos registros existentes.</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {presetCounts.map((preset) => (
              <Button
                key={preset.value}
                variant={seedCount === preset.value ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setSeedCount(preset.value)}
                disabled={loading}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          <div className="space-y-2">
            <label htmlFor="customSeedCount" className="block text-sm font-medium text-slate-700">
              Quantidade customizada
            </label>
            <div className="flex gap-2">
              <input
                id="customSeedCount"
                type="number"
                min="1"
                max="500"
                value={seedCount}
                onChange={(event) => setSeedCount(Math.max(1, Number.parseInt(event.target.value, 10) || 1))}
                disabled={loading}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              />
              <Button
                variant="primary"
                isLoading={loading}
                disabled={seedCount < 1 || loading}
                onClick={handleGenerate}
                icon={<Zap className="h-4 w-4" />}
              >
                Gerar
              </Button>
            </div>
          </div>

          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Estes dados sao de simulacao e nao representam respostas reais da turma.
          </p>
        </div>
      )}
    </div>
  );
}
