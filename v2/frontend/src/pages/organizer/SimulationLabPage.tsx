import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  BarChart3,
  CheckCircle,
  Clock,
  Database,
  FileText,
  FlaskConical,
  Heart,
  RefreshCw,
  Settings,
  Users,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { SimulationRunController } from '../../components/organizer/SimulationRunController';
import { SimulationNetwork3D } from '../../components/organizer/simulation3d/SimulationNetwork3D';
import { useDistribution } from '../../hooks/useDistribution';
import { useToast } from '../../hooks/useToast';
import {
  getSimulationGroups,
  getSimulationMetrics,
  getSimulationVisualState,
  getSimulationRunResult,
  openSimulationRunStream,
  startSimulationPhase1Run,
  startSimulationPhase2Run,
} from '../../services/api';
import {
  SeedConfig,
  SimulationGroupMetrics,
  SimulationMetrics,
  SimulationPoint3D,
  SimulationRun,
  SimulationRunCompleted,
  SimulationRunSnapshot,
  SimulationVisualState,
  Theme,
  VisualGroupPartition,
} from '../../types/distribution.types';

type LogLevel = 'info' | 'success' | 'error';

interface SimulationLogEntry {
  id: number;
  level: LogLevel;
  title: string;
  detail?: string;
  timestamp: string;
}

type RunPhase = 'phase1' | 'phase2';
type RunStatus = 'idle' | 'starting' | 'running' | 'completed' | 'failed';
type GroupThemeLookup = Record<
  string,
  {
    themeId?: string;
    themeName?: string;
    themeIndex?: number;
    isRealtimeFallback?: boolean;
  }
>;

const PHASE1_COMPLETE_STATUSES = new Set([
  'COMPLETED',
  'PARTIAL',
  'PHASE2',
  'PHASE2_EXECUTING',
  'PHASE2_COMPLETED',
]);

const PHASE2_COMPLETE_STATUSES = new Set(['PHASE2_COMPLETED']);

