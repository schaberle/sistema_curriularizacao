
import { useState } from 'react';
import {
    Copy, CheckCircle, BarChart3, RefreshCw, Users, Heart, AlertCircle,
    Database, Zap, Play, ArrowLeft, Settings
} from 'lucide-react';

interface Statistics {
    totalStudents: number;
    studentsWithPreferences: number;
    studentsWithAffinities: number;
    courseBreakdown: { course: string; count: number }[];
    phaseBreakdown: { phase: number; count: number }[];
    preferenceCompletionRate: number;
    affinityCompletionRate: number;
    phase1Executed?: boolean;
}

interface Phase2Config {
    wSoc: number;
    maxIterations: number;
    temperature: number;
}

interface ExecutionDashboardProps {
    distributionId: string;
    statistics: Statistics | null;
    loading: boolean;
    phase2Enabled: boolean;
    phase2Config: Phase2Config;
    setPhase2Enabled: (enabled: boolean) => void;
    setPhase2Config: (config: Phase2Config) => void;
    onRefreshStats: () => void;
    onExecutePhase1: () => void;
    onExecutePhase2: () => void;
    onGenerateSeed: (data: { studentCount: number; generatePreferences: boolean; affinityDensity: number }) => Promise<void>;
    onGenerateAffinities: (data: { affinityDensity: number }) => Promise<void>;
    onBack: () => void;
    onViewResults: () => void;
}

