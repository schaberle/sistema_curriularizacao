/**
 * Theme Form Section
 * Form for adding a new theme
 */

import { useState } from 'react';
import { Theme } from '../../../types/distribution.types';
import { Button } from '../../common/Button';
import { Plus } from 'lucide-react';

interface ThemeFormSectionProps {
  onSubmit: (theme: Theme) => void;
  loading?: boolean;
}

export function ThemeFormSection({ onSubmit, loading = false }: ThemeFormSectionProps) {
  const [formData, setFormData] = useState<Theme>({
    name: '',
    description: '',
    maxGroups: undefined,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    // Reset form
    setFormData({ name: '', description: '', maxGroups: undefined });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Theme Name */}
      <div>
        <label htmlFor="themeName" className="block text-sm font-medium text-slate-700 mb-2">
          Nome do Tema *
        </label>
        <input
          id="themeName"
          type="text"
          placeholder="Ex: Python, Data Science, Web Development"
          value={formData.name}
          onChange={(e) =>
            setFormData({ ...formData, name: e.target.value })
          }
          disabled={loading}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
          required
        />
      </div>

      {/* Theme Description */}
      <div>
        <label htmlFor="themeDesc" className="block text-sm font-medium text-slate-700 mb-2">
          Descrição (opcional)
        </label>
        <textarea
          id="themeDesc"
          placeholder="Descreva brevemente este tema..."
          value={formData.description || ''}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          disabled={loading}
          rows={3}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
        />
      </div>

      {/* Max Groups */}
      <div>
        <label htmlFor="maxGroups" className="block text-sm font-medium text-slate-700 mb-2">
          Máximo de Grupos (opcional)
        </label>
        <input
          id="maxGroups"
          type="number"
          placeholder="Deixe em branco para sem limite"
          value={formData.maxGroups || ''}
          onChange={(e) =>
            setFormData({
              ...formData,
              maxGroups: e.target.value ? parseInt(e.target.value) : undefined,
            })
          }
          disabled={loading}
          min="1"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
        />
      </div>

      {/* Submit Button */}
      <div className="flex gap-2 pt-2">
        <Button
          type="submit"
          variant="primary"
          isLoading={loading}
          disabled={!formData.name.trim() || loading}
          icon={<Plus className="w-4 h-4" />}
        >
          Adicionar Tema
        </Button>
      </div>
    </form>
  );
}
