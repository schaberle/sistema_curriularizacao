
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function fixStatus() {
    const distId = '4fdc71c9-e35a-46f0-a701-48f9f3644c07';
    console.log(`Fixing status for ${distId}...`);

    const { error } = await supabase
        .from('distributions')
        .update({ status: 'COMPLETED' })
        .eq('id', distId);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Status updated to COMPLETED');
    }
}

fixStatus();
