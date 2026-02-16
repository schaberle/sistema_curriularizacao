
const { DatabaseService } = require('./dist/services/database/DatabaseService');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

async function run() {
    console.log('--- DIAGNÓSTICO DE HEALTH CHECK ---');
    const db = new DatabaseService(supabaseUrl, supabaseKey);
    const ok = await db.healthCheck();
    console.log('Health Check Status:', ok ? '✅ OK' : '❌ ERRO');
}

run();
