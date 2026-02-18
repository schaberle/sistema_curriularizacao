/**
 * CSV Upload Zone
 * Allows users to upload themes or students from CSV files
 * Future feature - structure ready for implementation
 */

import { useState, useRef } from 'react';
import { Upload, FileText } from 'lucide-react';
import { Button } from '../../common/Button';

interface CSVUploadZoneProps {
  onUpload: (file: File) => Promise<void>;
  loading?: boolean;
  fileType?: 'themes' | 'students';
  accept?: string;
}

export function CSVUploadZone({
  onUpload,
  loading = false,
  fileType = 'themes',
  accept = '.csv',
}: CSVUploadZoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getLabel = () => {
    if (fileType === 'themes') {
      return 'temas (nome, descrição, maxGrupos)';
    }
    return 'alunos (nome, email, curso, fase)';
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        await onUpload(file);
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await onUpload(e.target.files[0]);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        disabled={loading}
        className="hidden"
        aria-label={`Upload CSV com ${getLabel()}`}
      />

      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-colors duration-200
          ${dragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
          }
          ${loading ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        <Upload className="w-8 h-8 mx-auto mb-3 text-slate-400" />
        <p className="text-sm font-medium text-slate-900 mb-1">
          Clique ou arraste um arquivo CSV
        </p>
        <p className="text-xs text-slate-500">
          Máximo 10MB • {getLabel()}
        </p>
      </div>

      {/* Future: Show CSV template download */}
      <div className="mt-4">
        <p className="text-xs text-slate-600 mb-2">
          Precisa de ajuda no formato? Baixe o template:
        </p>
        <Button
          variant="ghost"
          size="sm"
          disabled={loading}
          icon={<FileText className="w-4 h-4" />}
        >
          Download Template CSV
        </Button>
      </div>
    </div>
  );
}
