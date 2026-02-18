import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, LayoutDashboard, Lock, Mail } from 'lucide-react';
import { useAuthContext } from '../context/AuthContext';

/**
 * LoginPage - Pagina de login para organizadores
 */
export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, error, loading } = useAuthContext();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLocalError('');

    if (!email || !password) {
      setLocalError('Email e senha sao obrigatorios');
      return;
    }

    const success = await login(email, password);
    if (success) {
      const params = new URLSearchParams(location.search);
      const next = params.get('next');

      if (next && next.startsWith('/')) {
        navigate(next, { replace: true });
      } else {
        navigate('/organizer');
      }
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#eaf1ff_0%,#f8fafc_45%,#f8fafc_100%)] px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-md animate-fade-in">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 inline-flex rounded-2xl bg-[var(--brand-600)] p-3 text-white shadow-sm">
            <LayoutDashboard className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Acesso do organizador</h1>
          <p className="mt-2 text-sm text-slate-600">Entre para gerenciar distribuicoes e acompanhar os resultados.</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Email
              </label>
              <div className="relative mt-1">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none ring-[var(--brand-200)] focus:ring-2"
                  placeholder="admin@exemplo.com"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                Senha
              </label>
              <div className="relative mt-1">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none ring-[var(--brand-200)] focus:ring-2"
                  placeholder="********"
                  disabled={loading}
                />
              </div>
            </div>

            {(error || localError) && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error || localError}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center rounded-xl bg-[var(--brand-600)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)] disabled:opacity-60"
            >
              {loading ? 'Autenticando...' : 'Entrar'}
              {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

