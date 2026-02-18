/**
 * Theme Configuration View (Presentation)
 * Displays theme form, list, and navigation buttons
 */

import { Theme } from '../../../types/distribution.types';
import { Card } from '../../common/Card';
import { Button } from '../../common/Button';
import { ErrorAlert } from '../../common/ErrorAlert';
import { ThemeFormSection } from '../sections/ThemeFormSection';
import { ThemeListSection } from '../sections/ThemeListSection';

interface ThemeConfigViewProps {
  themes: Theme[];
  loading: boolean;
  error: string | null;
  onAddTheme: (theme: Theme) => void;
  onRemoveTheme: (themeId: string) => void;
  onNext: () => void;
  onPrevious: () => void;
}

export function ThemeConfigView({
  themes,
  loading,
  error,
  onAddTheme,
  onRemoveTheme,
  onNext,
  onPrevious,
}: ThemeConfigViewProps) {
  return (
    <div className="space-y-6">
      {/* Error Alert */}
      {error && (
        <ErrorAlert title="Erro ao salvar temas" message={error} />
      )}

      {/* Theme Form Section */}
      <Card title="Adicionar Novo Tema" padding="lg">
        <ThemeFormSection onSubmit={onAddTheme} loading={loading} />
      </Card>

      {/* Theme List Section */}
      <Card
        title={`Temas Configurados (${themes.length})`}
        padding="lg"
      >
        {themes.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-slate-500">Nenhum tema adicionado ainda</p>
            <p className="text-sm text-slate-400 mt-2">
              Use o formulário acima para adicionar seus primeiros temas
            </p>
          </div>
        ) : (
          <ThemeListSection
            themes={themes}
            loading={loading}
            onRemove={onRemoveTheme}
          />
        )}
      </Card>

      {/* Navigation */}
      <div className="flex gap-4 justify-between">
        <Button
          variant="secondary"
          onClick={onPrevious}
          disabled={loading}
        >
          ← Voltar
        </Button>

        <Button
          variant="primary"
          onClick={onNext}
          isLoading={loading}
          disabled={themes.length === 0 || loading}
        >
          Próximo: Dados de Alunos →
        </Button>
      </div>
    </div>
  );
}
