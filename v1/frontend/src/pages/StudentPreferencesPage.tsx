import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowDown, ArrowUp, CheckCircle2, CheckSquare, GripVertical, List, Save, X } from 'lucide-react';
import api from '../services/api';
import { StudentDistributionAccess } from '../types/student.types';

interface Theme {
  id: string;
  name: string;
  description: string;
}

/**
 * StudentPreferencesPage - Pagina para aluno rankear temas
 */
export function StudentPreferencesPage() {
  const { studentId, distributionId } = useParams<{ studentId: string; distributionId: string }>();
  const navigate = useNavigate();

  const [themes, setThemes] = useState<Theme[]>([]);
  const [preferences, setPreferences] = useState<string[]>([]);
  const [access, setAccess] = useState<StudentDistributionAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [error, setError] = useState('');

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
        setThemes(themesResponse.data.themes || []);
        setPreferences([]);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Erro ao carregar dados da distribuicao');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [distributionId]);

  const handleDragStart = (e: React.DragEvent, themeId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', themeId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const themeId = e.dataTransfer.getData('text/plain');

    if (!preferences.includes(themeId)) {
      setPreferences((prev) => [...prev, themeId]);
    }
  };

  const handleRemovePreference = (themeId: string) => {
    setPreferences(preferences.filter((id) => id !== themeId));
  };

  const handleMoveUp = (index: number) => {
    if (index > 0) {
      const newPrefs = [...preferences];
      [newPrefs[index], newPrefs[index - 1]] = [newPrefs[index - 1], newPrefs[index]];
      setPreferences(newPrefs);
    }
  };

  const handleMoveDown = (index: number) => {
    if (index < preferences.length - 1) {
      const newPrefs = [...preferences];
      [newPrefs[index], newPrefs[index + 1]] = [newPrefs[index + 1], newPrefs[index]];
      setPreferences(newPrefs);
    }
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

    if (preferences.length === 0) {
      setError('Selecione pelo menos um tema');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const prefsData = preferences.map((themeId, index) => ({
        themeId,
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
            Revisar preferencias
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-5xl mx-auto">
        <header className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Rankear Temas</h1>
          <p className="text-slate-600 max-w-2xl mx-auto">
            Arraste os temas da lista de disponiveis para a lista de preferencias. Organize-os na ordem de sua preferencia.
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center">
              <List className="h-5 w-5 text-slate-500 mr-2" />
              <h2 className="text-lg font-medium text-slate-900">Temas Disponiveis</h2>
            </div>
            <div className="p-6 flex-1 overflow-y-auto max-h-[600px] space-y-3">
              {themes.filter((t) => !preferences.includes(t.id)).length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <p>Todos os temas foram selecionados</p>
                </div>
              ) : (
                themes
                  .filter((t) => !preferences.includes(t.id))
                  .map((theme) => (
                    <div
                      key={theme.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, theme.id)}
                      className="p-4 bg-white border border-slate-200 rounded-lg cursor-grab active:cursor-grabbing hover:border-blue-400 hover:shadow-sm transition-all group"
                    >
                      <div className="flex items-start">
                        <GripVertical className="h-5 w-5 text-slate-400 mr-2 mt-0.5 flex-shrink-0" />
                        <div>
                          <h3 className="font-medium text-slate-900 group-hover:text-blue-600 transition-colors">{theme.name}</h3>
                          <p className="text-sm text-slate-500 mt-1">{theme.description}</p>
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center">
                <CheckSquare className="h-5 w-5 text-blue-600 mr-2" />
                <h2 className="text-lg font-medium text-slate-900">Minhas Preferencias</h2>
              </div>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-blue-100 text-blue-800">
                {preferences.length} selecionados
              </span>
            </div>

            <div className="p-6 flex-1 flex flex-col">
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={`flex-1 min-h-[300px] rounded-lg border-2 border-dashed transition-colors p-4 space-y-3 ${
                  preferences.length === 0
                    ? 'border-slate-300 bg-slate-50 flex items-center justify-center'
                    : 'border-transparent'
                }`}
              >
                {preferences.length === 0 ? (
                  <div className="text-center text-slate-400">
                    <p className="mb-2">Arraste os temas para esta area</p>
                    <p className="text-xs">Ou clique nos temas para adicionar</p>
                  </div>
                ) : (
                  preferences.map((themeId, index) => {
                    const theme = themes.find((t) => t.id === themeId);
                    if (!theme) return null;

                    return (
                      <div
                        key={themeId}
                        className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between group hover:shadow-sm transition-all"
                      >
                        <div className="flex items-center flex-1 mr-4">
                          <span className="flex-shrink-0 h-6 w-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center mr-3">
                            {index + 1}
                          </span>
                          <span className="font-medium text-slate-900 text-sm">{theme.name}</span>
                        </div>
                        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleMoveUp(index)}
                            disabled={index === 0}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-white rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="Mover para cima"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleMoveDown(index)}
                            disabled={index === preferences.length - 1}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-white rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="Mover para baixo"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                          <div className="w-px h-4 bg-slate-300 mx-1"></div>
                          <button
                            onClick={() => handleRemovePreference(themeId)}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-white rounded transition-colors"
                            title="Remover"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700 text-sm">
                  <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="mt-6 pt-6 border-t border-slate-100">
                <button
                  onClick={handleSubmit}
                  disabled={submitting || preferences.length === 0}
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
