import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, BookOpen, CheckCircle, Heart, Layers, Search, User, Users } from 'lucide-react';
import api from '../services/api';
import { StudentDistributionAccess } from '../types/student.types';

/**
 * StudentResultPage - Consulta de resultado via sessao autenticada por matricula.
 */
export function StudentResultPage() {
  const { distributionId } = useParams<{ distributionId: string }>();
  const navigate = useNavigate();

  const [matricula, setMatricula] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);
  const [searched, setSearched] = useState(false);
  const [access, setAccess] = useState<StudentDistributionAccess | null>(null);
  const [startingAffinitySession, setStartingAffinitySession] = useState(false);

  const buildSessionPayload = () => {
    const normalizedMatricula = matricula.trim();
    if (!normalizedMatricula) {
      return null;
    }
    return { matricula: normalizedMatricula };
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setSearched(true);

    if (!distributionId) {
      setError('Distribuicao invalida');
      return;
    }

    const sessionPayload = buildSessionPayload();
    if (!sessionPayload) {
      setError('Preencha a matricula');
      return;
    }

    try {
      setLoading(true);

      await api.createStudentSession(distributionId, sessionPayload);

      const [accessResponse, meResponse] = await Promise.all([
        api.getStudentAccess(),
        api.getStudentMe(),
      ]);

      const accessData = accessResponse.data as StudentDistributionAccess;
      setAccess(accessData);

      if (!accessData.resultsAvailable) {
        setError('Resultados ainda nao foram liberados para esta distribuicao.');
        return;
      }

      let groupData: any = null;
      let groupMessage = '';

      try {
        const groupResponse = await api.getStudentCurrentGroup();
        groupData = groupResponse.data || null;
      } catch (groupErr: any) {
        groupMessage = groupErr?.message || 'Aluno ainda nao foi alocado a um grupo';
      }

      const me = meResponse.data || {};
      setResult({
        studentName: me.name,
        course: me.course,
        phase: me.phase,
        group: groupData,
        message: groupMessage,
      });
    } catch (err: any) {
      setError(err?.message || 'Erro ao consultar resultado');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAffinities = async () => {
    if (!distributionId) {
      return;
    }

    const sessionPayload = buildSessionPayload();
    if (!sessionPayload) {
      return;
    }

    try {
      setStartingAffinitySession(true);
      await api.createStudentSession(distributionId, sessionPayload);
      navigate(`/student/affinities/${distributionId}`);
    } catch (err: any) {
      setError(err?.message || 'Nao foi possivel iniciar sessao para afinidades');
    } finally {
      setStartingAffinitySession(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <div className="mx-auto h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Search className="h-6 w-6 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Consultar resultado</h1>
          <p className="mt-2 text-slate-600">
            Informe sua matricula para abrir uma sessao e consultar seu grupo.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 mb-8">
          <form onSubmit={handleSearch} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Matricula (RA)</label>
              <input
                type="text"
                value={matricula}
                onChange={(e) => setMatricula(e.target.value)}
                className="block w-full sm:text-sm border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500 p-2.5 border"
                placeholder="Ex: 202412345"
                disabled={loading}
                required
              />
            </div>

            {error && searched && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700 text-sm">
                <AlertTriangle className="h-5 w-5 mr-3 flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
            >
              {loading ? 'Consultando...' : 'Abrir sessao e consultar'}
            </button>
          </form>
        </div>

        {result && (
          <div className="bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden">
            <div className="border-b border-slate-200 bg-green-50 px-6 py-4 flex items-center">
              <CheckCircle className="h-6 w-6 text-green-600 mr-3" />
              <h2 className="text-lg font-medium text-green-800">Sessao validada</h2>
            </div>

            <div className="p-8">
              <div className="grid md:grid-cols-2 gap-8 mb-8">
                <div>
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Seus dados</h3>
                  <div className="space-y-4">
                    <div className="flex items-start">
                      <User className="h-5 w-5 text-slate-400 mr-3 mt-0.5" />
                      <div>
                        <p className="text-sm text-slate-500">Nome</p>
                        <p className="font-medium text-slate-900">{result.studentName}</p>
                      </div>
                    </div>
                    <div className="flex items-start">
                      <BookOpen className="h-5 w-5 text-slate-400 mr-3 mt-0.5" />
                      <div>
                        <p className="text-sm text-slate-500">Curso</p>
                        <p className="font-medium text-slate-900">{result.course === 'EE' ? 'Engenharia Eletrica' : 'Engenharia Mecanica'}</p>
                      </div>
                    </div>
                    <div className="flex items-start">
                      <Layers className="h-5 w-5 text-slate-400 mr-3 mt-0.5" />
                      <div>
                        <p className="text-sm text-slate-500">Fase</p>
                        <p className="font-medium text-slate-900">{result.phase}a fase</p>
                      </div>
                    </div>
                  </div>
                </div>

                {result.group && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Grupo atribuido</h3>
                    <div className="bg-blue-50 rounded-lg p-5 border border-blue-100">
                      <p className="text-xs text-blue-600 font-semibold uppercase">Tema</p>
                      <p className="font-bold text-slate-900">{result.group.themeName}</p>

                      {typeof result.group.socialCohesionScore === 'number' && (
                        <p className="mt-3 text-sm text-slate-700">
                          Coesao social: <span className="font-semibold">{result.group.socialCohesionScore.toFixed(2)}</span>
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {!result.group && result.message && (
                <div className="mb-8 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 text-sm">
                  {result.message}
                </div>
              )}

              {result.group?.members && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2 flex items-center">
                    <Users className="h-4 w-4 mr-2" />
                    Integrantes do grupo
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {result.group.members.map((member: any, index: number) => (
                      <div key={index} className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                        <p className="font-semibold text-slate-900 text-sm">{member.name}</p>
                        <p className="text-xs text-slate-500 mt-1">{member.course} - {member.phase}a fase</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {distributionId && access?.affinitiesOpen && (
                <div className="mt-8 rounded-lg border border-rose-200 bg-rose-50 p-4">
                  <p className="text-sm text-rose-900">A coleta de afinidades esta aberta para esta distribuicao.</p>
                  <button
                    type="button"
                    onClick={handleOpenAffinities}
                    disabled={startingAffinitySession}
                    className="mt-3 inline-flex items-center rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
                  >
                    <Heart className="mr-2 h-4 w-4" />
                    {startingAffinitySession ? 'Preparando sessao...' : 'Declarar/atualizar afinidades'}
                  </button>
                </div>
              )}

              {distributionId && access?.phase2Executed && (
                <div className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  Coleta de afinidades encerrada apos execucao da Fase 2.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
