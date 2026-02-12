import { useNavigate } from 'react-router-dom';

/**
 * HomePage - Página inicial com opções para alunos e organizadores
 */
export function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-600 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-white mb-4">
            🎓 Sistema de Distribuição de Grupos
          </h1>
          <p className="text-xl text-blue-100">
            Distribuição inteligente de grupos para atividades interdisciplinares
          </p>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Card Alunos */}
          <div className="bg-white rounded-lg shadow-2xl p-8 hover:shadow-3xl transition transform hover:scale-105">
            <div className="text-5xl mb-4">👨‍🎓</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Para Alunos</h2>
            <p className="text-gray-600 mb-6">
              Preencha suas informações e rankear temas de preferência para ser distribuído em um grupo.
            </p>
            <div className="space-y-2 mb-6 text-sm text-gray-700">
              <p>✓ Registre seus dados (nome, curso, fase)</p>
              <p>✓ Rankear temas de preferência</p>
              <p>✓ Busque seu resultado após distribuição</p>
            </div>
            <button
              onClick={() => {
                const distributionId = prompt('ID da Distribuição:');
                if (distributionId) {
                  navigate(`/student/form/${distributionId}`);
                }
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition"
            >
              Começar como Aluno
            </button>
          </div>

          {/* Card Organizadores */}
          <div className="bg-white rounded-lg shadow-2xl p-8 hover:shadow-3xl transition transform hover:scale-105">
            <div className="text-5xl mb-4">👨‍💼</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Para Organizadores</h2>
            <p className="text-gray-600 mb-6">
              Gerencie a distribuição de alunos em grupos com base em suas preferências.
            </p>
            <div className="space-y-2 mb-6 text-sm text-gray-700">
              <p>✓ Criar distribuição</p>
              <p>✓ Upload de temas/projetos</p>
              <p>✓ Executar algoritmo de distribuição</p>
              <p>✓ Visualizar resultados</p>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition"
            >
              Login de Organizador
            </button>
          </div>
        </div>

        {/* Features */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            ⚡ Características do Sistema
          </h3>
          <div className="grid md:grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-4xl mb-2">🤖</div>
              <h4 className="font-semibold text-gray-900 mb-2">Algoritmo Inteligente</h4>
              <p className="text-gray-600 text-sm">
                Otimização em 3 fases: geração inicial, busca local e simulated annealing
              </p>
            </div>
            <div>
              <div className="text-4xl mb-2">📊</div>
              <h4 className="font-semibold text-gray-900 mb-2">Satisfação Maximizada</h4>
              <p className="text-gray-600 text-sm">
                Maximiza preferências dos alunos mantendo restrições críticas
              </p>
            </div>
            <div>
              <div className="text-4xl mb-2">⚙️</div>
              <h4 className="font-semibold text-gray-900 mb-2">Restrições Garantidas</h4>
              <p className="text-gray-600 text-sm">
                1-2 EE por grupo, mínimo 2 fases diferentes, diversidade máxima
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
