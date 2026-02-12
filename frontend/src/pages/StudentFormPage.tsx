import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';

/**
 * StudentFormPage - Página para aluno registrar dados básicos
 */
export function StudentFormPage() {
  const navigate = useNavigate();
  const { distributionId } = useParams<{ distributionId: string }>();

  const [name, setName] = useState('');
  const [course, setCourse] = useState<'EE' | 'ME'>('EE');
  const [phase, setPhase] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name || !distributionId) {
      setError('Dados inválidos');
      return;
    }

    try {
      setLoading(true);
      const response = await api.registerStudent(distributionId, name, course, phase);

      // Ir para página de preferências
      navigate(`/student/${response.data.studentId}/preferences/${distributionId}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao registrar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 py-12 px-4">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">📝 Dados Pessoais</h1>
          <p className="text-gray-600 mb-8">Preencha suas informações</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nome */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nome Completo *
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

            {/* Curso */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Curso *
              </label>
              <select
                value={course}
                onChange={(e) => setCourse(e.target.value as 'EE' | 'ME')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition"
                disabled={loading}
              >
                <option value="EE">Engenharia Elétrica (EE)</option>
                <option value="ME">Engenharia Mecânica (ME)</option>
              </select>
            </div>

            {/* Fase */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fase/Semestre *
              </label>
              <select
                value={phase}
                onChange={(e) => setPhase(parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition"
                disabled={loading}
              >
                {Array.from({ length: 10 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    Fase {i + 1}
                  </option>
                ))}
              </select>
            </div>

            {/* Erro */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
            >
              {loading ? 'Registrando...' : 'Próxima Etapa'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
