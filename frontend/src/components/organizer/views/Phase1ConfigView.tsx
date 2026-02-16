/**
 * Phase 1 Configuration View
 * Presentation layer for Phase 1 parameter configuration and validation
 */

import { ValidationResult, Phase1Config } from '../../../types/distribution.types';
import { Button } from '../../common/Button';
import { Card } from '../../common/Card';
import { ParametersFormSection } from '../sections/ParametersFormSection';
import { ValidationChecklistSection } from '../sections/ValidationChecklistSection';

interface Phase1ConfigViewProps {
  config: Phase1Config;
  validation: ValidationResult;
  onParameterChange: (param: keyof Phase1Config, value: number) => void;
  onResetToDefaults: () => void;
  onNext: () => void;
  onPrevious: () => void;
}

export function Phase1ConfigView({
  config,
  validation,
  onParameterChange,
  onResetToDefaults,
  onNext,
  onPrevious,
}: Phase1ConfigViewProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      <header className="space-y-2">
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Configurar Fase 1</h2>
        <p className="max-w-3xl text-sm text-slate-600">
          Ajuste os pesos do algoritmo e confirme os requisitos minimos antes de iniciar a execucao.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card title="Parametros do algoritmo" padding="lg">
          <ParametersFormSection
            config={config}
            onParameterChange={onParameterChange}
            onResetToDefaults={onResetToDefaults}
          />
        </Card>

        <Card
          title="Checklist de validacao"
          subtitle={
            validation.status === 'pass'
              ? 'Tudo pronto para executar'
              : validation.status === 'warning'
              ? 'Avisos encontrados'
              : 'Ajustes obrigatorios pendentes'
          }
          padding="lg"
        >
          <ValidationChecklistSection validation={validation} />
        </Card>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
        <Button variant="outline" onClick={onPrevious}>
          Voltar
        </Button>

        {validation.canProceed ? (
          <Button variant="primary" onClick={onNext}>
            Executar Fase 1
          </Button>
        ) : (
          <span className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            Corrija os requisitos obrigatorios para continuar
          </span>
        )}
      </footer>
    </div>
  );
}
