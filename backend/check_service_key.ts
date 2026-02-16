import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';

// Carregar .env do diretório atual
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

console.log('--- VERIFICAÇÃO DE SERVICE KEY ---');

if (!supabaseUrl) {
    console.error('❌ SUPABASE_URL não encontrado no .env');
    process.exit(1);
}

if (!serviceKey) {
    console.error('❌ SUPABASE_SERVICE_KEY não encontrado no .env');
    console.error('⚠️  Certifique-se de adicionar a chave de serviço (service_role) no arquivo .env');
    process.exit(1);
}

// Verificar se parece uma chave de serviço (geralmente começa com eyJ e é longa, mas o payload decodificado tem role: 'service_role')
if (serviceKey === process.env.SUPABASE_ANON_KEY) {
    console.warn('⚠️  Aviso: SUPABASE_SERVICE_KEY parece ser igual à ANON_KEY. Isso não funcionará para bypass de RLS.');
}

const supabase = createClient(supabaseUrl, serviceKey);

async function checkServiceKey() {
    try {
        console.log('Tentando operação administrativa (bypass RLS)...');

        // Tentar listar usuários (operação que requer privilégios de admin/service_role)
        const { data: users, error: authError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });

        if (authError) {
            console.error('❌ Falha na verificação de admin (Auth):', authError.message);
            console.error('Provavelmente a chave fornecida não é uma SERVICE_KEY válida.');
        } else {
            console.log('✅ Auth Admin Access: OK');
        }

        // Tentar acessar diretamente a tabela groups ignorando RLS
        // Para testar, vamos fazer um select count
        const { count, error: dbError } = await supabase
            .from('groups')
            .select('*', { count: 'exact', head: true });

        if (dbError) {
            console.error('❌ Falha no acesso ao DB com Service Key:', dbError.message);
        } else {
            console.log(`✅ Acesso ao DB (Bypass RLS): OK (Total de grupos: ${count})`);
        }

        if (!authError && !dbError) {
            console.log('\n🎉 SUCESSO: SUPABASE_SERVICE_KEY está configurada corretamente!');
        } else {
            console.log('\n❌ FALHA: A chave configurada não parece ter permissões completas.');
        }

    } catch (err: any) {
        console.error('Erro inesperado:', err.message);
    }
}

checkServiceKey();
