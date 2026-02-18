/**
 * Theme List Section
 * Displays list of configured themes with edit/delete actions
 */

import { Theme } from '../../../types/distribution.types';
import { Button } from '../../common/Button';
import { Trash2, BookOpen } from 'lucide-react';

interface ThemeListSectionProps {
  themes: Theme[];
  loading?: boolean;
  onRemove: (themeId: string) => void;
}

export function ThemeListSection({
  themes,
  loading = false,
  onRemove,
}: ThemeListSectionProps) {
  if (themes.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {themes.map((theme) => (
        <div
          key={theme.id}
          className="flex items-start gap-4 p-4 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors"
        >
          {/* Theme Icon & Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-500 flex-shrink-0" />
              <h3 className="font-semibold text-slate-900 truncate">
                {theme.name}
              </h3>
            </div>

            {theme.description && (
              <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                {theme.description}
              </p>
            )}

            {theme.maxGroups && (
              <p className="text-xs text-slate-500 mt-2">
                Máximo: {theme.maxGroups} grupo{theme.maxGroups > 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => theme.id && onRemove(theme.id)}
              disabled={loading}
              icon={<Trash2 className="w-4 h-4" />}
              className="text-red-600 hover:text-red-700 hover:border-red-600"
            >
              Remover
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
