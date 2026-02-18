
interface StatusBadgeProps {
    status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
    const colors: Record<string, string> = {
        PENDING: 'bg-yellow-100 text-yellow-800',
        EXECUTING: 'bg-blue-100 text-blue-800',
        COMPLETED: 'bg-green-100 text-green-800',
        FAILED: 'bg-red-100 text-red-800',
        PARTIAL: 'bg-indigo-100 text-indigo-800',
    };

    const labels: Record<string, string> = {
        PENDING: 'Pendente',
        EXECUTING: 'Executando',
        COMPLETED: 'Concluída',
        FAILED: 'Falhou',
        PARTIAL: 'Fase 1 Ok',
    };

    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-slate-100 text-slate-800'}`}>
            {labels[status] || status}
        </span>
    );
}
