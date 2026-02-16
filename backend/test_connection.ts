
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

console.log('---START_DIAGNOSTIC---');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing environment variables');
    process.exit(1);
}

const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;
const publishableKey = "sb_publishable_tn8VkyAd7tSrvQLH5P9tFg_f_DadGip"; // From MCP

async function testKey(name: string, key: string | undefined) {
    if (!key) {
        console.log(`\n--- Skipping ${name} (not provided) ---`);
        return;
    }
    console.log(`\n--- Testing ${name} ---`);
    console.log(`Key starts with: ${key.substring(0, 15)}...`);
    const client = createClient(supabaseUrl || '', key);
    try {
        const { error, count, status, statusText } = await client
            .from('distributions')
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.error(`❌ ${name} failed:`);
            console.error(`Status: ${status} (${statusText})`);
            console.error(`Message: ${error.message}`);
        } else {
            console.log(`✅ ${name} working! Count: ${count}`);
        }
    } catch (e) {
        console.error(`❌ ${name} exception:`, e);
    }
}

async function runAll() {
    await testKey("Anon Key (from .env)", anonKey);
    await testKey("Service Key (from .env)", serviceKey);
    await testKey("New Publishable Key (from MCP)", publishableKey);
}

runAll();