export function ExecutionDashboard({
    distributionId,
    statistics,
    loading,
    phase2Enabled,
    phase2Config,
    setPhase2Enabled,
    setPhase2Config,
    onRefreshStats,
    onExecutePhase1,
    onExecutePhase2,
    onGenerateSeed,
    onGenerateAffinities,
    onBack,
    onViewResults
}: ExecutionDashboardProps) {
    const [linkCopied, setLinkCopied] = useState(false);

    // Seed form state
    const [seedStudentCount, setSeedStudentCount] = useState(133);
    const [seedGenPrefs, setSeedGenPrefs] = useState(true);
    const [seedAffinityDensity, setSeedAffinityDensity] = useState(0.13);

    const handleCopyStudentLink = () => {
        const link = `${window.location.origin}/student/form/${distributionId}`;
        navigator.clipboard.writeText(link).then(() => {
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 3000);
        });
    };

    return (
        <div className="space-y-8">
            {/* Link para alunos */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 bg-blue-50 flex items-center justify-between">
                    <h2 className="text-lg font-medium text-blue-900 flex items-center">
                        <Copy className="h-5 w-5 mr-2" />
                        Link do Formulário para Alunos
                    </h2>
                </div>
                <div className="p-6">
                    <p className="text-sm text-slate-600 mb-4">
                        Compartilhe este link com os alunos para que eles preencham o formulário de preferências.
                    </p>
                    <div className="flex items-center gap-3">
                        <input
                            type="text"
                            readOnly
                            value={`${window.location.origin}/student/form/${distributionId}`}
                            className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-md text-sm text-slate-700 font-mono"
                        />
                        <button
                            onClick={handleCopyStudentLink}
                            className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm transition-colors ${linkCopied
                                ? 'bg-green-600 text-white'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                                }`}
                        >
                            {linkCopied ? (
                                <>
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Copiado!
                                </>
                            ) : (
                                <>
                                    <Copy className="h-4 w-4 mr-2" />
                                    Copiar Link
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Estatísticas de Respostas */}
            {statistics && (
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                        <h2 className="text-lg font-medium text-slate-900 flex items-center">
                            <BarChart3 className="h-5 w-5 mr-2 text-blue-600" />
                            Estatísticas de Respostas
                        </h2>
                        <button
                            onClick={onRefreshStats}
                            className="text-sm text-blue-600 hover:text-blue-700 flex items-center"
                        >
                            <RefreshCw className="h-4 w-4 mr-1" />
                            Atualizar
                        </button>
                    </div>
                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                            {/* Total Students */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-blue-900">Total de Alunos</span>
                                    <Users className="h-5 w-5 text-blue-600" />
                                </div>
                                <p className="text-3xl font-bold text-blue-900">{statistics.totalStudents}</p>
                            </div>

                            {/* Preferences Completion */}
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-green-900">Com Preferências</span>
                                    <CheckCircle className="h-5 w-5 text-green-600" />
                                </div>
                                <p className="text-3xl font-bold text-green-900">{statistics.studentsWithPreferences}</p>
                                <p className="text-xs text-green-700 mt-1">
                                    {statistics.preferenceCompletionRate.toFixed(1)}% concluído
                                </p>
                                <div className="w-full bg-green-200 rounded-full h-2 mt-2">
                                    <div
                                        className="bg-green-600 h-2 rounded-full transition-all"
                                        style={{ width: `${statistics.preferenceCompletionRate}%` }}
                                    />
                                </div>
                            </div>

                            {/* Affinities Completion */}
                            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-purple-900">Com Afinidades (Fase 2)</span>
                                    <Heart className="h-5 w-5 text-purple-600" />
                                </div>
                                <p className="text-3xl font-bold text-purple-900">{statistics.studentsWithAffinities}</p>
                                <p className="text-xs text-purple-700 mt-1">
                                    {statistics.affinityCompletionRate.toFixed(1)}% concluído
                                </p>
                                <div className="w-full bg-purple-200 rounded-full h-2 mt-2">
                                    <div
                                        className="bg-purple-600 h-2 rounded-full transition-all"
                                        style={{ width: `${statistics.affinityCompletionRate}%` }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Course Breakdown */}
                            <div>
                                <h3 className="text-sm font-semibold text-slate-700 mb-3">Distribuição por Curso</h3>
                                <div className="space-y-2">
                                    {statistics.courseBreakdown.map(({ course, count }) => (
                                        <div key={course} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                            <span className="text-sm font-medium text-slate-700">
                                                {course === 'ME' ? 'Mecânica' : 'Elétrica'}
                                            </span>
                                            <span className="text-sm font-bold text-slate-900">{count} alunos</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Phase Breakdown */}
                            <div>
                                <h3 className="text-sm font-semibold text-slate-700 mb-3">Distribuição por Fase</h3>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {statistics.phaseBreakdown.map(({ phase, count }) => (
                                        <div key={phase} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                            <span className="text-sm font-medium text-slate-700">Fase {phase}</span>
                                            <span className="text-sm font-bold text-slate-900">{count} alunos</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Warnings */}
                        {statistics.totalStudents < 4 && (
                            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start">
                                <AlertCircle className="h-5 w-5 text-amber-600 mr-3 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm text-amber-800">
                                        <strong>Aviso:</strong> Número insuficiente de alunos para formar grupos.
                                        São necessários pelo menos 4 alunos.
                                    </p>
                                </div>
                            </div>
                        )}

                        {statistics.preferenceCompletionRate < 80 && statistics.totalStudents >= 4 && (
                            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start">
                                <AlertCircle className="h-5 w-5 text-blue-600 mr-3 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm text-blue-800">
                                        <strong>Dica:</strong> Menos de 80% dos alunos completaram suas preferências.
                                        Considere aguardar mais respostas antes de executar o algoritmo.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Dados de Teste (Seed) */}
            <div className="bg-amber-50 rounded-lg border-2 border-dashed border-amber-300 overflow-hidden">
                <div className="px-6 py-4 bg-amber-100 flex items-center justify-between">
                    <h2 className="text-lg font-medium text-amber-900 flex items-center">
                        <Database className="h-5 w-5 mr-2" />
                        Dados de Teste (Opcional)
                    </h2>
                    <span className="text-xs bg-amber-200 text-amber-800 px-2 py-1 rounded-full font-semibold">
                        SIMULAÇÃO
                    </span>
                </div>
                <div className="p-6">
                    <p className="text-sm text-amber-800 mb-4">
                        Gere dados de teste automaticamente para simular o algoritmo sem cadastro manual.
                    </p>
                    <div className="mb-4">
                        <label className="block text-xs font-medium text-amber-900 mb-1">
                            Número de Alunos
                        </label>
                        <input
                            type="number"
                            value={seedStudentCount}
                            onChange={(e) => setSeedStudentCount(parseInt(e.target.value) || 0)}
                            min={4}
                            max={500}
                            className="w-full max-w-xs px-3 py-2 border border-amber-300 rounded-md focus:ring-amber-500 focus:border-amber-500 text-sm"
                        />
                        <p className="text-xs text-amber-700 mt-1">Padrão: 133 (ME: 77, EE: 56)</p>
                    </div>
                    <div className="space-y-2 mb-4">
                        <label className="flex items-center">
                            <input
                                type="checkbox"
                                checked={seedGenPrefs}
                                onChange={(e) => setSeedGenPrefs(e.target.checked)}
                                className="mr-2"
                            />
                            <span className="text-sm text-amber-900">Gerar preferências de temas</span>
                        </label>
                    </div>
                    <button
                        onClick={() => onGenerateSeed({
                            studentCount: seedStudentCount,
                            generatePreferences: seedGenPrefs,
                            affinityDensity: 0
                        })}
                        disabled={loading}
                        className="w-full max-w-xs inline-flex justify-center items-center px-4 py-2 border border-amber-600 text-sm font-medium rounded-md shadow-sm text-amber-900 bg-amber-200 hover:bg-amber-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:bg-amber-100 transition-colors"
                    >
                        <Zap className="h-4 w-4 mr-2" />
                        {loading ? 'Gerando...' : 'Gerar Dados de Teste'}
                    </button>
                </div>
            </div>

            {/* Fase 1 */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                    <h2 className="text-lg font-medium text-slate-900 flex items-center">
                        <div className="bg-blue-600 text-white rounded-full h-6 w-6 flex items-center justify-center text-xs mr-3">2</div>
                        Fase 1: Execução do Algoritmo
                    </h2>
                </div>
                <div className="p-8 text-center max-w-2xl mx-auto">
                    {loading ? (
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

                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={onExecutePhase1}
                                    className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                                >
                                    <Play className="h-5 w-5 mr-2" />
                                    {statistics?.phase1Executed ? 'Reexecutar Fase 1' : 'Executar Fase 1'}
                                </button>

                                {statistics?.phase1Executed && (
                                    <button
                                        onClick={onViewResults}
                                        className="inline-flex items-center justify-center px-6 py-3 border border-blue-300 text-base font-medium rounded-lg shadow-sm text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                                    >
                                        <Users className="h-5 w-5 mr-2" />
                                        Ver Grupos Gerados
                                    </button>
                                )}
                            </div>
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

                        {/* Estatísticas de Afinidade */}
                        <div className="bg-white rounded-lg border border-slate-200 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div className="flex items-center">
                                <div className={`p-3 rounded-full mr-4 ${(statistics?.affinityCompletionRate || 0) > 0 ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                    <Users className="h-6 w-6" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-slate-500">Afinidades Coletadas</p>
                                    <h3 className="text-2xl font-bold text-slate-900">
                                        {statistics?.studentsWithAffinities || 0}
                                        <span className="text-sm font-normal text-slate-500 ml-2">
                                            / {statistics?.totalStudents || 0} alunos
                                        </span>
                                    </h3>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="text-right">
                                    <p className="text-sm font-medium text-slate-500">Taxa de Resposta</p>
                                    <p className={`text-lg font-bold ${(statistics?.affinityCompletionRate || 0) > 20 ? 'text-green-600' : 'text-amber-600'
                                        }`}>
                                        {(statistics?.affinityCompletionRate || 0).toFixed(1)}%
                                    </p>
                                </div>
                                <button
                                    onClick={onExecutePhase2}
                                    disabled={loading || !phase2Enabled || (statistics?.studentsWithAffinities || 0) === 0}
                                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-slate-300 disabled:cursor-not-allowed"
                                >
                                    <Play className="h-4 w-4 mr-2" />
                                    Executar Otimização Social
                                </button>
                            </div>
                        </div>

                        {/* Simulação de Afinidades (Dados de Teste) */}
                        <div className="bg-amber-50 rounded-lg border-2 border-dashed border-amber-300 overflow-hidden">
                            <div className="px-6 py-4 bg-amber-100 flex items-center justify-between">
                                <h2 className="text-sm font-medium text-amber-900 flex items-center">
                                    <Database className="h-4 w-4 mr-2" />
                                    Simular Afinidades (Dados de Teste)
                                </h2>
                            </div>
                            <div className="p-6">
                                <p className="text-sm text-amber-800 mb-4">
                                    Gere afinidades aleatórias para os alunos existentes. Útil para testar a Fase 2.
                                </p>
                                <div className="flex items-end gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-amber-900 mb-1">
                                            Densidade (0.0 a 1.0)
                                        </label>
                                        <input
                                            type="number"
                                            value={seedAffinityDensity}
                                            onChange={(e) => setSeedAffinityDensity(parseFloat(e.target.value) || 0.13)}
                                            step="0.01"
                                            min="0.01"
                                            max="1.0"
                                            className="w-32 px-3 py-2 border border-amber-300 rounded-md focus:ring-amber-500 focus:border-amber-500 text-sm"
                                        />
                                    </div>
                                    <button
                                        onClick={() => onGenerateAffinities({ affinityDensity: seedAffinityDensity })}
                                        disabled={loading}
                                        className="inline-flex items-center px-4 py-2 border border-amber-600 text-sm font-medium rounded-md shadow-sm text-amber-900 bg-amber-200 hover:bg-amber-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:bg-amber-100 transition-colors"
                                    >
                                        <Zap className="h-4 w-4 mr-2" />
                                        {loading ? 'Gerando...' : 'Gerar Afinidades'}
                                    </button>
                                </div>
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

            {/* Navegação */}
            <div className="flex justify-between">
                <button
                    onClick={onBack}
                    className="px-4 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 transition-colors flex items-center"
                >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Voltar aos Temas
                </button>
            </div>
        </div>
    );
}
