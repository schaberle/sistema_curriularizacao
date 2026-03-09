import { Group } from '../types/distribution.types';

/**
 * Generates and triggers download of a CSV file containing all groups,
 * their members, and each member's course/phase.
 */
export function downloadGroupsCSV(groups: Group[], filename = 'grupos.csv') {
    const rows: string[] = [];

    // Header row
    rows.push('Grupo,Tema,Aluno,Curso,Fase');

    let groupIndex = 1;
    for (const group of groups) {
        const groupLabel = `Grupo ${groupIndex}`;
        const theme = `"${(group.themeName ?? '').replace(/"/g, '""')}"`;
        for (const member of group.members) {
            const name = `"${(member.name ?? '').replace(/"/g, '""')}"`;
            const course =
                member.course === 'MECHANICAL' || member.course === 'ME'
                    ? 'Mecânica'
                    : 'Elétrica';
            const phase = member.phase != null ? `${member.phase}ª` : '-';
            rows.push(`${groupLabel},${theme},${name},${course},${phase}`);
        }
        groupIndex++;
    }

    const csvContent = '\uFEFF' + rows.join('\r\n'); // BOM for Excel UTF-8
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    URL.revokeObjectURL(url);
}
