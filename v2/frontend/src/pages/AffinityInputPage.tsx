import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Heart, Plus, Search, Trash2, Users } from 'lucide-react';
import api from '../services/api';
import { StudentDistributionAccess } from '../types/student.types';

interface CandidateStudent {
  id: string;
  name: string;
  course: string;
  phase: number;
}

/**
 * AffinityInputPage - Pagina para aluno declarar afinidades sociais (Fase 2)
 */
export function AffinityInputPage() {
  const { distributionId, studentId } = useParams<{ distributionId: string; studentId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [access, setAccess] = useState<StudentDistributionAccess | null>(null);
  const [studentName, setStudentName] = useState('');
  const [currentGroup, setCurrentGroup] = useState<any>(null);

  const [affinities, setAffinities] = useState<Record<string, number>>({});
  const [existingAffinities, setExistingAffinities] = useState<Record<string, number>>({});

  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<CandidateStudent[]>([]);
  const [addedStudents, setAddedStudents] = useState<CandidateStudent[]>([]);

  useEffect(() => {
    const loadData = async () => {
      if (!studentId || !distributionId) return;

      try {
        setLoading(true);
        setError('');

        const [accessResponse, studentResponse] = await Promise.all([
          api.getStudentDistributionAccess(distributionId),
          api.getStudent(studentId),
        ]);

        const accessData = accessResponse.data as StudentDistributionAccess;
        setAccess(accessData);
        setStudentName(studentResponse.data?.name || '');

        if (!accessData.affinitiesOpen) {
          setLoading(false);
          return;
        }

        const [groupResponse, affinitiesResponse] = await Promise.all([
          api.getStudentCurrentGroup(studentId),
          api.getStudentAffinities(studentId),
        ]);

        const groupData = groupResponse.data || null;
        setCurrentGroup(groupData);

        const initialAffinities: Record<string, number> = {};
        const loadedAffinities: Record<string, number> = {};

        for (const item of affinitiesResponse.data?.affinities || []) {
          loadedAffinities[item.targetStudentId] = item.affinityValue;
        }

        setExistingAffinities(loadedAffinities);

        for (const member of groupData?.members || []) {
          if (member.id !== studentId) {
            initialAffinities[member.id] = loadedAffinities[member.id] ?? 0;
          }
        }

        setAffinities(initialAffinities);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Erro ao carregar dados de afinidade');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [studentId, distributionId]);

  const hasAnyAffinity = useMemo(() => Object.values(affinities).some((value) => value !== 0), [affinities]);

  const handleAffinityChange = (targetId: string, value: number) => {
    setAffinities((prev) => ({ ...prev, [targetId]: Math.max(-100, Math.min(100, value)) }));
  };

  const executeCandidateSearch = async (query: string) => {
    if (!studentId) return;
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setSearchLoading(true);
      const response = await api.searchAffinityCandidates(studentId, query);
      const results = (response.data?.candidates || []) as CandidateStudent[];
      setSearchResults(results);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao buscar alunos');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    await executeCandidateSearch(searchQuery.trim());
  };

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void executeCandidateSearch(query);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [searchQuery, studentId]);

  const handleAddStudent = (student: CandidateStudent) => {
    if (addedStudents.some((item) => item.id === student.id)) {
      return;
    }

    setAddedStudents((prev) => [...prev, student]);
    setAffinities((prev) => ({
      ...prev,
      [student.id]: prev[student.id] ?? existingAffinities[student.id] ?? 0,
    }));
  };

  const handleRemoveStudent = (targetId: string) => {
    setAddedStudents((prev) => prev.filter((student) => student.id !== targetId));
    setAffinities((prev) => {
      const next = { ...prev };
      delete next[targetId];
      return next;
    });
  };

  const handleSaveAffinities = async () => {
    if (!studentId) return;

    try {
      setSubmitting(true);
      setError('');

      const payload = Object.entries(affinities)
        .filter(([_, value]) => value !== 0)
        .map(([targetStudentId, value]) => ({ targetStudentId, value }));

      await api.submitStudentAffinities(studentId, payload);
      navigate(`/student/result/${distributionId}`);
    } catch (err: any) {
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
    if (value > 50) return 'Excelente';
    if (value > 20) return 'Positivo';
    if (value > 0) return 'Levemente positivo';
    if (value === 0) return 'Neutro';
    if (value > -20) return 'Levemente negativo';
    if (value > -50) return 'Negativo';
    return 'Conflito';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center py-12 px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Carregando dados de afinidade...</p>
        </div>
      </div>
    );
  }

  if (access && !access.affinitiesOpen) {
    return (
      <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
        <div className="max-w-3xl mx-auto rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
            <p className="font-semibold">Afinidades encerradas</p>
            <p className="mt-1 text-sm">
              {access.phase2Executed
                ? 'A Fase 2 ja foi executada e a coleta de afinidades foi fechada.'
                : 'A coleta de afinidades ainda nao foi aberta para esta distribuicao.'}
            </p>
          </div>

          {access.resultsAvailable && (
            <button
              type="button"
              onClick={() => navigate(`/student/result/${distributionId}`)}
              className="mt-4 inline-flex items-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Voltar para consulta do grupo
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="mx-auto h-12 w-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <Heart className="h-6 w-6 text-red-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Afinidades sociais</h1>
          <p className="mt-2 text-slate-600">Aluno: {studentName || 'Nao identificado'}</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start text-red-700">
            <AlertTriangle className="h-5 w-5 mr-3 flex-shrink-0 mt-0.5" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {currentGroup && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 mb-8">
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Seu grupo atual
            </h2>

            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs font-semibold text-blue-600 uppercase mb-1">Tema</p>
              <p className="text-lg font-bold text-slate-900">{currentGroup.themeName}</p>
            </div>

            <div className="space-y-5">
              {(currentGroup.members || [])
                .filter((member: any) => member.id !== studentId)
                .map((member: any) => {
                  const affinityValue = affinities[member.id] || 0;
                  return (
                    <div key={member.id} className="border border-slate-200 rounded-lg p-5 hover:border-blue-300 transition-colors">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <p className="font-semibold text-slate-900">{member.name}</p>
                          <p className="text-sm text-slate-500">{member.course} • Fase {member.phase}</p>
                        </div>
                        <span className={`text-sm font-semibold ${getAffinityColor(affinityValue)}`}>
                          {getAffinityLabel(affinityValue)}
                        </span>
                      </div>

                      <input
                        type="range"
                        min="-100"
                        max="100"
                        value={affinityValue}
                        onChange={(e) => handleAffinityChange(member.id, Number.parseInt(e.target.value, 10))}
                        className="w-full"
                      />
                      <div className="mt-2 flex justify-between text-xs">
                        <span className="text-red-600">-100</span>
                        <span className="font-bold text-slate-900">{affinityValue}</span>
                        <span className="text-green-600">+100</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 mb-8">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Pesquisar alunos de outros grupos</h2>

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
                  placeholder="Digite ao menos 2 caracteres"
                  className="block w-full pl-10 pr-4 py-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={searchLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-60"
              >
                {searchLoading ? 'Buscando...' : 'Buscar'}
              </button>
            </div>
          </form>

          <div className="space-y-3">
            {searchResults.map((candidate) => {
              const alreadyAdded = addedStudents.some((item) => item.id === candidate.id);
              return (
                <div key={candidate.id} className="border border-slate-200 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{candidate.name}</p>
                    <p className="text-xs text-slate-500">{candidate.course} • Fase {candidate.phase}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddStudent(candidate)}
                    disabled={alreadyAdded}
                    className="inline-flex items-center rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    {alreadyAdded ? 'Adicionado' : 'Adicionar'}
                  </button>
                </div>
              );
            })}

            {searchQuery.trim().length >= 2 && !searchLoading && searchResults.length === 0 && (
              <p className="text-sm text-slate-500">Nenhum aluno de outro grupo encontrado.</p>
            )}
          </div>

          {addedStudents.length > 0 && (
            <div className="mt-8 space-y-4">
              <h3 className="text-sm font-semibold text-slate-700">Afinidades adicionais</h3>
              {addedStudents.map((student) => {
                const affinityValue = affinities[student.id] || 0;
                return (
                  <div key={student.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-900">{student.name}</p>
                        <p className="text-xs text-slate-500">{student.course} • Fase {student.phase}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveStudent(student.id)}
                        className="p-1 text-slate-500 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <input
                      type="range"
                      min="-100"
                      max="100"
                      value={affinityValue}
                      onChange={(e) => handleAffinityChange(student.id, Number.parseInt(e.target.value, 10))}
                      className="w-full"
                    />
                    <div className="mt-2 flex justify-between text-xs">
                      <span className="text-red-600">-100</span>
                      <span className="font-bold text-slate-900">{affinityValue}</span>
                      <span className="text-green-600">+100</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex gap-4 justify-center">
          <button
            onClick={() => navigate(`/student/result/${distributionId}`)}
            disabled={submitting}
            className="px-6 py-3 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors font-medium disabled:opacity-50"
          >
            Pular
          </button>
          <button
            onClick={handleSaveAffinities}
            disabled={submitting || !hasAnyAffinity}
            className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center disabled:bg-slate-300 disabled:opacity-50"
          >
            <Heart className="h-4 w-4 mr-2" />
            {submitting ? 'Salvando...' : 'Salvar afinidades'}
          </button>
        </div>
      </div>
    </div>
  );
}
