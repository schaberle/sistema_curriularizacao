
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthContext } from '../context/AuthContext';
import api from '../services/api';
import { LogOut, LayoutDashboard, AlertCircle } from 'lucide-react';
import { DistributionList } from '../components/organizer/DistributionList';
import { ThemeConfiguration } from '../components/organizer/ThemeConfiguration';
import { ExecutionDashboard } from '../components/organizer/ExecutionDashboard';
import { Phase2Execution } from '../components/organizer/Phase2Execution';
import { ResultsView } from '../components/organizer/ResultsView';

/**
 * OrganizerDashboard - Painel principal do organizador
 *
 * Navegação por URL:
 *  /organizer              → lista de distribuições
 *  /organizer/:id/themes   → configurar temas
 *  /organizer/:id/execute  → aguardar alunos + executar
 *  /organizer/:id/phase2   → fase 2
 *  /organizer/:id/results  → resultados
 */
export function OrganizerDashboard() {
  const navigate = useNavigate();
  const { distributionId: paramDistId, tab } = useParams<{ distributionId?: string; tab?: string }>();
  const { logout } = useAuthContext();

  // Determinar step a partir da URL
  const currentStep = !paramDistId
    ? 'list'
    : (tab as 'themes' | 'execute' | 'phase2' | 'results') || 'themes';

  const distributionId = paramDistId || null;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Lista de distribuições
  const [distributions, setDistributions] = useState<Array<{
    id: string;
    status: string;
    created_at: string;
  }>>([]);

  const [themes, setThemes] = useState<Array<{ name: string; description: string; maxGroups: number }>>([]);
  const [newTheme, setNewTheme] = useState({ name: '', description: '', maxGroups: 3 });
  const [executionReport, setExecutionReport] = useState<string | null>(null);

  // Fase 2 - Otimização Social
  const [phase2Enabled, setPhase2Enabled] = useState(false);
  const [phase2Config, setPhase2Config] = useState({
    wSoc: 1.0,
    maxIterations: 20000,
    temperature: 0.8
  });
  const [phase2Report, setPhase2Report] = useState<string | null>(null);

  // Estatísticas e Seed
  const [statistics, setStatistics] = useState<{
    totalStudents: number;
    studentsWithPreferences: number;
    studentsWithAffinities: number;
    courseBreakdown: { course: string; count: number }[];
    phaseBreakdown: { phase: number; count: number }[];
    preferenceCompletionRate: number;
    affinityCompletionRate: number;
    phase1Executed?: boolean;
  } | null>(null);

  // Grupos formados
  const [groups, setGroups] = useState<Array<{
    id: string;
    theme: { id: string; name: string };
    members: Array<{ id: string; name: string; course: string; phase: number }>;
    memberCount: number;
  }> | null>(null);

  // ============================================================
  // HANDLERS
  // ============================================================

  const fetchDistributions = async () => {
    try {
      setLoading(true);
      const response = await api.listDistributions();
      if (response.success) {
        setDistributions(response.data.distributions);
      }
    } catch (err: any) {
      setError('Erro ao carregar distribuições');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDistribution = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.createDistribution();
      navigate(`/organizer/${response.data.distributionId}/themes`);
    } catch (err: any) {
      setError('Erro ao criar distribuição');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleAddTheme = () => {
    if (!newTheme.name) {
      setError('O nome do tema é obrigatório');
      return;
    }
    const addedTheme = { ...newTheme };
    setThemes([...themes, addedTheme]);
    // O default do próximo tema herda o maxGroups do tema recém adicionado
    setNewTheme({ name: '', description: '', maxGroups: addedTheme.maxGroups });
    setError('');
  };

  const handleRemoveTheme = (index: number) => {
    setThemes(themes.filter((_, i) => i !== index));
  };

  const handleSaveThemes = async () => {
    if (themes.length === 0) {
      setError('Adicione pelo menos um tema para prosseguir');
      return;
    }

    try {
      setLoading(true);
      setError('');
      if (distributionId) {
        await api.uploadThemes(distributionId, themes);
        navigate(`/organizer/${distributionId}/execute`);
      }
    } catch (err: any) {
      setError('Erro ao salvar temas');
    } finally {
      setLoading(false);
    }
  };

  const handleExecutePhase1 = async () => {
    if (!distributionId) return;

    try {
      setLoading(true);
      setError('');
      const response = await api.executePhase1(distributionId);

      if (response.success) {
        setExecutionReport(response.data.report);
        if (phase2Enabled) {
          navigate(`/organizer/${distributionId}/phase2`);
        } else {
          navigate(`/organizer/${distributionId}/results`);
        }
      } else {
        setError(response.message || 'Erro ao executar Fase 1');
      }
    } catch (err: any) {
      console.error('[Phase1] Error:', err);
      setError(err.response?.data?.message || 'Erro ao executar Fase 1');
    } finally {
      setLoading(false);
    }
  };

  const handleExecutePhase2 = async () => {
    if (!distributionId) return;

    try {
      setLoading(true);
      setError('');
      // Primeiro salva config
      await api.configureSocialOptimization(distributionId, {
        enabled: phase2Enabled,
        ...phase2Config
      });

      const response = await api.executePhase2(distributionId, phase2Config);

      if (response.success) {
        setPhase2Report(response.data.report);
        alert('Fase 2 executada com sucesso!');
        navigate(`/organizer/${distributionId}/results`);
      } else {
        setError(response.message || 'Erro ao executar Fase 2');
      }
    } catch (err: any) {
      console.error('[Phase2] Error:', err);
      setError(err.response?.data?.message || 'Erro ao executar Fase 2');
    } finally {
      setLoading(false);
    }
  };

  // Buscar estatísticas de alunos
  const fetchStatistics = async () => {
    if (!distributionId) return;
    try {
      const response = await api.getDistributionStatistics(distributionId);
      if (response.success) {
        setStatistics(response.data);
      }
    } catch (err) {
      console.error('Error fetching statistics:', err);
    }
  };

  const fetchGroups = async () => {
    if (!distributionId) return;
    try {
      const response = await api.getDistributionGroups(distributionId);
      if (response.success) {
        setGroups(response.data.groups);
      }
    } catch (err) {
      console.error('Error fetching groups:', err);
    }
  };

  const handleGenerateSeed = async (data: { studentCount: number; generatePreferences: boolean; affinityDensity: number }) => {
    if (!distributionId) return;
    try {
      setLoading(true);
      setError('');

      const response = await api.seedDistribution(distributionId, {
        studentCount: data.studentCount,
        generatePreferences: data.generatePreferences,
        generateAffinities: false,
        affinityDensity: 0,
      });

      if (response.success) {
        alert(
          `✅ ${response.data.message}\n\n` +
          `Alunos: ${response.data.studentsCreated}\n` +
          `Preferências: ${response.data.preferencesCreated}`
        );
        // Refresh statistics
        fetchStatistics();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao gerar dados de teste');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAffinities = async (data: { affinityDensity: number }) => {
    if (!distributionId) return;
    try {
      setLoading(true);
      setError('');

      const response = await api.seedAffinities(distributionId, {
        affinityDensity: data.affinityDensity,
      });

      if (response.success) {
        alert(`✅ ${response.data.message}`);
        fetchStatistics();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao gerar afinidades');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // EFFECTS
  // ============================================================

  // Carregar lista de distribuições quando na tela de lista
  useEffect(() => {
    if (currentStep === 'list') {
      fetchDistributions();
    }
  }, [currentStep]);

  // Auto-refresh de estatísticas a cada 10 segundos quando em step 'execute'
  useEffect(() => {
    if (currentStep === 'execute' && distributionId) {
      fetchStatistics();
      const interval = setInterval(fetchStatistics, 10000);
      return () => clearInterval(interval);
    }
  }, [currentStep, distributionId]);

  // Buscar grupos quando em step 'results'
  useEffect(() => {
    if (currentStep === 'results' && distributionId) {
      fetchGroups();
    }
  }, [currentStep, distributionId]);

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/organizer')}
                className="flex items-center"
              >
                <LayoutDashboard className="h-6 w-6 text-blue-600 mr-3" />
                <h1 className="text-xl font-bold text-slate-900">Painel do Organizador</h1>
              </button>
              {distributionId && (
                <span className="text-sm text-slate-400 font-mono hidden sm:inline">
                  / {distributionId.slice(0, 8)}...
                </span>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center px-4 py-2 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700">
            <AlertCircle className="h-5 w-5 mr-3 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* ============================================================
            TELA DE LISTA DE DISTRIBUIÇÕES
            ============================================================ */}
        {currentStep === 'list' && (
          <DistributionList
            distributions={distributions}
            loading={loading}
            onCreate={handleCreateDistribution}
            onSelect={(dist) => {
              if (dist.status === 'COMPLETED') {
                navigate(`/organizer/${dist.id}/results`);
              } else {
                navigate(`/organizer/${dist.id}/themes`);
              }
            }}
            onViewResults={(dist) => navigate(`/organizer/${dist.id}/results`)}
            onManage={(dist) => {
              if (dist.status === 'COMPLETED' || dist.status === 'PARTIAL') {
                navigate(`/organizer/${dist.id}/phase2`);
              } else {
                navigate(`/organizer/${dist.id}/execute`);
              }
            }}
          />
        )}

        {/* ============================================================
            TELA DE TEMAS
            ============================================================ */}
        {currentStep === 'themes' && distributionId && (
          <ThemeConfiguration
            distributionId={distributionId}
            themes={themes}
            newTheme={newTheme}
            setNewTheme={setNewTheme}
            loading={loading}
            onAdd={handleAddTheme}
            onRemove={handleRemoveTheme}
            onSave={handleSaveThemes}
            onBack={() => navigate('/organizer')}
          />
        )}

        {/* ============================================================
            TELA DE EXECUÇÃO (AGUARDAR ALUNOS + EXECUTAR)
            ============================================================ */}
        {currentStep === 'execute' && distributionId && (
          <ExecutionDashboard
            distributionId={distributionId}
            statistics={statistics}
            loading={loading}
            phase2Enabled={phase2Enabled}
            phase2Config={phase2Config}
            setPhase2Enabled={setPhase2Enabled}
            setPhase2Config={setPhase2Config}
            onRefreshStats={fetchStatistics}
            onExecutePhase1={handleExecutePhase1}
            onExecutePhase2={handleExecutePhase2}
            onGenerateSeed={handleGenerateSeed}
            onGenerateAffinities={handleGenerateAffinities}
            onBack={() => navigate(`/organizer/${distributionId}/themes`)}
            onViewResults={() => navigate(`/organizer/${distributionId}/results`)}
          />
        )}

        {/* ============================================================
            TELA DA FASE 2
            ============================================================ */}
        {currentStep === 'phase2' && distributionId && (
          <Phase2Execution
            distributionId={distributionId}
            config={phase2Config}
            setConfig={setPhase2Config}
            loading={loading}
            onExecute={handleExecutePhase2}
            onBack={() => navigate(`/organizer/${distributionId}/execute`)}
            onViewResults={() => navigate(`/organizer/${distributionId}/results`)}
          />
        )}

        {/* ============================================================
            TELA DE RESULTADOS
            ============================================================ */}
        {currentStep === 'results' && distributionId && (
          <ResultsView
            report={executionReport || phase2Report}
            groups={groups}
            onBack={() => navigate(`/organizer/${distributionId}/execute`)}
            onPhase2={() => navigate(`/organizer/${distributionId}/phase2`)}
            onList={() => navigate('/organizer')}
          />
        )}
      </main>
    </div>
  );
}
