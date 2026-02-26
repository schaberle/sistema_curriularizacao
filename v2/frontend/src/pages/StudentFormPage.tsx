import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, GraduationCap } from 'lucide-react';
import api from '../services/api';
import { StudentDistributionAccess } from '../types/student.types';
import { cacheMatricula, getCachedMatricula } from '../utils/studentMatriculaCache';

/**
 * StudentFormPage - Pagina para aluno iniciar sessao.
 * Acesso exclusivo por matricula (RA).
 */
export function StudentFormPage() {
  const navigate = useNavigate();
  const { distributionId } = useParams<{ distributionId: string }>();

  const [matricula, setMatricula] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setMatricula(getCachedMatricula(distributionId));
  }, [distributionId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!distributionId) {
      setError('Distribuicao invalida');
      return;
    }

    const normalizedMatricula = matricula.trim();
    if (!normalizedMatricula) {
      setError('Informe sua matricula.');
      return;
    }

    try {
      setLoading(true);
      await api.createStudentSession(distributionId, { matricula: normalizedMatricula });
      cacheMatricula(distributionId, normalizedMatricula);

      const accessResponse = await api.getStudentAccess();
      const accessData = accessResponse.data as StudentDistributionAccess;

      if (accessData.registrationOpen) {
        navigate(`/student/preferences/${distributionId}`);
        return;
      }

      if (accessData.resultsAvailable) {
        navigate(`/student/result/${distributionId}`);
        return;
      }

      setError('A etapa de preferencias esta fechada no momento para esta distribuicao.');
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Erro ao iniciar sessao');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#eaf1ff_0%,#f8fafc_45%,#f8fafc_100%)] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-lg animate-fade-in">
        <header className="mb-6 text-center">
          <div className="mx-auto mb-4 inline-flex rounded-2xl bg-[var(--brand-100)] p-3 text-[var(--brand-700)]">
            <GraduationCap className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Cadastro do aluno</h1>
          <p className="mt-2 text-sm text-slate-600">
            Informe sua matricula para abrir sua sessao.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Matricula (RA)</label>
            <input
              type="text"
              value={matricula}
              onChange={(event) => setMatricula(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-sm text-slate-900 outline-none ring-[var(--brand-200)] focus:ring-2"
              placeholder="Ex: 202412345"
              disabled={loading}
              required
            />
          </div>

          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center rounded-xl bg-[var(--brand-600)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)] disabled:opacity-60"
          >
            {loading ? 'Iniciando sessao...' : 'Proxima etapa'}
            {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}
