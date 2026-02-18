/**
 * Parameters Form Section
 * Configure Phase 1 optimization parameters (wPref, wDup, wDiv)
 */

import { useMemo } from 'react';
import { Phase1Config } from '../../../types/distribution.types';
import { Button } from '../../common/Button';

const PARAMETER_INFO = {
  wPref: {
    label: 'Peso de preferencias (wPref)',
    description: 'Prioriza satisfacao das escolhas de temas',
    min: 0.1,
    max: 5.0,
    step: 0.1,
    default: 1.0,
  },
  wDup: {
    label: 'Peso de duplicatas (wDup)',
    description: 'Penaliza alunos da mesma fase no mesmo grupo',
    min: 0.1,
    max: 3.0,
    step: 0.1,
    default: 0.9,
  },
  wDiv: {
    label: 'Peso de diversidade (wDiv)',
    description: 'Incentiva mistura de fases diferentes',
    min: 0.1,
    max: 2.0,
    step: 0.1,
    default: 0.35,
  },
} as const;

const PARAMETER_PRESETS = [
  {
    name: 'Balanceado',
    description: 'Equilibrio geral',
    values: { wPref: 1.0, wDup: 0.9, wDiv: 0.35 },
  },
  {
    name: 'Preferencias',
    description: 'Foco em satisfacao',
    values: { wPref: 2.5, wDup: 0.5, wDiv: 0.2 },
  },
  {
    name: 'Diversidade',
    description: 'Foco em mistura de fases',
    values: { wPref: 0.8, wDup: 1.5, wDiv: 0.6 },
  },
];

interface ParametersFormSectionProps {
  config: Phase1Config;
  onParameterChange: (param: keyof Phase1Config, value: number) => void;
  onResetToDefaults: () => void;
}

function ParameterSlider({
  param,
  value,
  onChange,
}: {
  param: keyof Phase1Config;
  value: number;
  onChange: (value: number) => void;
}) {
  const info = PARAMETER_INFO[param];

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-semibold text-slate-800">{info.label}</label>
        <span className="font-mono text-sm font-bold text-[var(--brand-700)]">{value.toFixed(2)}</span>
      </div>

      <p className="text-xs text-slate-600">{info.description}</p>

      <input
        type="range"
        min={info.min}
        max={info.max}
        step={info.step}
        value={value}
        onChange={(event) => onChange(Number.parseFloat(event.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-[var(--brand-600)]"
      />

      <div className="flex justify-between text-[11px] text-slate-500">
        <span>{info.min}</span>
        <span>padrao {info.default}</span>
        <span>{info.max}</span>
      </div>
    </div>
  );
}

export function ParametersFormSection({
  config,
  onParameterChange,
  onResetToDefaults,
}: ParametersFormSectionProps) {
  const currentPreset = useMemo(() => {
    for (const preset of PARAMETER_PRESETS) {
      const matches = Object.keys(preset.values).every((key) => {
        const configValue = config[key as keyof Phase1Config];
        const presetValue = preset.values[key as keyof Phase1Config];
        return Math.abs(configValue - presetValue) < 0.01;
      });

      if (matches) {
        return preset.name;
      }
    }

    return 'Custom';
  }, [config]);

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-sm font-semibold text-slate-800">Presets rapidos</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {PARAMETER_PRESETS.map((preset) => (
            <Button
              key={preset.name}
              variant={currentPreset === preset.name ? 'primary' : 'outline'}
              size="sm"
              onClick={() => {
                onParameterChange('wPref', preset.values.wPref);
                onParameterChange('wDup', preset.values.wDup);
                onParameterChange('wDiv', preset.values.wDiv);
              }}
              className="h-auto justify-start py-3 text-left"
            >
              <span>
                <span className="block text-sm font-semibold">{preset.name}</span>
                <span className="block text-xs opacity-80">{preset.description}</span>
              </span>
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <ParameterSlider param="wPref" value={config.wPref} onChange={(value) => onParameterChange('wPref', value)} />
        <ParameterSlider param="wDup" value={config.wDup} onChange={(value) => onParameterChange('wDup', value)} />
        <ParameterSlider param="wDiv" value={config.wDiv} onChange={(value) => onParameterChange('wDiv', value)} />
      </div>

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={onResetToDefaults} disabled={currentPreset === 'Balanceado'}>
          Resetar para padrao
        </Button>
      </div>
    </div>
  );
}
