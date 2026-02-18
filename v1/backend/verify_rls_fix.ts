
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';

// Carregar .env do diretório atual
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ SUPABASE_URL ou SUPABASE_ANON_KEY não encontrados no .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
    console.log('--- TESTANDO INSERÇÃO EM DISTRIBUTIONS ---');
    console.log('URL:', supabaseUrl);
    console.log('Key (anon):', supabaseKey.substring(0, 15) + '...');

    const { data, error } = await supabase
        .from('distributions')
        .insert({
            organizer_id: '00000000-0000-0000-0000-000000000000', // UUID dummy para teste
            status: 'PENDING',
            created_at: new Date().toISOString(),
        })
        .select('id')
        .single();

    if (error) {
        console.error('❌ Falha ao inserir:');
        console.error('Status:', error.code);
        console.error('Mensagem:', error.message);
        console.error('Dica:', error.hint);
    } else {
        console.log('✅ Inserção bem-sucedida! ID:', data.id);

        // Limpar teste
        await supabase.from('distributions').delete().eq('id', data.id);
        console.log('✅ Teste excluído.');
    }
}

testInsert();
