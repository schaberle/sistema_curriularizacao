import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

console.log('URL:', supabaseUrl);
console.log('Key (first 10 chars):', supabaseKey.substring(0, 10));

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing URL or Key');
    process.exit(1);
}

// Decode JWT to check role (simple split)
const parts = supabaseKey.split('.');
if (parts.length === 3) {
    try {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        console.log('JWT Payload:', JSON.stringify(payload, null, 2));
    } catch (e) {
        console.error('Error decoding JWT:', e);
    }
} else {
    console.error('Invalid JWT structure');
}

const client = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
    console.log('Testing connection...');
    try {
        // Try simple selection first
        const { data: data1, error: error1 } = await client
            .from('distributions')
            .select('count', { count: 'exact', head: true });

        if (error1) {
            console.error('Connection Error (HEAD):', JSON.stringify(error1, null, 2));
        } else {
            console.log('Connection Success (HEAD):', data1);
        }

        // Try selecting actual data
        const { data: data2, error: error2 } = await client
            .from('distributions')
            .select('id')
            .limit(1);

        if (error2) {
            console.error('Connection Error (SELECT):', JSON.stringify(error2, null, 2));
        } else {
            console.log('Connection Success (SELECT):', data2);
        }

    } catch (err) {
        console.error('Exception:', err);
    }
}

testConnection();
