import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../context/AuthContext';
import api from '../services/api';

/**
 * OrganizerDashboard - Painel principal do organizador
 */
export function OrganizerDashboard() {
  const navigate = useNavigate();
  const { logout } = useAuthContext();

  const [distributionId, setDistributionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'initial' | 'themes' | 'execute' | 'results'>('initial');

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-6xl mx-auto px-4 py-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">🎓 Painel do Organizador</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
          >
            Sair
          </button>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="max-w-6xl mx-auto px-4 py-12">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {step === 'initial' && (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Bem-vindo ao Sistema de Distribuição
            </h2>
            <p className="text-gray-600 mb-8">
              Clique abaixo para criar uma nova distribuição
            </p>
            <button
              onClick={handleCreateDistribution}
              disabled={loading}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition"
            >
              {loading ? 'Criando...' : 'Criar Nova Distribuição'}
            </button>
          </div>
        )}

        {step === 'themes' && distributionId && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Etapa 1: Upload de Temas
            </h2>
            <p className="text-gray-600 mb-6">
              ID da Distribuição: <code className="bg-gray-100 px-2 py-1 rounded">{distributionId}</code>
            </p>
            <p className="text-gray-600 mb-8">
              Aguardando implementação de upload de CSV/temas
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setStep('initial')}
                className="px-6 py-2 bg-gray-300 hover:bg-gray-400 text-gray-900 rounded-lg transition"
              >
                Voltar
              </button>
              <button
                onClick={() => setStep('execute')}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
              >
                Próximo
              </button>
            </div>
          </div>
        )}

        {step === 'execute' && distributionId && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Etapa 2: Executar Distribuição
            </h2>
            <p className="text-gray-600 mb-8">
              Clique para executar o algoritmo de distribuição
            </p>
            <button
              onClick={() => setStep('results')}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
            >
              Executar Distribuição
            </button>
          </div>
        )}

        {step === 'results' && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Resultados da Distribuição
            </h2>
            <p className="text-gray-600 mb-8">
              Os resultados serão exibidos aqui
            </p>
            <button
              onClick={() => setStep('initial')}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
            >
              Nova Distribuição
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
