import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../context/AuthContext';
import api from '../services/api';
import { LogOut, Plus, Upload, Play, FileText, LayoutDashboard, ArrowLeft, ArrowRight, CheckCircle, AlertCircle, Trash2, Heart, Settings } from 'lucide-react';

/**
 * OrganizerDashboard - Painel principal do organizador
 */
export function OrganizerDashboard() {
  const navigate = useNavigate();
  const { logout } = useAuthContext();

  const [distributionId, setDistributionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'initial' | 'themes' | 'execute' | 'phase2' | 'results'>('initial');

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

  const handleCreateDistribution = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.createDistribution();
      setDistributionId(response.data.distributionId);
      setStep('themes');
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
    setThemes([...themes, newTheme]);
    setNewTheme({ name: '', description: '', maxGroups: 3 });
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
        setStep('execute');
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
        // Se Fase 2 está habilitada, ir para a tela de config
        if (phase2Enabled) {
          setStep('phase2');
        } else {
          setStep('results');
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
      const response = await api.executePhase2(distributionId, phase2Config);

      if (response.success) {
        setPhase2Report(response.data.report);
        setStep('results');
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

  const handleExecuteDistribution = handleExecutePhase1;

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <LayoutDashboard className="h-6 w-6 text-blue-600 mr-3" />
              <h1 className="text-xl font-bold text-slate-900">Painel do Organizador</h1>
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

        {step === 'initial' && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center max-w-2xl mx-auto">
            <div className="mx-auto h-16 w-16 bg-blue-50 rounded-full flex items-center justify-center mb-6">
              <Plus className="h-8 w-8 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Nova Distribuição
            </h2>
            <p className="text-slate-600 mb-8 max-w-md mx-auto">
              Inicie um novo processo de alocação de grupos. Você passará pelas etapas de configuração, upload de dados e execução do algoritmo.
            </p>
            <button
              onClick={handleCreateDistribution}
              disabled={loading}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300 transition-colors"
            >
              {loading ? 'Inicializando...' : 'Começar Nova Distribuição'}
            </button>
          </div>
        )}

        {step === 'themes' && distributionId && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h2 className="text-lg font-medium text-slate-900 flex items-center">
                <div className="bg-blue-600 text-white rounded-full h-6 w-6 flex items-center justify-center text-xs mr-3">1</div>
                Upload de Temas
              </h2>
              <span className="text-sm text-slate-500 font-mono">ID: {distributionId}</span>
            </div>
            <div className="p-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Coluna 1: Formulário de Adição manual */}
                <div>
                  <h3 className="text-md font-semibold text-slate-800 mb-4 flex items-center">
                    <Plus className="h-4 w-4 mr-2 text-blue-600" />
                    Adicionar Tema Manualmente
                  </h3>

                  <div className="space-y-4 bg-slate-50 p-6 rounded-lg border border-slate-200">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Tema</label>
                      <input
                        type="text"
                        value={newTheme.name}
                        onChange={(e) => setNewTheme({ ...newTheme, name: e.target.value })}
                        placeholder="Ex: Sustentabilidade Urbana"
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Descrição (opcional)</label>
                      <textarea
                        value={newTheme.description}
                        onChange={(e) => setNewTheme({ ...newTheme, description: e.target.value })}
                        placeholder="Breve descrição do tema..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        rows={2}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Máximo de Grupos</label>
                      <input
                        type="number"
                        value={newTheme.maxGroups}
                        onChange={(e) => setNewTheme({ ...newTheme, maxGroups: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        min="1"
                      />
                    </div>
                    <button
                      onClick={handleAddTheme}
                      className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar à Lista
                    </button>
                  </div>

                  <div className="mt-8">
                    <h3 className="text-md font-semibold text-slate-800 mb-4 flex items-center text-slate-400">
                      <Upload className="h-4 w-4 mr-2" />
                      Ou Upload de CSV (opcional)
                    </h3>
                    <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors cursor-pointer bg-slate-50">
                      <Upload className="h-6 w-6 text-slate-400 mx-auto mb-2" />
                      <p className="text-slate-700 text-sm font-medium">Upload de arquivo CSV</p>
                    </div>
                    <p className="text-xs text-amber-600 mt-2 flex items-center">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Em desenvolvimento
                    </p>
                  </div>
                </div>

                {/* Coluna 2: Lista de Temas já adicionados */}
                <div>
                  <h3 className="text-md font-semibold text-slate-800 mb-4 flex items-center">
                    <FileText className="h-4 w-4 mr-2 text-blue-600" />
                    Temas na Distribuição ({themes.length})
                  </h3>

                  {themes.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center border border-slate-200 rounded-lg bg-white text-slate-400">
                      <FileText className="h-10 w-10 mb-2 opacity-20" />
                      <p>Nenhum tema adicionado ainda</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[450px] overflow-y-auto pr-2">
                      {themes.map((theme, index) => (
                        <div key={index} className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm flex justify-between items-start group hover:border-blue-300 transition-colors">
                          <div>
                            <h4 className="font-bold text-slate-900">{theme.name}</h4>
                            {theme.description && <p className="text-sm text-slate-500 mt-1 line-clamp-1">{theme.description}</p>}
                            <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              {theme.maxGroups} grupos máx.
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveTheme(index)}
                            className="p-1 text-slate-400 hover:text-red-500 transition-colors rounded-full hover:bg-red-50"
                            title="Remover tema"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-12 pt-6 border-t border-slate-200 flex justify-end gap-3">
                <button
                  onClick={() => setStep('initial')}
                  className="px-4 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveThemes}
                  disabled={loading || themes.length === 0}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center disabled:bg-slate-300"
                >
                  {loading ? 'Salvando...' : 'Próxima Etapa'}
                  {!loading && <ArrowRight className="h-4 w-4 ml-2" />}
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 'execute' && distributionId && (
          <div className="space-y-8">
            {/* Fase 1 */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <h2 className="text-lg font-medium text-slate-900 flex items-center">
                  <div className="bg-blue-600 text-white rounded-full h-6 w-6 flex items-center justify-center text-xs mr-3">2</div>
                  Fase 1: Execução do Algoritmo
                </h2>
              </div>
              <div className="p-8 text-center max-w-2xl mx-auto">
                {loading && !phase2Report ? (
                  <div className="py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <h3 className="text-xl font-medium text-slate-900 mb-2">Executando Fase 1...</h3>
                    <p className="text-slate-600">Isso pode levar alguns segundos dependendo do número de alunos.</p>
                  </div>
                ) : (
                  <div className="mb-8">
                    <div className="h-24 w-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Play className="h-10 w-10 text-green-600 ml-1" />
                    </div>
                    <h3 className="text-xl font-medium text-slate-900 mb-2">Pronto para distribuir</h3>
                    <p className="text-slate-600 mb-6">
                      O sistema analisará as preferências dos alunos para gerar os grupos iniciais.
                    </p>

                    {!loading && (
                      <button
                        onClick={handleExecutePhase1}
                        className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                      >
                        <Play className="h-5 w-5 mr-2" />
                        Executar Fase 1
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Fase 2 - Configuração */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <h2 className="text-lg font-medium text-slate-900 flex items-center">
                  <div className="bg-red-600 text-white rounded-full h-6 w-6 flex items-center justify-center text-xs mr-3">+</div>
                  Fase 2 (Opcional): Otimização Social
                </h2>
              </div>
              <div className="p-8">
                <div className="space-y-6">
                  <div className="flex items-start p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-amber-600 mr-3 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-amber-800">
                        <strong>Dica:</strong> Habilite Fase 2 para refinar os grupos com base em afinidades sociais dos alunos.
                        Os alunos declaram suas preferências e o sistema ajusta os grupos mantendo as restrições.
                      </p>
                    </div>
                  </div>

                  {/* Toggle Fase 2 */}
                  <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                    <div className="flex items-center">
                      <Heart className="h-5 w-5 text-red-600 mr-3" />
                      <div>
                        <p className="font-semibold text-slate-900">Ativar Fase 2</p>
                        <p className="text-sm text-slate-500">Permitir otimização social após Fase 1</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={phase2Enabled}
                        onChange={(e) => setPhase2Enabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                    </label>
                  </div>

                  {phase2Enabled && (
                    <div className="space-y-4">
                      <p className="text-sm text-slate-700 font-medium">Configuração de Parâmetros:</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Peso Social */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-2">
                            Peso Social (w_soc)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            max="5.0"
                            value={phase2Config.wSoc}
                            onChange={(e) =>
                              setPhase2Config({ ...phase2Config, wSoc: parseFloat(e.target.value) || 1.0 })
                            }
                            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-red-500 focus:border-red-500 text-sm"
                          />
                          <p className="text-xs text-slate-500 mt-1">Padrão: 1.0</p>
                        </div>

                        {/* Iterações */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-2">
                            Iterações
                          </label>
                          <input
                            type="number"
                            step="1000"
                            min="5000"
                            max="50000"
                            value={phase2Config.maxIterations}
                            onChange={(e) =>
                              setPhase2Config({ ...phase2Config, maxIterations: parseInt(e.target.value) || 20000 })
                            }
                            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-red-500 focus:border-red-500 text-sm"
                          />
                          <p className="text-xs text-slate-500 mt-1">Padrão: 20000</p>
                        </div>

                        {/* Temperatura */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-2">
                            Temperatura
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            max="2.0"
                            value={phase2Config.temperature}
                            onChange={(e) =>
                              setPhase2Config({ ...phase2Config, temperature: parseFloat(e.target.value) || 0.8 })
                            }
                            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-red-500 focus:border-red-500 text-sm"
                          />
                          <p className="text-xs text-slate-500 mt-1">Padrão: 0.8</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'phase2' && distributionId && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h2 className="text-lg font-medium text-slate-900 flex items-center">
                <div className="bg-red-600 text-white rounded-full h-6 w-6 flex items-center justify-center text-xs mr-3">3</div>
                Fase 2: Otimização Social
              </h2>
            </div>
            <div className="p-8">
              <div className="space-y-8">
                {/* Introdução */}
                <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                  <div className="flex items-start">
                    <Heart className="h-6 w-6 text-red-600 mr-3 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="text-lg font-semibold text-red-900 mb-2">
                        Otimização por Afinidades Sociais
                      </h3>
                      <p className="text-red-800 text-sm">
                        Fase 1 já foi executada! Agora os alunos declaram suas afinidades sociais,
                        e o sistema pode ajustar os grupos para melhorar a coesão social.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Configuração de Parâmetros */}
                <div className="space-y-6">
                  <h3 className="font-semibold text-slate-900 flex items-center">
                    <Settings className="h-5 w-5 mr-2 text-slate-600" />
                    Configurar Parâmetros
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Peso Social */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Peso Social (w_soc)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="5.0"
                        value={phase2Config.wSoc}
                        onChange={(e) =>
                          setPhase2Config({ ...phase2Config, wSoc: parseFloat(e.target.value) || 1.0 })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-red-500 focus:border-red-500"
                      />
                      <p className="text-xs text-slate-500 mt-1">Padrão: 1.0</p>
                    </div>

                    {/* Iterações */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Iterações
                      </label>
                      <input
                        type="number"
                        step="1000"
                        min="5000"
                        max="50000"
                        value={phase2Config.maxIterations}
                        onChange={(e) =>
                          setPhase2Config({ ...phase2Config, maxIterations: parseInt(e.target.value) || 20000 })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-red-500 focus:border-red-500"
                      />
                      <p className="text-xs text-slate-500 mt-1">Padrão: 20000</p>
                    </div>

                    {/* Temperatura */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Temperatura Inicial
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="2.0"
                        value={phase2Config.temperature}
                        onChange={(e) =>
                          setPhase2Config({ ...phase2Config, temperature: parseFloat(e.target.value) || 0.8 })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-red-500 focus:border-red-500"
                      />
                      <p className="text-xs text-slate-500 mt-1">Padrão: 0.8</p>
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <p className="text-sm text-slate-700">
                    <strong>Status:</strong> Aguardando execução. Certifique-se de que os alunos já declararam suas afinidades.
                  </p>
                </div>
              </div>

              {/* Botões */}
              <div className="mt-8 pt-6 border-t border-slate-200 flex justify-end gap-3">
                <button
                  onClick={() => setStep('execute')}
                  className="px-4 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Voltar
                </button>
                <button
                  onClick={handleExecutePhase2}
                  disabled={loading}
                  className="inline-flex items-center px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-medium disabled:bg-slate-300"
                >
                  <Heart className="h-4 w-4 mr-2" />
                  {loading ? 'Executando...' : 'Executar Fase 2'}
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 'results' && executionReport && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h2 className="text-lg font-medium text-slate-900 flex items-center">
                <div className="bg-green-600 text-white rounded-full h-6 w-6 flex items-center justify-center text-xs mr-3">✓</div>
                Resultados da Distribuição
              </h2>
            </div>
            <div className="p-8">
              <div className="bg-slate-900 rounded-lg p-6 mb-8 overflow-x-auto">
                <pre className="text-green-400 font-mono text-sm whitespace-pre-wrap">
                  {executionReport}
                </pre>
              </div>

              <div className="flex justify-center">
                <button
                  onClick={() => setStep('initial')}
                  className="inline-flex items-center px-4 py-2 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar ao Início
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
