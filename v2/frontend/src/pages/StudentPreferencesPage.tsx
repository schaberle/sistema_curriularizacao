import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, ListChecks, RotateCcw, Save } from 'lucide-react';
import api from '../services/api';
import { StudentDistributionAccess } from '../types/student.types';

interface Theme {
  id: string;
  name: string;
  description: string;
}

const RATING_MIN = -5;
const RATING_MAX = 5;
const RATING_STEP = 0.05;

function normalizeRating(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const clamped = Math.min(RATING_MAX, Math.max(RATING_MIN, value));
  const rounded = Math.round(clamped / RATING_STEP) * RATING_STEP;
  return Number(rounded.toFixed(2));
}

function formatRating(value: number): string {
  return value > 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
}

function compareThemesByRating(a: Theme, b: Theme, ratings: Record<string, number>): number {
  const diff = (ratings[b.id] ?? 0) - (ratings[a.id] ?? 0);
  if (Math.abs(diff) > 1e-9) {
    return diff;
  }

  return a.name.localeCompare(b.name, 'pt-BR');
}

/**
 * StudentPreferencesPage - Pagina para aluno avaliar temas
 */
export function StudentPreferencesPage() {
  const { studentId, distributionId } = useParams<{ studentId: string; distributionId: string }>();
  const navigate = useNavigate();

  const [themes, setThemes] = useState<Theme[]>([]);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [access, setAccess] = useState<StudentDistributionAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [error, setError] = useState('');
  const [expandedThemeId, setExpandedThemeId] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!distributionId) return;

      try {
        setLoading(true);
        setError('');

        const accessResponse = await api.getStudentDistributionAccess(distributionId);
        const accessData = accessResponse.data as StudentDistributionAccess;
        setAccess(accessData);

        if (!accessData.registrationOpen) {
          setError('Janela de cadastro/preferencias encerrada para esta distribuicao.');
          return;
        }

        const themesResponse = await api.getThemes(distributionId);
        const loadedThemes = (themesResponse.data.themes || []) as Theme[];

        setThemes(loadedThemes);
        setRatings(
          loadedThemes.reduce<Record<string, number>>((acc, theme) => {
            acc[theme.id] = 0;
            return acc;
          }, {})
        );
        setExpandedThemeId(null);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Erro ao carregar dados da distribuicao');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [distributionId]);

  const rankedThemes = useMemo(
    () => [...themes].sort((a, b) => compareThemesByRating(a, b, ratings)),
    [themes, ratings]
  );

  const averageRating = useMemo(() => {
    if (themes.length === 0) {
      return 0;
    }

    const total = themes.reduce((sum, theme) => sum + (ratings[theme.id] ?? 0), 0);
    return total / themes.length;
  }, [themes, ratings]);

  const handleThemeRatingChange = (themeId: string, rawValue: string) => {
    const parsed = Number.parseFloat(rawValue.replace(',', '.'));
    const nextValue = normalizeRating(parsed);

    setRatings((prev) => ({
      ...prev,
      [themeId]: nextValue,
    }));
    setError('');
  };

  const handleResetRatings = () => {
    setRatings(
      themes.reduce<Record<string, number>>((acc, theme) => {
        acc[theme.id] = 0;
        return acc;
      }, {})
    );
    setError('');
  };

  const handleSubmit = async () => {
    if (!studentId || !distributionId) {
      setError('Parametros invalidos');
      return;
    }

    if (access && !access.registrationOpen) {
      setError('Janela de cadastro/preferencias encerrada para esta distribuicao.');
      return;
    }

    if (themes.length === 0) {
      setError('Nao ha temas disponiveis para avaliar');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      // Traducao de nota -> rank (contrato atual do backend).
      const prefsData = rankedThemes.map((theme, index) => ({
        themeId: theme.id,
        rank: index + 1,
      }));

      await api.updateStudentPreferences(studentId, prefsData);
      setSubmitSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Erro ao salvar preferencias');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <div className="text-slate-500 animate-pulse">Carregando temas...</div>
      </div>
    );
  }

  if (access && !access.registrationOpen) {
    return (
      <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8 font-sans">
        <div className="max-w-3xl mx-auto rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
            <p className="font-semibold">Preferencias fechadas</p>
            <p className="mt-1 text-sm">A coleta de preferencias foi encerrada para esta distribuicao.</p>
          </div>

          {access.resultsAvailable && (
            <button
              type="button"
              onClick={() => navigate(`/student/result/${distributionId}`)}
              className="mt-4 inline-flex items-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Ver meu grupo
            </button>
          )}
        </div>
      </div>
    );
  }

  if (submitSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8 font-sans">
        <div className="max-w-2xl mx-auto rounded-2xl border border-emerald-200 bg-white p-8 shadow-sm">
          <div className="mb-4 inline-flex rounded-full bg-emerald-100 p-3 text-emerald-700">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Resposta registrada</h1>
          <p className="mt-3 text-slate-600">
            Sua resposta foi registrada com sucesso. Volte quando o organizador liberar os resultados.
          </p>

          <button
            type="button"
            onClick={() => setSubmitSuccess(false)}
            className="mt-6 inline-flex items-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Revisar notas
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-5xl mx-auto">
        <header className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Avaliar Temas</h1>
          <p className="text-slate-600 max-w-2xl mx-auto">
            Atribua uma nota de -5 a +5 para cada tema (passo de 0.05). O sistema converte automaticamente as notas em ranking.
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center">
              <ListChecks className="h-5 w-5 text-slate-500 mr-2" />
              <h2 className="text-lg font-medium text-slate-900">Notas por Tema</h2>
            </div>
            <div className="p-6 flex-1 overflow-y-auto max-h-[600px] space-y-3">
              {themes.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <p>Nenhum tema disponivel</p>
                </div>
              ) : (
                themes.map((theme) => {
                  const rating = ratings[theme.id] ?? 0;
                  const isDescriptionOpen = expandedThemeId === theme.id;
                  const hasDescription = theme.description.trim().length > 0;
                  const ratingBadgeClass =
                    rating > 0
                      ? 'bg-emerald-100 text-emerald-700'
                      : rating < 0
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-slate-100 text-slate-600';

                  return (
                    <div key={theme.id} className="p-4 bg-white border border-slate-200 rounded-lg">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-medium text-slate-900">{theme.name}</h3>
                        </div>
                        <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${ratingBadgeClass}`}>
                          {formatRating(rating)}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setExpandedThemeId(isDescriptionOpen ? null : theme.id)}
                        className="mt-3 w-full inline-flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                        aria-expanded={isDescriptionOpen}
                      >
                        <span>{isDescriptionOpen ? 'Ocultar descricao' : 'Ver descricao'}</span>
                        {isDescriptionOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>

                      {isDescriptionOpen && (
                        <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                          {hasDescription ? theme.description : 'Sem descricao cadastrada para este tema.'}
                        </div>
                      )}

                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-[1fr_100px] gap-3 items-center">
                        <input
                          type="range"
                          min={RATING_MIN}
                          max={RATING_MAX}
                          step={RATING_STEP}
                          value={rating}
                          onChange={(e) => handleThemeRatingChange(theme.id, e.target.value)}
                          className="w-full accent-blue-600"
                        />
                        <input
                          type="number"
                          min={RATING_MIN}
                          max={RATING_MAX}
                          step={RATING_STEP}
                          value={rating}
                          onChange={(e) => handleThemeRatingChange(theme.id, e.target.value)}
                          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-right text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                      </div>

                      <div className="mt-2 flex justify-between text-[11px] text-slate-400">
                        <span>-5.00</span>
                        <span>0.00</span>
                        <span>+5.00</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center">
                <ListChecks className="h-5 w-5 text-blue-600 mr-2" />
                <h2 className="text-lg font-medium text-slate-900">Ranking Gerado</h2>
              </div>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-blue-100 text-blue-800">
                media {formatRating(averageRating)}
              </span>
            </div>

            <div className="p-6 flex-1 flex flex-col">
              <div className="flex-1 min-h-[300px] rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2 overflow-y-auto max-h-[460px]">
                {rankedThemes.map((theme, index) => (
                  <div
                    key={theme.id}
                    className="p-3 bg-white border border-slate-200 rounded-lg flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex-shrink-0 h-6 w-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                        {index + 1}
                      </span>
                      <span className="font-medium text-slate-900 text-sm truncate">{theme.name}</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-500">{formatRating(ratings[theme.id] ?? 0)}</span>
                  </div>
                ))}
              </div>

              <p className="mt-4 text-xs text-slate-500">
                Maior nota recebe maior prioridade no ranking (rank 1).
              </p>

              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700 text-sm">
                  <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="mt-6 pt-6 border-t border-slate-100 space-y-3">
                <button
                  type="button"
                  onClick={handleResetRatings}
                  disabled={submitting || themes.length === 0}
                  className="w-full flex justify-center items-center py-2.5 px-4 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Zerar notas
                </button>

                <button
                  onClick={handleSubmit}
                  disabled={submitting || themes.length === 0}
                  className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300 transition-colors"
                >
                  {submitting ? (
                    'Salvando...'
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Confirmar e Salvar Preferencias
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
