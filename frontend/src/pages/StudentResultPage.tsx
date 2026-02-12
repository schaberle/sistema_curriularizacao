import { useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';

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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">🔍 Meu Resultado</h1>
        <p className="text-gray-600 mb-8">Digite seu nome para buscar seu grupo</p>

        {/* Formulário de busca */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <form onSubmit={handleSearch} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Seu Nome Completo *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition"
                placeholder="João Silva"
                disabled={loading}
              />
            </div>

            {error && searched && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition"
            >
              {loading ? 'Buscando...' : 'Buscar Resultado'}
            </button>
          </form>
        </div>

        {/* Resultado */}
        {result && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-700 font-semibold">✓ Aluno encontrado!</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Dados pessoais */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Dados Pessoais</h3>
                <div className="space-y-2 text-gray-700">
                  <p>
                    <span className="font-semibold">Nome:</span> {result.studentName}
                  </p>
                  <p>
                    <span className="font-semibold">Curso:</span>{' '}
                    {result.course === 'EE' ? 'Engenharia Elétrica' : 'Engenharia Mecânica'}
                  </p>
                  <p>
                    <span className="font-semibold">Fase:</span> {result.phase}
                  </p>
                </div>
              </div>

              {/* Informações do grupo */}
              {result.group && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Seu Grupo</h3>
                  <div className="space-y-2 text-gray-700">
                    <p>
                      <span className="font-semibold">Tema:</span> {result.group.themeName}
                    </p>
                    <p className="text-sm text-gray-600">{result.group.themeDescription}</p>
                    <p>
                      <span className="font-semibold">ID Grupo:</span> {result.group.id}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Membros do grupo */}
            {result.group?.members && (
              <div className="mt-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Integrantes do Grupo</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  {result.group.members.map((member: any, index: number) => (
                    <div
                      key={index}
                      className="p-4 bg-gray-50 border border-gray-200 rounded-lg"
                    >
                      <p className="font-semibold text-gray-900">{member.name}</p>
                      <p className="text-sm text-gray-600">
                        {member.course} • Fase {member.phase}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.message && (
              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700">
                {result.message}
              </div>
            )}
          </div>
        )}

        {searched && !result && !error && (
          <div className="text-center text-gray-500">
            Nenhum resultado encontrado
          </div>
        )}
      </div>
    </div>
  );
}