const DEFAULT_SIMULATION_SEED: SeedConfig = {
  studentCount: 80,
  generatePreferences: true,
  generateAffinities: false,
  affinityDensity: 0.13,
};

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function parseNumber(input: string, fallback: number): number {
  const parsed = Number(input);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function logStyle(level: LogLevel): string {
  switch (level) {
    case 'success':
      return 'border-emerald-200 bg-emerald-50 text-emerald-900';
    case 'error':
      return 'border-red-200 bg-red-50 text-red-900';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-900';
  }
}

function buildPartitionFromAssignment(
  assignmentByStudentId: Record<string, string | null>,
  basePartition: VisualGroupPartition
): VisualGroupPartition {
  const baseGroupById = new Map(basePartition.groups.map((group) => [group.groupId, group]));
  const grouped = new Map<string, string[]>();

  for (const [studentId, groupId] of Object.entries(assignmentByStudentId)) {
    if (!groupId) {
      continue;
    }
    const members = grouped.get(groupId) ?? [];
    members.push(studentId);
    grouped.set(groupId, members);
  }

  const groups = Array.from(grouped.entries())
    .map(([groupId, studentIds]) => {
      const base = baseGroupById.get(groupId);
      return {
        groupId,
        themeId: base?.themeId ?? '',
        themeName: base?.themeName ?? 'n/d (tempo real)',
        studentIds,
      };
    })
    .sort((a, b) => a.groupId.localeCompare(b.groupId));

  return {
    groups,
    assignmentByStudentId,
  };
}

export function SimulationLabPage() {
  const { distributionId } = useParams<{ distributionId: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const {
    currentDistribution,
    themes,
    statistics,
    phase1Config,
    phase2Config,
    loading,
    errors,
    actions,
  } = useDistribution();

  const {
    loadDistribution,
    saveThemes,
    fetchStatistics,
    generateSeed,
    generateAffinities,
    setPhase1Config,
    setPhase2Config,
  } = actions;

  const [logs, setLogs] = useState<SimulationLogEntry[]>([]);
  const [simulationMetrics, setSimulationMetrics] = useState<SimulationMetrics | null>(null);
  const [simulationGroups, setSimulationGroups] = useState<SimulationGroupMetrics[]>([]);
  const [seedConfig, setSeedConfig] = useState<SeedConfig>(DEFAULT_SIMULATION_SEED);
  const [templateThemeCount, setTemplateThemeCount] = useState(8);
  const [templateThemeProportion, setTemplateThemeProportion] = useState(1);
  const [isExecutingPhase1, setIsExecutingPhase1] = useState(false);
  const [isExecutingPhase2, setIsExecutingPhase2] = useState(false);
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [visualState, setVisualState] = useState<SimulationVisualState | null>(null);
  const [liveAssignmentByStudentId, setLiveAssignmentByStudentId] = useState<Record<string, string | null> | null>(null);
  const [runStatus, setRunStatus] = useState<RunStatus>('idle');
  const [runPhase, setRunPhase] = useState<RunPhase>('phase1');
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [runIteration, setRunIteration] = useState(0);
  const [runAcceptedSwaps, setRunAcceptedSwaps] = useState(0);
  const [runEnergy, setRunEnergy] = useState<number | null>(null);
  const [groupsVisible, setGroupsVisible] = useState(false);
  const [showAffinityEdges, setShowAffinityEdges] = useState(false);
  const [showGroupHulls, setShowGroupHulls] = useState(true);
  const [forceIntensity, setForceIntensity] = useState(1);
  const streamRef = useRef<EventSource | null>(null);

  const appendLog = useCallback((level: LogLevel, title: string, detail?: string) => {
    setLogs((previous) => [
      {
        id: Date.now() + Math.floor(Math.random() * 1000),
        level,
        title,
        detail,
        timestamp: new Date().toISOString(),
      },
      ...previous.slice(0, 59),
    ]);
  }, []);

  const updateLiveAssignmentFromPoints = useCallback(
    (points: SimulationPoint3D[]) => {
      if (!points?.length) {
        return;
      }

      setLiveAssignmentByStudentId((previous) => {
        const next: Record<string, string | null> = {};
        const knownStudentIds =
          visualState?.students.map((student) => student.id) ??
          Object.keys(previous || {});

        for (const studentId of knownStudentIds) {
          next[studentId] = previous?.[studentId] ?? null;
        }

        for (const point of points) {
          next[point.studentId] = point.groupId ? String(point.groupId) : null;
        }

        return next;
      });
    },
    [visualState?.students]
  );

  const refreshVisualization = useCallback(
    async (announce = true) => {
      if (!distributionId) {
        return;
      }

      setIsRefreshing(true);
      setSimulationError(null);
      try {
        const [_, metrics, groups, visual] = await Promise.all([
          fetchStatistics(distributionId),
          getSimulationMetrics(distributionId),
          getSimulationGroups(distributionId),
          getSimulationVisualState(distributionId),
        ]);

        setSimulationMetrics(metrics);
        setSimulationGroups(groups);
        setVisualState(visual);
        setGroupsVisible(groups.length > 0 && runStatus !== 'running' && runStatus !== 'starting');
        if (runStatus !== 'running' && runStatus !== 'starting') {
          setLiveAssignmentByStudentId(null);
        }

        if (announce) {
          appendLog('info', 'Visualizacao atualizada');
        }
      } catch (error: any) {
        const message = error?.message || 'Falha ao atualizar visualizacao';
        setSimulationError(message);
        appendLog('error', 'Erro ao atualizar painel', message);
        addToast({ type: 'error', message });
      } finally {
        setIsRefreshing(false);
      }
    },
    [distributionId, fetchStatistics, appendLog, addToast, runStatus]
  );

  useEffect(() => {
    if (!distributionId) {
      return;
    }

    let active = true;
    const bootstrap = async () => {
      try {
        if (currentDistribution?.id !== distributionId) {
          await loadDistribution(distributionId);
        }
        if (!active) {
          return;
        }
        await refreshVisualization(false);
        if (active) {
          appendLog('info', 'Area temporaria pronta', 'Use o menu lateral para rodar a simulacao');
        }
      } catch (error: any) {
        const message = error?.message || 'Falha ao carregar distribuicao';
        if (active) {
          appendLog('error', 'Erro ao abrir simulacao', message);
        }
      }
    };

    bootstrap();
    return () => {
      active = false;
    };
  }, [distributionId, currentDistribution?.id, loadDistribution, refreshVisualization, appendLog]);

  const applyThemeTemplate = async () => {
    if (!distributionId) {
      return;
    }

    const count = Math.max(1, Math.min(30, Math.floor(templateThemeCount)));
    const groupProportion = Math.max(1, Math.floor(templateThemeProportion));

    const generatedThemes: Theme[] = Array.from({ length: count }, (_, index) => ({
      name: `Tema ${index + 1}`,
      description: `Tema de simulacao ${index + 1}`,
      groupProportion,
    }));

    try {
      await saveThemes(distributionId, generatedThemes);
      appendLog('success', `Template aplicado: ${count} temas`, `Peso base: ${groupProportion} por tema`);
      addToast({ type: 'success', message: 'Temas de simulacao aplicados' });
    } catch (error: any) {
      const message = error?.message || 'Falha ao aplicar temas';
      appendLog('error', 'Erro ao aplicar template de temas', message);
      addToast({ type: 'error', message });
    }
  };

  const runSeed = async () => {
    if (!distributionId) {
      return;
    }

    try {
      await generateSeed(distributionId, seedConfig);
      await refreshVisualization(false);
      appendLog('success', 'Dados de simulacao gerados', `${seedConfig.studentCount} alunos sinteticos`);
      addToast({ type: 'success', message: 'Dados de teste gerados' });
    } catch (error: any) {
      const message = error?.message || 'Falha ao gerar seed';
      appendLog('error', 'Erro ao gerar dados de teste', message);
      addToast({ type: 'error', message });
    }
  };

  const runAffinities = async () => {
    if (!distributionId) {
      return;
    }

    const density = seedConfig.affinityDensity ?? 0.13;

    try {
      await generateAffinities(distributionId, density);
      await refreshVisualization(false);
      appendLog('success', 'Afinidades sinteticas geradas', `Densidade: ${(density * 100).toFixed(0)}%`);
      addToast({ type: 'success', message: 'Afinidades geradas' });
    } catch (error: any) {
      const message = error?.message || 'Falha ao gerar afinidades';
      appendLog('error', 'Erro ao gerar afinidades', message);
      addToast({ type: 'error', message });
    }
  };

  const resetStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.close();
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      resetStream();
    };
  }, [resetStream]);

  const applyCompletedRun = useCallback(
    async (payload: SimulationRunCompleted) => {
      const metrics = payload.phase === 'phase2' ? payload.after ?? payload.metrics : payload.metrics;
      if (metrics) {
        setSimulationMetrics(metrics);
        setSimulationGroups(metrics.groups);
      } else {
        await refreshVisualization(false);
      }

      setGroupsVisible(true);
      setLiveAssignmentByStudentId(null);
      setRunStatus('completed');
      setRunEnergy(
        payload.phase === 'phase2'
          ? (payload.after?.totals.totalEnergyPhase2 ?? payload.after?.totals.totalEnergyPhase1 ?? null)
          : (payload.metrics?.totals.totalEnergyPhase1 ?? null)
      );
      setRunAcceptedSwaps(payload.socialExecution?.swapsAccepted ?? 0);

      appendLog(
        'success',
        payload.phase === 'phase1' ? 'Run fase 1 concluido' : 'Run fase 2 concluido',
        `Tempo=${payload.executionTime}ms`
      );
      await refreshVisualization(false);
    },
    [appendLog, refreshVisualization]
  );

  const openRunStream = useCallback(
    async (run: SimulationRun) => {
      resetStream();
      setCurrentRunId(run.runId);
      setRunPhase(run.phase);
      setRunStatus('running');
      setGroupsVisible(false);
      setLiveAssignmentByStudentId(null);
      setRunIteration(0);
      setRunAcceptedSwaps(0);
      setRunEnergy(null);
      if (run.initialPositions?.length) {
        updateLiveAssignmentFromPoints(run.initialPositions);
      }

      const source = await openSimulationRunStream(run.runId, {
        onRunStarted: (started) => {
          if (started.initialPositions?.length) {
            updateLiveAssignmentFromPoints(started.initialPositions);
          }
          appendLog('info', `Run iniciado (${started.phase.toUpperCase()})`, started.runId);
        },
        onSnapshot: (snapshot: SimulationRunSnapshot) => {
          setRunStatus('running');
          setRunIteration(snapshot.iteration);
          setRunAcceptedSwaps(snapshot.acceptedSwaps);
          setRunEnergy(snapshot.energy);
          updateLiveAssignmentFromPoints(snapshot.positions);
        },
        onCompleted: async (completed) => {
          resetStream();
          await applyCompletedRun(completed);
        },
        onRunError: (message) => {
          resetStream();
          setRunStatus('failed');
          setSimulationError(message);
          appendLog('error', 'Erro no run ao vivo', message);
          addToast({ type: 'error', message });
        },
        onError: async () => {
          try {
            const recovered = await getSimulationRunResult(run.runId);
            if (recovered.status === 'completed' && recovered.result) {
              resetStream();
              await applyCompletedRun(recovered.result);
              return;
            }
            if (recovered.status === 'failed') {
              resetStream();
              setRunStatus('failed');
              const message = recovered.error || 'Falha na conexao do stream SSE';
              setSimulationError(message);
              appendLog('error', 'Stream SSE interrompido', message);
            }
          } catch {
            setRunStatus('failed');
            setSimulationError('Falha ao reconectar stream SSE e recuperar resultado do run.');
          }
        },
      });

      streamRef.current = source;
    },
    [addToast, appendLog, applyCompletedRun, resetStream, updateLiveAssignmentFromPoints]
  );

  const runPhase1 = async () => {
    if (!distributionId) {
      return;
    }

    setSimulationError(null);
    setIsExecutingPhase1(true);
    setRunStatus('starting');
    setRunPhase('phase1');
    try {
      const run = await startSimulationPhase1Run(distributionId, {
        wPref: phase1Config.wPref,
        wDup: phase1Config.wDup,
        wDiv: phase1Config.wDiv,
      });
      await openRunStream(run);
      addToast({ type: 'success', message: 'Run da Fase 1 iniciado' });
    } catch (error: any) {
      let message = error?.message || 'Falha na Fase 1';
      const proportionMatch = /requiredGroups=(\d+),\s*totalTarget=(\d+)/i.exec(String(message));
      if (proportionMatch) {
        message = `Inconsistencia de proporcao de temas: grupos necessarios ${proportionMatch[1]}, alvo calculado ${proportionMatch[2]}.`;
      }
      const weightMatch = /totalThemeWeight=0/i.exec(String(message));
      if (weightMatch) {
        message = 'Soma dos pesos dos temas deve ser maior que zero para executar a Fase 1 ideal.';
      }
      setSimulationError(message);
      setRunStatus('failed');
      appendLog('error', 'Erro ao iniciar run da Fase 1', message);
      addToast({ type: 'error', message });
    } finally {
      setIsExecutingPhase1(false);
    }
  };

  const runPhase2 = async () => {
    if (!distributionId) {
      return;
    }

    setSimulationError(null);
    setIsExecutingPhase2(true);
    setRunStatus('starting');
    setRunPhase('phase2');
    try {
      const run = await startSimulationPhase2Run(distributionId, {
        wSoc: phase2Config.wSoc,
        maxIterations: phase2Config.maxIterations,
        temperature: phase2Config.temperature,
      });
      await openRunStream(run);
      addToast({ type: 'success', message: 'Run da Fase 2 iniciado' });
    } catch (error: any) {
      const message = error?.message || 'Falha na Fase 2';
      setSimulationError(message);
      setRunStatus('failed');
      appendLog('error', 'Erro ao iniciar run da Fase 2', message);
      addToast({ type: 'error', message });
    } finally {
      setIsExecutingPhase2(false);
    }
  };

  const status = currentDistribution?.status ?? 'PENDING';
  const themesReady = themes.length > 0;
  const hasStudents = (statistics?.totalStudents ?? 0) >= 4;
  const hasPreferences = (statistics?.studentsWithPreferences ?? 0) > 0;
  const totalThemeWeight = themes.reduce((sum, theme) => sum + (theme.groupProportion ?? 0), 0);
  const hasValidThemeProportion = totalThemeWeight > 0;
  const phase1Done = PHASE1_COMPLETE_STATUSES.has(status) || simulationGroups.length > 0;
  const hasAffinities = (statistics?.studentsWithAffinities ?? 0) > 0;
  const phase2Done = PHASE2_COMPLETE_STATUSES.has(status);

  const stages = useMemo(
    () => [
      {
        id: 'themes',
        label: '1. Temas configurados',
        done: themesReady,
        detail: themesReady ? `${themes.length} tema(s)` : 'Aplique o template de temas no menu lateral',
      },
      {
        id: 'seed',
        label: '2. Base de alunos',
        done: hasStudents,
        detail: hasStudents ? `${statistics?.totalStudents ?? 0} alunos prontos` : 'Gere seed com pelo menos 4 alunos',
      },
      {
        id: 'phase1',
        label: '3. Fase 1 (grupos iniciais)',
        done: phase1Done && hasValidThemeProportion,
        detail: !hasValidThemeProportion
          ? 'Peso total invalido: configure temas com peso >= 1'
          : phase1Done
            ? `${simulationGroups.length} grupos gerados`
            : 'Execute a Fase 1',
      },
      {
        id: 'affinities',
        label: '4. Afinidades para fase 2',
        done: hasAffinities,
        detail: hasAffinities
          ? `${statistics?.studentsWithAffinities ?? 0} alunos com afinidades`
          : 'Gere ou colete afinidades',
      },
      {
        id: 'phase2',
        label: '5. Fase 2 (otimizacao social)',
        done: phase2Done,
        detail: phase2Done ? 'Concluida' : 'Execute a Fase 2',
      },
    ],
    [
      themesReady,
      themes.length,
      hasStudents,
      statistics?.totalStudents,
      phase1Done,
      simulationGroups.length,
      hasAffinities,
      statistics?.studentsWithAffinities,
      phase2Done,
      hasValidThemeProportion,
    ]
  );

  if (!distributionId) {
    return <ErrorAlert title="Distribuicao invalida" message="Nao foi possivel identificar a distribuicao." />;
  }

  if (loading.loadDistribution && currentDistribution?.id !== distributionId) {
    return <LoadingSpinner fullScreen message="Carregando simulacao..." />;
  }

  if (errors.loadDistribution) {
    return (
      <ErrorAlert
        title="Erro ao carregar simulacao"
        message={errors.loadDistribution}
        onRetry={() => loadDistribution(distributionId)}
      />
    );
  }

  const phaseBreakdown = Object.entries(statistics?.phaseBreakdown ?? {}).sort(
    ([phaseA], [phaseB]) => Number(phaseA) - Number(phaseB)
  );

  const isRunBusy = runStatus === 'running' || runStatus === 'starting';
  const canRunPhase1 = themesReady && hasStudents && hasPreferences && hasValidThemeProportion && !isRunBusy;
  const canRunPhase2 = phase1Done && hasAffinities && !isRunBusy;
  const effectivePartition = useMemo<VisualGroupPartition>(() => {
    if (!visualState) {
      return {
        groups: [],
        assignmentByStudentId: {},
      };
    }
    if (!liveAssignmentByStudentId) {
      return visualState.partition;
    }
    return buildPartitionFromAssignment(liveAssignmentByStudentId, visualState.partition);
  }, [visualState, liveAssignmentByStudentId]);

  const effectiveGroupThemes = useMemo<GroupThemeLookup>(() => {
    if (!visualState) {
      return {};
    }

    const themeIndexByThemeId = new Map(visualState.themes.map((theme) => [theme.id, theme.index]));
    const byGroup: GroupThemeLookup = {};

    for (const group of visualState.partition.groups) {
      byGroup[group.groupId] = {
        themeId: group.themeId,
        themeName: group.themeName,
        themeIndex: themeIndexByThemeId.get(group.themeId),
      };
    }

    for (const group of effectivePartition.groups) {
      if (!byGroup[group.groupId]) {
        byGroup[group.groupId] = {
          themeId: undefined,
          themeName: 'n/d (tempo real)',
          themeIndex: undefined,
          isRealtimeFallback: true,
        };
      }
    }

    return byGroup;
  }, [visualState, effectivePartition]);

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <aside className="space-y-5">
        <Card title="Simulacao Temporaria" subtitle="Execucao isolada sem wizard">
          <div className="space-y-3 text-sm">
            <p className="rounded-lg bg-slate-100 px-3 py-2 font-mono text-xs text-slate-700">{distributionId}</p>
            <p className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              Status atual: {status}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate(`/organizer/${distributionId}`)} icon={<FileText className="h-4 w-4" />}>
                Abrir painel
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate('/organizer')}>
                Lista
              </Button>
            </div>
          </div>
        </Card>

        <Card title="Temas de Simulacao" subtitle="Template rapido para iniciar">
          <div className="space-y-3 text-sm">
            <label className="block">
              <span className="mb-1 block font-medium text-slate-700">Quantidade de temas</span>
              <input
                type="number"
                min={1}
                max={30}
                value={templateThemeCount}
                onChange={(event) => setTemplateThemeCount(Math.max(1, Math.floor(parseNumber(event.target.value, 8))))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="mb-1 block font-medium text-slate-700">Maximo de grupos por tema</span>
                <input
                  type="number"
                  min={1}
                  value={templateThemeProportion}
                  onChange={(event) => setTemplateThemeProportion(Math.max(1, Math.floor(parseNumber(event.target.value, 1))))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
            </label>
            <Button
              variant="secondary"
              size="sm"
              isLoading={loading.saveThemes}
              onClick={applyThemeTemplate}
              icon={<FlaskConical className="h-4 w-4" />}
            >
              Aplicar template
            </Button>
            <p className="text-xs text-slate-500">Temas atuais: {themes.length}</p>
            <p className="text-xs text-slate-500">
              Peso total atual: {totalThemeWeight}
            </p>
            {!hasValidThemeProportion && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Configure pesos validos (>= 1) para todos os temas antes de executar a Fase 1 ideal.
              </p>
            )}
          </div>
        </Card>

        <Card title="Configuracoes do Algoritmo" subtitle="Parametros do sistema atual">
          <div className="space-y-3 text-sm">
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-slate-600">
                <Settings className="h-3.5 w-3.5" />
                Fase 1
              </p>
              <div className="grid grid-cols-3 gap-2">
                <label className="text-xs text-slate-600">
                  wPref
                  <input
                    type="number"
                    step="0.1"
                    value={phase1Config.wPref}
                    onChange={(event) => setPhase1Config({ wPref: parseNumber(event.target.value, phase1Config.wPref) })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5"
                  />
                </label>
                <label className="text-xs text-slate-600">
                  wDup
                  <input
                    type="number"
                    step="0.1"
                    value={phase1Config.wDup}
                    onChange={(event) => setPhase1Config({ wDup: parseNumber(event.target.value, phase1Config.wDup) })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5"
                  />
                </label>
                <label className="text-xs text-slate-600">
                  wDiv
                  <input
                    type="number"
                    step="0.1"
                    value={phase1Config.wDiv}
                    onChange={(event) => setPhase1Config({ wDiv: parseNumber(event.target.value, phase1Config.wDiv) })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5"
                  />
                </label>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-3">
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-slate-600">
                <Heart className="h-3.5 w-3.5" />
                Fase 2
              </p>
              <div className="grid grid-cols-3 gap-2">
                <label className="text-xs text-slate-600">
                  wSoc
                  <input
                    type="number"
                    step="0.1"
                    value={phase2Config.wSoc}
                    onChange={(event) => setPhase2Config({ wSoc: parseNumber(event.target.value, phase2Config.wSoc) })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5"
                  />
                </label>
                <label className="text-xs text-slate-600">
                  Iteracoes
                  <input
                    type="number"
                    step="1000"
                    value={phase2Config.maxIterations}
                    onChange={(event) =>
                      setPhase2Config({ maxIterations: Math.max(1000, Math.floor(parseNumber(event.target.value, phase2Config.maxIterations))) })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5"
                  />
                </label>
                <label className="text-xs text-slate-600">
                  Temp
                  <input
                    type="number"
                    step="0.1"
                    value={phase2Config.temperature}
                    onChange={(event) =>
                      setPhase2Config({ temperature: Math.max(0.1, parseNumber(event.target.value, phase2Config.temperature)) })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5"
                  />
                </label>
              </div>
            </div>
          </div>
        </Card>

        <Card title="Configuracao de Seed" subtitle="Dados sinteticos para simulacao">
          <div className="space-y-3 text-sm">
            <label className="block">
              <span className="mb-1 block font-medium text-slate-700">Quantidade de alunos</span>
              <input
                type="number"
                min={4}
                max={500}
                value={seedConfig.studentCount}
                onChange={(event) =>
                  setSeedConfig((previous) => ({
                    ...previous,
                    studentCount: Math.max(4, Math.floor(parseNumber(event.target.value, previous.studentCount))),
                  }))
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
              <input
                type="checkbox"
                checked={seedConfig.generatePreferences}
                onChange={(event) =>
                  setSeedConfig((previous) => ({
                    ...previous,
                    generatePreferences: event.target.checked,
                  }))
                }
              />
              <span className="text-sm text-slate-700">Gerar preferencias automaticamente</span>
            </label>

            <label className="block">
              <span className="mb-1 block font-medium text-slate-700">Densidade de afinidade (0 a 1)</span>
              <input
                type="number"
                min={0}
                max={1}
                step="0.01"
                value={seedConfig.affinityDensity ?? 0.13}
                onChange={(event) =>
                  setSeedConfig((previous) => ({
                    ...previous,
                    affinityDensity: Math.min(1, Math.max(0, parseNumber(event.target.value, previous.affinityDensity ?? 0.13))),
                  }))
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </label>
          </div>
        </Card>

        <Card title="Etapas da Simulacao" subtitle="Execucao manual por bloco">
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              isLoading={isRefreshing || loading.fetchStatistics}
              onClick={() => refreshVisualization()}
              icon={<RefreshCw className="h-4 w-4" />}
            >
              Atualizar visualizacao
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              isLoading={loading.generateSeed}
              onClick={runSeed}
              icon={<Database className="h-4 w-4" />}
            >
              Gerar seed (alunos + preferencias)
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              isLoading={loading.generateAffinities}
              onClick={runAffinities}
              icon={<Heart className="h-4 w-4" />}
            >
              Gerar afinidades
            </Button>
            <SimulationRunController
              canRunPhase1={canRunPhase1}
              canRunPhase2={canRunPhase2}
              isExecutingPhase1={isExecutingPhase1}
              isExecutingPhase2={isExecutingPhase2}
              runStatusLabel={`${runStatus.toUpperCase()} (${runPhase.toUpperCase()})`}
              runId={currentRunId ?? undefined}
              onStartPhase1={runPhase1}
              onStartPhase2={runPhase2}
            />
          </div>
        </Card>
      </aside>

      <div className="space-y-6">
        <Card
          title="Rede 3D de Leitura"
          subtitle="Camada visual desacoplada da otimizacao (somente leitura de estado)"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showAffinityEdges}
                  onChange={(event) => setShowAffinityEdges(event.target.checked)}
                />
                Arestas de afinidade
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showGroupHulls}
                  onChange={(event) => setShowGroupHulls(event.target.checked)}
                />
                Envelopes de grupo
              </label>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span>Intensidade das forcas</span>
              <input
                type="range"
                min={0.2}
                max={3}
                step={0.1}
                value={forceIntensity}
                onChange={(event) => setForceIntensity(parseFloat(event.target.value))}
                className="w-28"
              />
              <span className="font-mono">{forceIntensity.toFixed(1)}x</span>
            </div>
          </div>

          <SimulationNetwork3D
            students={visualState?.students ?? []}
            partition={effectivePartition}
            groupThemes={effectiveGroupThemes}
            affinities={visualState?.affinities ?? []}
            isolationScoreByStudentId={visualState?.isolationScoreByStudentId}
            isRunning={runStatus === 'running' || runStatus === 'starting'}
            showAffinityEdges={showAffinityEdges}
            showGroupHulls={showGroupHulls}
            forceIntensity={forceIntensity}
          />
          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              <p className="font-semibold uppercase text-slate-500">Run</p>
              <p className="mt-1 font-mono">{currentRunId ?? 'n/a'}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              <p className="font-semibold uppercase text-slate-500">Iteracao</p>
              <p className="mt-1 text-base font-bold">{runIteration}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              <p className="font-semibold uppercase text-slate-500">Swaps aceitos</p>
              <p className="mt-1 text-base font-bold">{runAcceptedSwaps}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              <p className="font-semibold uppercase text-slate-500">Energia</p>
              <p className="mt-1 text-base font-bold">{runEnergy !== null ? runEnergy.toFixed(3) : 'n/a'}</p>
            </div>
          </div>
        </Card>

        <Card
          title="Visualizacao Principal"
          subtitle="Pipeline da simulacao em execucao com calculo ideal de distribuicao"
        >
          <div className="grid gap-3">
            {stages.map((stage) => (
              <div
                key={stage.id}
                className={`flex items-start justify-between rounded-xl border px-4 py-3 ${
                  stage.done ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div>
                  <p className="font-semibold text-slate-900">{stage.label}</p>
                  <p className="mt-1 text-xs text-slate-600">{stage.detail}</p>
                </div>
                <span className="mt-0.5">
                  {stage.done ? (
                    <CheckCircle className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <Clock className="h-5 w-5 text-slate-500" />
                  )}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Indicadores Atuais" subtitle="Estado instantaneo da distribuicao">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">Alunos</p>
              <p className="mt-2 text-2xl font-extrabold text-slate-900">{statistics?.totalStudents ?? 0}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">Preferencias</p>
              <p className="mt-2 text-2xl font-extrabold text-slate-900">{statistics?.studentsWithPreferences ?? 0}</p>
              <p className="text-xs text-slate-500">{(statistics?.preferenceCompletionRate ?? 0).toFixed(1)}% de conclusao</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">Grupos</p>
              <p className="mt-2 text-2xl font-extrabold text-slate-900">{simulationMetrics?.totals.groupsCount ?? simulationGroups.length}</p>
              <p className="text-xs text-slate-500">Fase 1/2 ja executada</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">Coesao media</p>
              <p className="mt-2 text-2xl font-extrabold text-slate-900">
                {(simulationMetrics?.socialMetrics.avgCohesion ?? 0).toFixed(2)}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">Top 1</p>
              <p className="mt-2 text-2xl font-extrabold text-slate-900">
                {(simulationMetrics?.preferenceMetrics.top1 ?? 0).toFixed(1)}%
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">Top 3</p>
              <p className="mt-2 text-2xl font-extrabold text-slate-900">
                {(simulationMetrics?.preferenceMetrics.top3 ?? 0).toFixed(1)}%
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">Rank medio</p>
              <p className="mt-2 text-2xl font-extrabold text-slate-900">
                {(simulationMetrics?.preferenceMetrics.avgRank ?? 0).toFixed(2)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">Estabilidade</p>
              <p className="mt-2 text-2xl font-extrabold text-slate-900">
                {(simulationMetrics?.socialMetrics.stabilityPercent ?? 100).toFixed(1)}%
              </p>
            </div>
          </div>

          {statistics && (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Users className="h-4 w-4" />
                  Distribuicao por curso
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <span>Eletrica</span>
                    <strong>{statistics.courseBreakdown.electrical}</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <span>Mecanica</span>
                    <strong>{statistics.courseBreakdown.mechanical}</strong>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <BarChart3 className="h-4 w-4" />
                  Distribuicao por fase
                </p>
                <div className="max-h-40 space-y-2 overflow-y-auto pr-1 text-sm">
                  {phaseBreakdown.length === 0 && <p className="text-slate-500">Sem fases carregadas</p>}
                  {phaseBreakdown.map(([phase, count]) => (
                    <div key={phase} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                      <span>Fase {phase}</span>
                      <strong>{count}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Card>

        <Card title="Grupos Gerados" subtitle="Visualizacao da composicao atual">
          {groupsVisible && simulationGroups.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {simulationGroups.map((group) => (
                <div key={group.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{group.themeName || 'Sem tema'}</p>
                      <p className="text-xs text-slate-500">{group.id}</p>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
                      {group.members.length} aluno(s)
                    </span>
                  </div>

                  <div className="mb-3 space-y-2">
                    {group.members.map((member) => (
                      <div key={member.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
                        <span className="font-medium text-slate-800">{member.name}</span>
                        <span className="text-xs text-slate-500">
                          {member.course === 'ELECTRICAL' ? 'EE' : 'ME'} | Fase {member.phase} | R{member.rankPosition}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>Energia F1: {Number(group.energyPhase1).toFixed(3)}</span>
                    <span>Energia F2: {Number(group.energyPhase2 ?? group.energyPhase1).toFixed(3)}</span>
                    <span>Cohesao: {(group.socialCohesionScore ?? 0).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
              Grupos ficam ocultos durante a execucao e aparecem somente quando a fase termina.
            </div>
          )}
        </Card>

        <Card title="Log da Simulacao" subtitle="Eventos recentes da area temporaria">
          <div className="space-y-2">
            {logs.length === 0 && (
              <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                Sem eventos registrados nesta sessao.
              </p>
            )}
            {logs.map((log) => (
              <article key={log.id} className={`rounded-xl border px-3 py-2 text-sm ${logStyle(log.level)}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{log.title}</p>
                  <time className="text-xs opacity-80">{formatDateTime(log.timestamp)}</time>
                </div>
                {log.detail && <p className="mt-1 text-xs opacity-90">{log.detail}</p>}
              </article>
            ))}
          </div>
        </Card>

        {(errors.saveThemes || errors.generateSeed || errors.generateAffinities || simulationError) && (
          <Card title="Falhas recentes" subtitle="Erros retornados pela API">
            <div className="space-y-2 text-sm">
              {errors.saveThemes && (
                <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-red-800">
                  <AlertCircle className="mt-0.5 h-4 w-4" />
                  {errors.saveThemes}
                </p>
              )}
              {errors.generateSeed && (
                <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-red-800">
                  <AlertCircle className="mt-0.5 h-4 w-4" />
                  {errors.generateSeed}
                </p>
              )}
              {errors.generateAffinities && (
                <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-red-800">
                  <AlertCircle className="mt-0.5 h-4 w-4" />
                  {errors.generateAffinities}
                </p>
              )}
              {simulationError && (
                <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-red-800">
                  <AlertCircle className="mt-0.5 h-4 w-4" />
                  {simulationError}
                </p>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}


