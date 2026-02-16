import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

dotenv.config();

const results = [];

function log(msg) {
    console.log(msg);
    results.push(msg);
}

log("--- ENVIRONMENT DUMP ---");
const keysToDump = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_KEY'];
keysToDump.forEach(k => {
    const val = process.env[k] || '';
    log(`${k}: [${val.trim()}] (length: ${val.length})`);
    if (val.length > 0) {
        log(`Starts with: ${val.substring(0, 10)}... Ends with: ...${val.substring(val.length - 10)}`);
    }
});

const url = (process.env.SUPABASE_URL || '').trim();
const anonKey = (process.env.SUPABASE_ANON_KEY || '').trim();
const serviceKey = (process.env.SUPABASE_SERVICE_KEY || '').trim();
const mcpPublishableKey = "sb_publishable_tn8VkyAd7tSrvQLH5P9tFg_f_DadGip";

async function test(name, testUrl, testKey) {
    log(`\n--- TESTING: ${name} ---`);
    if (!testUrl || !testKey) {
        log("Missing URL or Key, skipping.");
        return;
    }
    const supabase = createClient(testUrl, testKey);
    try {
        const { error, count, status, statusText } = await supabase
            .from('distributions')
            .select('*', { count: 'exact', head: true });

        if (error) {
            log(`Status: ${status} (${statusText})`);
            log(`Error Message: ${error.message}`);
            log(`Error Hint: ${error.hint}`);
            log(`Error Details: ${error.details}`);
        } else {
            log(`✅ Success! Count: ${count}`);
        }
    } catch (e) {
        log(`❌ Exception: ${e.message}`);
    }
}

async function run() {
    await test("ANON KEY FROM .ENV", url, anonKey);
    await test("SERVICE KEY FROM .ENV", url, serviceKey);
    await test("PUBLISHABLE KEY FROM MCP", url, mcpPublishableKey);

    fs.writeFileSync('diagnostic_output.txt', results.join('\n'));
}

run();
