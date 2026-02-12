import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

interface Theme {
  id: string;
  name: string;
  description: string;
}

/**
 * StudentPreferencesPage - Página para aluno rankear temas
 */
export function StudentPreferencesPage() {
  const { studentId, distributionId } = useParams<{ studentId: string; distributionId: string }>();
  const navigate = useNavigate();

  const [themes, setThemes] = useState<Theme[]>([]);
  const [preferences, setPreferences] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Buscar temas ao carregar
  useEffect(() => {
    const loadThemes = async () => {
      try {
        const response = await api.getThemes(distributionId!);
        setThemes(response.data.themes || []);
        setPreferences([]);
      } catch (err: any) {
        setError('Erro ao carregar temas');
      } finally {
        setLoading(false);
      }
    };

    loadThemes();
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
      setPreferences([...preferences, themeId]);
    }
  };

  const handleRemovePreference = (themeId: string) => {
    setPreferences(preferences.filter(id => id !== themeId));
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
    if (preferences.length === 0) {
      setError('Selecione pelo menos um tema');
      return;
    }

    try {
      setSubmitting(true);
      const prefsData = preferences.map((themeId, index) => ({
        themeId,
        rank: index + 1,
      }));

      await api.updateStudentPreferences(studentId!, prefsData);
      navigate(`/student/result/${distributionId}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao salvar preferências');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-gray-600">Carregando temas...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">⭐ Rankear Temas</h1>
        <p className="text-gray-600 mb-8">Arraste os temas para ordenar suas preferências</p>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Temas disponíveis */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Temas Disponíveis</h2>
            <div className="space-y-2">
              {themes
                .filter(t => !preferences.includes(t.id))
                .map(theme => (
                  <div
                    key={theme.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, theme.id)}
                    className="p-4 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg cursor-move hover:border-blue-400 hover:bg-blue-50 transition"
                  >
                    <h3 className="font-semibold text-gray-900">{theme.name}</h3>
                    <p className="text-sm text-gray-600">{theme.description}</p>
                  </div>
                ))}
            </div>
          </div>

          {/* Preferências (área drop) */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Minhas Preferências</h2>
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 min-h-64 bg-gray-50 mb-4 transition"
            >
              {preferences.length === 0 ? (
                <p className="text-gray-500 text-center">Arraste temas aqui</p>
              ) : (
                <div className="space-y-2">
                  {preferences.map((themeId, index) => {
                    const theme = themes.find(t => t.id === themeId);
                    return (
                      <div
                        key={themeId}
                        className="p-3 bg-blue-50 border border-blue-300 rounded-lg flex items-center justify-between"
                      >
                        <div className="flex-1">
                          <span className="inline-block bg-blue-600 text-white text-sm font-semibold px-2 py-1 rounded mr-2">
                            {index + 1}
                          </span>
                          <span className="font-semibold text-gray-900">{theme?.name}</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleMoveUp(index)}
                            disabled={index === 0}
                            className="px-2 py-1 text-sm bg-gray-300 disabled:bg-gray-200 rounded hover:bg-gray-400 transition"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => handleMoveDown(index)}
                            disabled={index === preferences.length - 1}
                            className="px-2 py-1 text-sm bg-gray-300 disabled:bg-gray-200 rounded hover:bg-gray-400 transition"
                          >
                            ↓
                          </button>
                          <button
                            onClick={() => handleRemovePreference(themeId)}
                            className="px-2 py-1 text-sm bg-red-300 rounded hover:bg-red-400 transition"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4">
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting || preferences.length === 0}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition"
            >
              {submitting ? 'Salvando...' : 'Salvar Preferências'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
