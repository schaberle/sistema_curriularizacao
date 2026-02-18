import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  GraduationCap,
  LayoutDashboard,
  ShieldCheck,
  Users,
} from 'lucide-react';

/**
 * HomePage - Pagina inicial
 */
export function HomePage() {
  const navigate = useNavigate();

  const handleStudentAccess = () => {
    const distributionId = prompt('ID da Distribuicao:');
    if (distributionId) {
      navigate(`/student/form/${distributionId}`);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#eaf1ff_0%,#f8fafc_45%,#f8fafc_100%)]">
      <section className="border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center animate-fade-in">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--brand-100)]">
              <GraduationCap className="h-8 w-8 text-[var(--brand-700)]" />
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
              Sistema de Distribuicao de Grupos
            </h1>
            <p className="mt-5 text-lg text-slate-600">
              Plataforma para formar grupos com equilibrio academico e preferencias dos alunos, em um fluxo simples para organizadores.
            </p>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={handleStudentAccess}
                className="inline-flex items-center rounded-xl bg-[var(--brand-600)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-700)]"
              >
                Acesso do aluno
                <ArrowRight className="ml-2 h-4 w-4" />
              </button>
              <button
                onClick={() => navigate('/login')}
                className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Area do organizador
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-6 md:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 inline-flex rounded-xl bg-[var(--brand-100)] p-2.5 text-[var(--brand-700)]">
              <BrainCircuit className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Otimizacao inteligente</h3>
            <p className="mt-2 text-sm text-slate-600">
              Combina preferencias, diversidade de fases e restricoes para gerar distribuicoes mais consistentes.
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 inline-flex rounded-xl bg-emerald-100 p-2.5 text-emerald-700">
              <BarChart3 className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Acompanhamento claro</h3>
            <p className="mt-2 text-sm text-slate-600">
              O organizador acompanha progresso, validacoes e resultados em etapas, sem sobrecarga visual.
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 inline-flex rounded-xl bg-amber-100 p-2.5 text-amber-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Regras preservadas</h3>
            <p className="mt-2 text-sm text-slate-600">
              Mantem o controle de equilibrio entre cursos e fases para respeitar criterios academicos definidos.
            </p>
          </article>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white/80">
        <div className="mx-auto grid max-w-4xl gap-5 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={handleStudentAccess}
            className="group rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:shadow"
          >
            <div className="mb-5 flex items-center justify-between">
              <div className="rounded-xl bg-[var(--brand-100)] p-2.5 text-[var(--brand-700)]">
                <Users className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:text-[var(--brand-700)]" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Sou aluno</h3>
            <p className="mt-2 text-sm text-slate-600">Registro rapido, preferencias e consulta de resultado.</p>
          </button>

          <button
            type="button"
            onClick={() => navigate('/login')}
            className="group rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:shadow"
          >
            <div className="mb-5 flex items-center justify-between">
              <div className="rounded-xl bg-slate-100 p-2.5 text-slate-700">
                <LayoutDashboard className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:text-slate-700" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Sou organizador</h3>
            <p className="mt-2 text-sm text-slate-600">Fluxo guiado para configurar, executar e revisar distribuicoes.</p>
          </button>
        </div>
      </section>

      <footer className="py-10 text-center text-xs text-slate-500">
        <p>&copy; {new Date().getFullYear()} Sistema de Distribuicao de Grupos Interdisciplinares.</p>
      </footer>
    </div>
  );
}
