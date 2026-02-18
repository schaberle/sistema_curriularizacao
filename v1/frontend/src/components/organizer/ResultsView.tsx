
import { Zap, Users, ArrowLeft, Heart, List } from 'lucide-react';

interface GroupMember {
    id: string;
    name: string;
    course: string;
    phase: number;
}

interface Group {
    id: string;
    theme: { id: string; name: string };
    members: GroupMember[];
    memberCount: number;
}

interface ResultsViewProps {
    report: string | null;
    groups: Group[] | null;
    onBack: () => void;
    onPhase2: () => void;
    onList: () => void;
}

export function ResultsView({
    report,
    groups,
    onBack,
    onPhase2,
    onList
}: ResultsViewProps) {
    return (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <h2 className="text-lg font-medium text-slate-900 flex items-center">
                    <div className="bg-green-600 text-white rounded-full h-6 w-6 flex items-center justify-center text-xs mr-3">✓</div>
                    Resultados da Distribuição
                </h2>
            </div>
            <div className="p-8">
                {report && (
                    <div className="bg-slate-900 rounded-lg p-6 mb-8 overflow-x-auto">
                        <pre className="text-green-400 font-mono text-sm whitespace-pre-wrap">
                            {report}
                        </pre>
                    </div>
                )}

                {/* Comparação Fase 1 vs Fase 2 */}
                {(report?.includes('RELATÓRIO DE FASE 2') || report?.includes('metrics')) && (
                    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-lg border border-indigo-200 p-6 mb-8">
                        <h3 className="text-lg font-semibold text-indigo-900 mb-4 flex items-center">
                            <Zap className="h-5 w-5 mr-2 text-indigo-600" />
                            Impacto da Otimização Social
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-white/60 p-4 rounded-lg border border-indigo-100">
                                <h4 className="font-medium text-indigo-800 mb-2">O que mudou?</h4>
                                <p className="text-sm text-indigo-700">
                                    A Fase 2 ajusta os grupos para maximizar a coesão social (afinidades) mantendo o equilíbrio de energia da Fase 1.
                                    Alunos com afinidades positivas foram aproximados.
                                </p>
                            </div>
                            <div className="bg-white/60 p-4 rounded-lg border border-indigo-100">
                                <h4 className="font-medium text-indigo-800 mb-2">Próximos Passos</h4>
                                <p className="text-sm text-indigo-700">
                                    Revise os grupos abaixo. Se a configuração social estiver satisfatória, você pode finalizar a distribuição.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {groups && groups.length > 0 && (
                    <div className="mb-8">
                        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
                            <Users className="h-5 w-5 mr-2 text-blue-600" />
                            Grupos Formados ({groups.length})
                        </h3>
                        <div className="grid gap-4">
                            {groups.map((group) => (
                                <div key={group.id} className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <p className="font-medium text-slate-900">{group.theme.name}</p>
                                            <p className="text-sm text-slate-600">ID: {group.id.slice(0, 8)}...</p>
                                        </div>
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                            {group.memberCount} membros
                                        </span>
                                    </div>
                                    <div className="space-y-2">
                                        {group.members.map((member) => (
                                            <div key={member.id} className="flex items-center justify-between text-sm p-2 bg-white rounded border border-slate-100">
                                                <span className="text-slate-900">{member.name}</span>
                                                <div className="flex items-center gap-3 text-slate-600">
                                                    <span className="text-xs bg-slate-100 px-2 py-1 rounded">{member.course}</span>
                                                    <span className="text-xs bg-slate-100 px-2 py-1 rounded">Fase {member.phase}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {!groups && (
                    <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-slate-600">Carregando grupos...</p>
                    </div>
                )}

                <div className="flex justify-between items-center pt-6 border-t border-slate-200">
                    <button
                        onClick={onBack}
                        className="inline-flex items-center px-4 py-2 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Voltar à Execução
                    </button>
                    <div className="flex gap-3">
                        <button
                            onClick={onPhase2}
                            className="inline-flex items-center px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50 transition-colors"
                        >
                            <Heart className="h-4 w-4 mr-2" />
                            Executar Fase 2
                        </button>
                        <button
                            onClick={onList}
                            className="inline-flex items-center px-4 py-2 border border-blue-300 rounded-md shadow-sm text-sm font-medium text-blue-700 bg-white hover:bg-blue-50 transition-colors"
                        >
                            <List className="h-4 w-4 mr-2" />
                            Lista de Distribuições
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
