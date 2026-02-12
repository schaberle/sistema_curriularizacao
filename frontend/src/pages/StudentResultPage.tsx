import { useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import { Search, User, BookOpen, Layers, CheckCircle, AlertTriangle, Users, FileText } from 'lucide-react';

/**
 * StudentResultPage - Página pública para aluno buscar seu resultado
 */
export function StudentResultPage() {
  const { distributionId } = useParams<{ distributionId: string }>();

  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);

    if (!name || !distributionId) {
      setError('Digite seu nome');
      return;
    }

    try {
      setLoading(true);
      const response = await api.searchStudent(name, distributionId);

      if (response.found) {
        setResult(response.data);
      } else {
        setError(response.message || 'Aluno não encontrado');
      }
      setSearched(true);
    } catch (err: any) {
      setError('Erro ao buscar resultado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <div className="mx-auto h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Search className="h-6 w-6 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Consultar Resultado</h1>
          <p className="mt-2 text-slate-600">Busque por seu nome para visualizar seu grupo atribuído</p>
        </div>

        {/* Formulário de busca */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 mb-8">
          <form onSubmit={handleSearch} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Seu Nome Completo
              </label>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full pl-10 sm:text-sm border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500 p-2.5 border"
                  placeholder="Ex: João Silva"
                  disabled={loading}
                />
              </div>
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
              className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300 transition-colors"
            >
              {loading ? 'Consultando...' : 'Buscar Agora'}
            </button>
          </form>
        </div>

        {/* Resultado */}
        {result && (
          <div className="bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden">
            <div className="border-b border-slate-200 bg-green-50 px-6 py-4 flex items-center">
              <CheckCircle className="h-6 w-6 text-green-600 mr-3" />
              <h2 className="text-lg font-medium text-green-800">Aluno Encontrado</h2>
            </div>

            <div className="p-8">
              <div className="grid md:grid-cols-2 gap-8 mb-8">
                {/* Dados pessoais */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Seus Dados</h3>
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
                        <p className="font-medium text-slate-900">{result.course === 'EE' ? 'Engenharia Elétrica' : 'Engenharia Mecânica'}</p>
                      </div>
                    </div>
                    <div className="flex items-start">
                      <Layers className="h-5 w-5 text-slate-400 mr-3 mt-0.5" />
                      <div>
                        <p className="text-sm text-slate-500">Fase</p>
                        <p className="font-medium text-slate-900">{result.phase}ª Fase</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Informações do grupo */}
                {result.group && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Grupo Atribuído</h3>
                    <div className="bg-blue-50 rounded-lg p-5 border border-blue-100">
                      <div className="flex items-start mb-3">
                        <FileText className="h-5 w-5 text-blue-600 mr-3 mt-0.5" />
                        <div>
                          <p className="text-xs text-blue-600 font-semibold uppercase">Tema</p>
                          <p className="font-bold text-slate-900">{result.group.themeName}</p>
                        </div>
                      </div>
                      <p className="text-sm text-slate-600 ml-8 mb-4">{result.group.themeDescription}</p>
                      <div className="ml-8 text-xs text-slate-400 font-mono bg-white inline-block px-2 py-1 rounded border border-slate-200">
                        ID: {result.group.id}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Membros do grupo */}
              {/* Coesão Social (Fase 2) */}
              {result.group?.socialCohesionScore !== undefined && (
                <div className="mb-8 p-6 rounded-lg border-2" style={{
                  borderColor: result.group.socialCohesionScore > 0 ? '#86efac' : result.group.socialCohesionScore < 0 ? '#fca5a5' : '#cbd5e1',
                  backgroundColor: result.group.socialCohesionScore > 0 ? '#f0fdf4' : result.group.socialCohesionScore < 0 ? '#fef2f2' : '#f8fafc'
                }}>
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 border-b pb-2 flex items-center" style={{
                    borderColor: result.group.socialCohesionScore > 0 ? '#bbf7d0' : result.group.socialCohesionScore < 0 ? '#fbcacb' : '#cbd5e1'
                  }}>
                    💚 Coesão Social do Grupo (Fase 2)
                  </h3>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-700 font-medium">Score de Coesão:</span>
                      <span className="text-2xl font-bold" style={{
                        color: result.group.socialCohesionScore > 0 ? '#16a34a' : result.group.socialCohesionScore < 0 ? '#dc2626' : '#64748b'
                      }}>
                        {result.group.socialCohesionScore.toFixed(2)}
                      </span>
                    </div>

                    {result.group.socialCohesionScore > 0 && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
                        ✅ <strong>Excelente!</strong> Seu grupo tem ótima afinidade entre os membros.
                      </div>
                    )}

                    {result.group.socialCohesionScore < 0 && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                        ⚠️ <strong>Atenção:</strong> Há baixa afinidade entre alguns membros, mas o grupo foi otimizado.
                      </div>
                    )}

                    {result.group.socialCohesionScore === 0 && (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-sm">
                        ➖ <strong>Neutro:</strong> O grupo não tem afinidades significativas registradas.
                      </div>
                    )}

                    <p className="text-xs text-slate-600 mt-3">
                      A coesão social foi calculada com base nas afinidades declaradas na Fase 2 de otimização.
                    </p>
                  </div>
                </div>
              )}

              {result.group?.members && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2 flex items-center">
                    <Users className="h-4 w-4 mr-2" />
                    Integrantes do Grupo
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {result.group.members.map((member: any, index: number) => (
                      <div
                        key={index}
                        className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-center"
                      >
                        <div className="h-10 w-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 font-bold text-sm mr-4">
                          {member.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 text-sm">{member.name}</p>
                          <p className="text-xs text-slate-500">
                            {member.course} • {member.phase}ª Fase
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.message && (
                <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start text-amber-800">
                  <AlertTriangle className="h-5 w-5 mr-3 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Atenção</p>
                    <p className="text-sm mt-1">{result.message}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {searched && !result && !error && (
          <div className="text-center py-12">
            <div className="mx-auto h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <Search className="h-8 w-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-medium text-slate-900">Nenhum resultado encontrado</h3>
            <p className="text-slate-500 mt-2">Verifique se o nome foi digitado corretamente.</p>
          </div>
        )}
      </div>
    </div>
  );
}
