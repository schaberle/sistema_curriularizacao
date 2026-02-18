
import { Plus, Upload, AlertCircle, FileText, Trash2, ArrowLeft, ArrowRight } from 'lucide-react';

interface Theme {
    name: string;
    description: string;
    maxGroups: number;
}

interface CommonTheme {
    name: string;
    description: string;
    maxGroups: number;
}


interface ThemeConfigurationProps {
    distributionId: string;
    themes: Theme[];
    newTheme: Theme;
    setNewTheme: (theme: Theme) => void;
    loading: boolean;
    onAdd: () => void;
    onRemove: (index: number) => void;
    onSave: () => void;
    onBack: () => void;
}

export function ThemeConfiguration({
    distributionId,
    themes,
    newTheme,
    setNewTheme,
    loading,
    onAdd,
    onRemove,
    onSave,
    onBack
}: ThemeConfigurationProps) {
    return (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <h2 className="text-lg font-medium text-slate-900 flex items-center">
                    <div className="bg-blue-600 text-white rounded-full h-6 w-6 flex items-center justify-center text-xs mr-3">1</div>
                    Configuração de Temas
                </h2>
                <span className="text-sm text-slate-500 font-mono">ID: {distributionId.slice(0, 12)}...</span>
            </div>
            <div className="p-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Coluna 1: Formulário de Adição manual */}
                    <div>
                        <h3 className="text-md font-semibold text-slate-800 mb-4 flex items-center">
                            <Plus className="h-4 w-4 mr-2 text-blue-600" />
                            Adicionar Tema Manualmente
                        </h3>

                        <div className="space-y-4 bg-slate-50 p-6 rounded-lg border border-slate-200">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Tema</label>
                                <input
                                    type="text"
                                    value={newTheme.name}
                                    onChange={(e) => setNewTheme({ ...newTheme, name: e.target.value })}
                                    placeholder="Ex: Sustentabilidade Urbana"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Descrição (opcional)</label>
                                <textarea
                                    value={newTheme.description}
                                    onChange={(e) => setNewTheme({ ...newTheme, description: e.target.value })}
                                    placeholder="Breve descrição do tema..."
                                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                    rows={2}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Número Ideal de Grupos</label>
                                <input
                                    type="number"
                                    value={newTheme.maxGroups}
                                    onChange={(e) => setNewTheme({ ...newTheme, maxGroups: parseInt(e.target.value) || 0 })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                    min="1"
                                />
                            </div>
                            <button
                                onClick={onAdd}
                                className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Adicionar à Lista
                            </button>
                        </div>

                        <div className="mt-8">
                            <h3 className="text-md font-semibold text-slate-800 mb-4 flex items-center text-slate-400">
                                <Upload className="h-4 w-4 mr-2" />
                                Ou Upload de CSV (opcional)
                            </h3>
                            <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors cursor-pointer bg-slate-50">
                                <Upload className="h-6 w-6 text-slate-400 mx-auto mb-2" />
                                <p className="text-slate-700 text-sm font-medium">Upload de arquivo CSV</p>
                            </div>
                            <p className="text-xs text-amber-600 mt-2 flex items-center">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Em desenvolvimento
                            </p>
                        </div>
                    </div>

                    {/* Coluna 2: Lista de Temas já adicionados */}
                    <div>
                        <h3 className="text-md font-semibold text-slate-800 mb-4 flex items-center">
                            <FileText className="h-4 w-4 mr-2 text-blue-600" />
                            Temas na Distribuição ({themes.length})
                        </h3>

                        {themes.length === 0 ? (
                            <div className="h-64 flex flex-col items-center justify-center border border-slate-200 rounded-lg bg-white text-slate-400">
                                <FileText className="h-10 w-10 mb-2 opacity-20" />
                                <p>Nenhum tema adicionado ainda</p>
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[450px] overflow-y-auto pr-2">
                                {themes.map((theme, index) => (
                                    <div key={index} className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm flex justify-between items-start group hover:border-blue-300 transition-colors">
                                        <div>
                                            <h4 className="font-bold text-slate-900">{theme.name}</h4>
                                            {theme.description && <p className="text-sm text-slate-500 mt-1 line-clamp-1">{theme.description}</p>}
                                            <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                                {theme.maxGroups} grupos ideal
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => onRemove(index)}
                                            className="p-1 text-slate-400 hover:text-red-500 transition-colors rounded-full hover:bg-red-50"
                                            title="Remover tema"
                                        >
                                            <Trash2 className="h-5 w-5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-12 pt-6 border-t border-slate-200 flex justify-between gap-3">
                    <button
                        onClick={onBack}
                        className="px-4 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 transition-colors flex items-center"
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Voltar
                    </button>
                    <button
                        onClick={onSave}
                        disabled={loading || themes.length === 0}
                        className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center disabled:bg-slate-300"
                    >
                        {loading ? 'Salvando...' : 'Próxima Etapa'}
                        {!loading && <ArrowRight className="h-4 w-4 ml-2" />}
                    </button>
                </div>
            </div>
        </div>
    );
}
