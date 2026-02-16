/**
 * Validation Checklist Section
 * Displays validation status with pass/warning/fail indicators
 */

import { AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { ValidationCheck, ValidationResult } from '../../../types/distribution.types';

interface ValidationChecklistSectionProps {
  validation: ValidationResult;
}

function iconFor(status: ValidationCheck['status']) {
  switch (status) {
    case 'pass':
      return <CheckCircle className="h-4 w-4 text-emerald-600" />;
    case 'warning':
      return <AlertCircle className="h-4 w-4 text-amber-600" />;
    default:
      return <XCircle className="h-4 w-4 text-red-600" />;
  }
}

function rowClass(status: ValidationCheck['status']) {
  if (status === 'pass') return 'border-emerald-200 bg-emerald-50';
  if (status === 'warning') return 'border-amber-200 bg-amber-50';
  return 'border-red-200 bg-red-50';
}

export function ValidationChecklistSection({ validation }: ValidationChecklistSectionProps) {
  if (validation.checks.length === 0) {
    return <p className="text-sm text-slate-500">Carregando validacao...</p>;
  }

  const criticalChecks = validation.checks.filter((item) => item.severity === 'critical');
  const recommendedChecks = validation.checks.filter((item) => item.severity === 'recommended');

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Obrigatorio</p>
        <div className="space-y-2">
          {criticalChecks.map((check) => (
            <div key={check.id} className={`rounded-lg border px-3 py-2 ${rowClass(check.status)}`}>
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                {iconFor(check.status)}
                {check.label}
              </p>
              <p className="mt-1 text-xs text-slate-700">{check.message}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Recomendado</p>
        <div className="space-y-2">
          {recommendedChecks.map((check) => (
            <div key={check.id} className={`rounded-lg border px-3 py-2 ${rowClass(check.status)}`}>
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                {iconFor(check.status)}
                {check.label}
              </p>
              <p className="mt-1 text-xs text-slate-700">{check.message}</p>
            </div>
          ))}
        </div>
      </div>

      {validation.status === 'fail' && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          Ha bloqueios obrigatorios. Ajuste os dados antes de continuar.
        </p>
      )}

      {validation.status === 'warning' && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
          Voce pode continuar, mas a qualidade da distribuicao pode ficar abaixo do ideal.
        </p>
      )}
    </div>
  );
}
