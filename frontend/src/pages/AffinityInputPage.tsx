import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Heart, Search, User, BookOpen, Layers, Plus, Trash2, AlertTriangle, CheckCircle } from 'lucide-react';

/**
 * AffinityInputPage - Página para aluno declarar afinidades sociais (Fase 2)
 *
 * Fluxo:
 * 1. Aluno vê seu grupo atual (após Fase 1)
 * 2. Declara afinidades com membros do seu grupo (sliders -100 a +100)
 * 3. Opcionalmente busca e adiciona afinidades com alunos de outros grupos
 * 4. Salva as afinidades para Fase 2
 */
export function AffinityInputPage() {
  const { distributionId, studentId } = useParams<{ distributionId: string; studentId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Dados do aluno e grupo
  const [studentName, setStudentName] = useState('');
  const [currentGroup, setCurrentGroup] = useState<any>(null);

  // Afinidades: mapa de studentId -> valor (-100 a 100)
  const [affinities, setAffinities] = useState<Record<string, number>>({});

  // Busca de alunos adicionais
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [addedStudents, setAddedStudents] = useState<any[]>([]);

  // Carregar dados iniciais
  useEffect(() => {
    const loadData = async () => {
      if (!studentId || !distributionId) return;

      try {
        setLoading(true);
        setError('');

        // 1. Buscar dados do aluno
        const studentData = await api.getStudent(studentId);
        setStudentName(studentData.data?.name || '');

        // 2. Buscar grupo atual
        const groupData = await api.getStudentCurrentGroup(studentId);
        if (groupData.success && groupData.data) {
          setCurrentGroup(groupData.data);
          // Inicializar afinidades com membros do grupo
          const initAffinities: Record<string, number> = {};
          for (const member of groupData.data.members) {
            if (member.id !== studentId) {
              initAffinities[member.id] = 0; // Default: neutro
            }
          }
          setAffinities(initAffinities);
        } else {
          setError('Fase 1 ainda não foi executada. Volte mais tarde.');
        }
      } catch (err: any) {
        console.error('[AffinityInputPage] Error:', err);
        setError(err.response?.data?.error || 'Erro ao carregar grupo');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [studentId, distributionId]);

  const handleAffinityChange = (targetId: string, value: number) => {
    setAffinities(prev => ({ ...prev, [targetId]: Math.max(-100, Math.min(100, value)) }));
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      // Simulação: buscar alunos por nome (seria feito via API em produção)
      // Por enquanto, apenas filtramos alunos que não estão no grupo
      setSearchResults([]);
    } catch (err) {
      console.error('[Search] Error:', err);
    }
  };

  const handleAddStudent = (student: any) => {
    setAddedStudents(prev => [...prev, student]);
    setAffinities(prev => ({ ...prev, [student.id]: 0 }));
  };

  const handleRemoveStudent = (studentIdToRemove: string) => {
    setAddedStudents(prev => prev.filter(s => s.id !== studentIdToRemove));
    setAffinities(prev => {
      const newAffinities = { ...prev };
      delete newAffinities[studentIdToRemove];
      return newAffinities;
    });
  };

  const handleSkip = () => {
    navigate(`/distributions/${distributionId}`);
  };

  const handleSaveAffinities = async () => {
    if (!studentId) return;

    try {
      setSubmitting(true);
      setError('');

      // Converter affinities para formato de API
      const affinitiesArray = Object.entries(affinities)
        .filter(([_, value]) => value !== 0) // Apenas enviar affinidades não-nulas
        .map(([targetId, value]) => ({ targetStudentId: targetId, value }));

      const response = await api.submitStudentAffinities(studentId, affinitiesArray);

      if (response.success) {
        // Navegar para página de resultado ou confirmação
        navigate(`/distributions/${distributionId}`);
      } else {
        setError(response.error || 'Erro ao salvar afinidades');
      }
    } catch (err: any) {
      console.error('[Submit] Error:', err);
      setError(err.response?.data?.error || 'Erro ao salvar afinidades');
    } finally {
      setSubmitting(false);
    }
  };

  const getAffinityColor = (value: number): string => {
    if (value > 30) return 'text-green-600';
    if (value > 0) return 'text-green-500';
    if (value < -30) return 'text-red-600';
    if (value < 0) return 'text-red-500';
    return 'text-slate-500';
  };

  const getAffinityLabel = (value: number): string => {
    if (value > 50) return '❤️ Excelente';
    if (value > 25) return '👍 Bom';
    if (value > 0) return '😊 Positivo';
    if (value === 0) return '➖ Neutro';
    if (value > -25) return '😕 Negativo';
    if (value > -50) return '👎 Ruim';
    return '⚠️ Conflito';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center py-12 px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Carregando seu grupo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="mx-auto h-12 w-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <Heart className="h-6 w-6 text-red-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Afinidades Sociais</h1>
          <p className="mt-2 text-slate-600">
            Declare como você se sente trabalhando com cada colega (opcional)
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start text-red-700">
            <AlertTriangle className="h-5 w-5 mr-3 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Erro</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Grupo Atual */}
        {currentGroup && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 mb-8">
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center">
              👥 Seu Grupo Atual
            </h2>

            {/* Tema */}
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs font-semibold text-blue-600 uppercase mb-1">Tema</p>
              <p className="text-lg font-bold text-slate-900">{currentGroup.themeName}</p>
            </div>

            {/* Membros do Grupo */}
            <div className="space-y-6">
              {currentGroup.members.map((member: any) => {
                const affinityValue = affinities[member.id] || 0;
                const isYou = member.id === studentId;

                if (isYou) return null; // Não mostrar afinidade consigo mesmo

                return (
                  <div key={member.id} className="border border-slate-200 rounded-lg p-5 hover:border-blue-300 transition-colors">
                    {/* Identificação do membro */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-bold text-sm mr-3">
                          {member.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{member.name}</p>
                          <p className="text-sm text-slate-500">
                            {member.course} • Fase {member.phase}
                          </p>
                        </div>
                      </div>
                      <span className={`text-sm font-semibold ${getAffinityColor(affinityValue)}`}>
                        {getAffinityLabel(affinityValue)}
                      </span>
                    </div>

                    {/* Slider */}
                    <div className="space-y-3">
                      <input
                        type="range"
                        min="-100"
                        max="100"
                        value={affinityValue}
                        onChange={(e) => handleAffinityChange(member.id, parseInt(e.target.value))}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer slider"
                        style={{
                          background: affinityValue > 0
                            ? `linear-gradient(to right, #e2e8f0 0%, #e2e8f0 50%, #22c55e 50%, #22c55e 100%)`
                            : affinityValue < 0
                            ? `linear-gradient(to right, #ef4444 0%, #ef4444 ${50 + affinityValue / 2}%, #e2e8f0 ${50 + affinityValue / 2}%, #e2e8f0 100%)`
                            : '#e2e8f0'
                        }}
                      />
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-red-600 font-semibold">-100 (Conflito)</span>
                        <span className="text-slate-900 font-bold">{affinityValue}</span>
                        <span className="text-green-600 font-semibold">+100 (Excelente)</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Seção de Busca de Outros Alunos (Opcional) */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 mb-8">
          <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center">
            🔍 Alunos de Outros Grupos (Opcional)
          </h2>

          <form onSubmit={handleSearch} className="mb-6">
            <div className="flex gap-3">
              <div className="flex-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Digite o nome do aluno..."
                  className="block w-full pl-10 pr-4 py-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                Buscar
              </button>
            </div>
          </form>

          {/* Alunos Adicionados */}
          {addedStudents.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-900 text-sm">
                Adicionados ({addedStudents.length})
              </h3>
              {addedStudents.map((student: any) => {
                const affinityValue = affinities[student.id] || 0;

                return (
                  <div key={student.id} className="border border-slate-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center flex-1">
                        <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-bold text-xs mr-3">
                          {student.name.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-slate-900 text-sm">{student.name}</p>
                          <p className="text-xs text-slate-500">
                            {student.course} • Fase {student.phase}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveStudent(student.id)}
                        className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Slider compacto */}
                    <div className="space-y-2">
                      <input
                        type="range"
                        min="-100"
                        max="100"
                        value={affinityValue}
                        onChange={(e) => handleAffinityChange(student.id, parseInt(e.target.value))}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                      />
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500">{affinityValue}</span>
                        <span className={`font-semibold ${getAffinityColor(affinityValue)}`}>
                          {getAffinityLabel(affinityValue)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {addedStudents.length === 0 && (
            <p className="text-slate-500 text-sm text-center py-6">
              Nenhum aluno adicionado. Use a busca acima para adicionar.
            </p>
          )}
        </div>

        {/* Botões de Ação */}
        <div className="flex gap-4 justify-center">
          <button
            onClick={handleSkip}
            disabled={submitting}
            className="px-6 py-3 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors font-medium disabled:opacity-50"
          >
            Pular
          </button>
          <button
            onClick={handleSaveAffinities}
            disabled={submitting || !Object.values(affinities).some(v => v !== 0)}
            className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center disabled:bg-slate-300 disabled:opacity-50"
          >
            <Heart className="h-4 w-4 mr-2" />
            {submitting ? 'Salvando...' : 'Salvar Afinidades'}
          </button>
        </div>
      </div>
    </div>
  );
}
