import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, BookOpen, GraduationCap, Layers, User } from 'lucide-react';
import api from '../services/api';

/**
 * StudentFormPage - Pagina para aluno iniciar sessao.
 * Matricula e o fluxo principal; fallback legado existe apenas em DEV.
 */
export function StudentFormPage() {
  const navigate = useNavigate();
  const { distributionId } = useParams<{ distributionId: string }>();
  const isDevLegacyModeEnabled =
    import.meta.env.DEV &&
    String(import.meta.env.VITE_DEV_ALLOW_LEGACY_STUDENT_SESSION || '').toLowerCase() === 'true';

  const [matricula, setMatricula] = useState('');
  const [name, setName] = useState('');
  const [course, setCourse] = useState<'EE' | 'ME'>('EE');
  const [phase, setPhase] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!distributionId) {
      setError('Distribuicao invalida');
      return;
    }

    const normalizedMatricula = matricula.trim();
    const normalizedName = name.trim();

    if (!normalizedMatricula && !(isDevLegacyModeEnabled && normalizedName)) {
      setError(
        isDevLegacyModeEnabled
          ? 'Informe matricula ou nome (modo DEV).'
          : 'Informe sua matricula.'
      );
      return;
    }

    try {
      setLoading(true);

      if (normalizedMatricula) {
        await api.createStudentSession(distributionId, { matricula: normalizedMatricula });
      } else {
        await api.createStudentSession(distributionId, {
          name: normalizedName,
          course,
          phase,
        });
      }

      navigate(`/student/preferences/${distributionId}`);
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
            {isDevLegacyModeEnabled
              ? 'Use matricula (padrao) ou fallback legado em modo DEV.'
              : 'Informe sua matricula para abrir sua sessao.'}
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Matricula</label>
            <input
              type="text"
              value={matricula}
              onChange={(event) => setMatricula(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-sm text-slate-900 outline-none ring-[var(--brand-200)] focus:ring-2"
              placeholder="Ex: 202412345"
              disabled={loading}
              required={!isDevLegacyModeEnabled}
            />
          </div>

          {isDevLegacyModeEnabled && (
            <>
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Modo DEV legado ativo: se matricula estiver vazia, a sessao usa nome/curso/fase.
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Nome (fallback DEV)</label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none ring-[var(--brand-200)] focus:ring-2"
                    placeholder="Ex: Joao da Silva"
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Curso (fallback DEV)</label>
                <div className="relative">
                  <BookOpen className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <select
                    value={course}
                    onChange={(event) => setCourse(event.target.value as 'EE' | 'ME')}
                    className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none ring-[var(--brand-200)] focus:ring-2"
                    disabled={loading}
                  >
                    <option value="EE">Engenharia Eletrica (EE)</option>
                    <option value="ME">Engenharia Mecanica (ME)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Fase (fallback DEV)</label>
                <div className="relative">
                  <Layers className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <select
                    value={phase}
                    onChange={(event) => setPhase(Number.parseInt(event.target.value, 10))}
                    className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none ring-[var(--brand-200)] focus:ring-2"
                    disabled={loading}
                  >
                    {Array.from({ length: 10 }, (_, index) => (
                      <option key={index + 1} value={index + 1}>
                        Fase {index + 1}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

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
