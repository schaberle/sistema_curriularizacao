/**
 * Step 1: Theme Configuration Page (Container)
 * Manages theme setup logic and renders ThemeConfigView
 */

import { useNavigate, useParams } from 'react-router-dom';
import { useDistribution } from '../../hooks/useDistribution';
import { useToast } from '../../hooks/useToast';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { Theme } from '../../types/distribution.types';
import { ThemeConfigView } from '../../components/organizer/views/ThemeConfigView';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { ConfirmDialog as ConfirmDialogModal } from '../../components/common/ConfirmDialog';
import { useEffect, useState } from 'react';

export function Step1_ThemeConfigPage() {
  const navigate = useNavigate();
  const { distributionId } = useParams<{ distributionId: string }>();
  const { currentDistribution, themes, loading, errors, actions } = useDistribution();
  const { addToast } = useToast();
  const { confirm, isOpen, config, handleConfirm, handleCancel } = useConfirmDialog();

  const [draftThemes, setDraftThemes] = useState<Theme[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setDraftThemes(themes);
    setIsDirty(false);
  }, [themes, currentDistribution?.id]);

  if (!distributionId || !currentDistribution) {
    return (
      <ErrorAlert
        title="Distribuicao nao encontrada"
        message="Nao foi possivel carregar a distribuicao. Volte e tente novamente."
        onRetry={() => navigate('/organizer')}
      />
    );
  }

  const handleAddTheme = (theme: Theme) => {
    if (!theme.name.trim()) {
      addToast({
        type: 'error',
        message: 'Nome do tema e obrigatorio',
      });
      return;
    }

    if (draftThemes.some((t) => t.name.toLowerCase() === theme.name.toLowerCase())) {
      addToast({
        type: 'error',
        message: `Tema "${theme.name}" ja existe`,
      });
      return;
    }

    setDraftThemes((prev) => [...prev, { ...theme, id: `temp-${Date.now()}` }]);
    setIsDirty(true);

    addToast({
      type: 'success',
      message: `Tema "${theme.name}" adicionado`,
    });
  };

  const handleRemoveTheme = async (themeId: string) => {
    const themeName = draftThemes.find((t) => t.id === themeId)?.name || 'Tema desconhecido';
    const isPersistedTheme = Boolean(themeId) && !String(themeId).startsWith('temp-');

    if (isPersistedTheme) {
      addToast({
        type: 'error',
        message: 'Remocao de tema salvo ainda nao esta disponivel nesta etapa',
      });
      return;
    }

    const shouldDelete = await confirm({
      title: 'Remover tema?',
      message: `Tem certeza que deseja remover "${themeName}"?`,
      confirmText: 'Remover',
      cancelText: 'Cancelar',
    });

    if (!shouldDelete) return;

    setDraftThemes((prev) => prev.filter((t) => t.id !== themeId));
    setIsDirty(true);

    addToast({
      type: 'success',
      message: `Tema "${themeName}" removido`,
    });
  };

  const handleNext = async () => {
    if (draftThemes.length === 0) {
      addToast({
        type: 'error',
        message: 'Adicione pelo menos um tema para continuar',
      });
      return;
    }

    if (isDirty) {
      const themesToPersist = draftThemes
        .filter((theme) => !theme.id || String(theme.id).startsWith('temp-'))
        .map((theme) => ({
          ...theme,
          id: undefined,
        }));

      try {
        if (themesToPersist.length > 0) {
          await actions.saveThemes(distributionId, themesToPersist);
          addToast({
            type: 'success',
            message: 'Temas salvos com sucesso',
          });
        }
      } catch {
        addToast({
          type: 'error',
          message: 'Erro ao salvar temas',
        });
        return;
      }
    }

    navigate(`/organizer/${distributionId}/step2-data`);
  };

  const handlePrevious = () => {
    navigate(`/organizer/${distributionId}`);
  };

  if (loading.loadDistribution) {
    return <LoadingSpinner fullScreen message="Carregando temas..." />;
  }

  if (errors.loadDistribution) {
    return (
      <ErrorAlert
        title="Erro ao carregar"
        message={errors.loadDistribution}
        onRetry={() => actions.loadDistribution(distributionId)}
      />
    );
  }

  return (
    <>
      <ThemeConfigView
        themes={draftThemes}
        loading={loading.saveThemes}
        error={errors.saveThemes}
        onAddTheme={handleAddTheme}
        onRemoveTheme={handleRemoveTheme}
        onNext={handleNext}
        onPrevious={handlePrevious}
      />
      <ConfirmDialogModal
        isOpen={isOpen}
        config={config}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
}

