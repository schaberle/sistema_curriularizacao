/**
 * Student Link Section
 * Displays shareable link for students to join the distribution
 */

import { useRef, useState } from 'react';
import { CheckCircle, Copy, Share2 } from 'lucide-react';
import { Button } from '../../common/Button';

interface StudentLinkSectionProps {
  distributionLink: string;
  totalStudents?: number;
  studentsWithPreferences?: number;
}

export function StudentLinkSection({
  distributionLink,
  totalStudents = 0,
  studentsWithPreferences = 0,
}: StudentLinkSectionProps) {
  const [copied, setCopied] = useState(false);
  const [copyHelp, setCopyHelp] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const completionPercentage =
    totalStudents > 0 ? Math.round((studentsWithPreferences / totalStudents) * 100) : 0;

  const handleCopy = async () => {
    setCopyHelp(null);

    try {
      await navigator.clipboard.writeText(distributionLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
      return;
    } catch {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
        setCopyHelp('Seu navegador bloqueou a copia automatica. Use Ctrl+C no campo selecionado.');
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--brand-200)] bg-[var(--brand-50)] p-4">
        <div className="mb-2 flex items-end justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Respostas recebidas</span>
          <span className="text-2xl font-extrabold text-[var(--brand-700)]">
            {studentsWithPreferences}
            <span className="text-base font-semibold text-slate-500">/{totalStudents}</span>
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-white/70">
          <div className="h-2 rounded-full bg-[var(--brand-600)] transition-all" style={{ width: `${completionPercentage}%` }} />
        </div>
        <p className="mt-2 text-xs text-slate-600">{completionPercentage}% com preferencias preenchidas</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="distributionLink" className="block text-sm font-medium text-slate-700">
          Link para compartilhar
        </label>

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="distributionLink"
            ref={inputRef}
            type="text"
            value={distributionLink}
            readOnly
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-mono text-slate-700"
          />
          <Button
            variant={copied ? 'secondary' : 'primary'}
            size="sm"
            onClick={handleCopy}
            icon={copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            className="shrink-0"
          >
            {copied ? 'Copiado' : 'Copiar link'}
          </Button>
        </div>

        {copyHelp && <p className="text-xs text-amber-700">{copyHelp}</p>}
      </div>

      <div className="flex gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <Share2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
        Compartilhe este link no canal da turma e aguarde o preenchimento antes de executar a Fase 1.
      </div>
    </div>
  );
}

