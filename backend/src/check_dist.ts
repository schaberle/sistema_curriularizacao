
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env from backend folder
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDistribution(id: string) {
    console.log(`Checking distribution ${id}...`);

    // 1. Get Distribution
    const { data: dist, error: distError } = await supabase
        .from('distributions')
        .select('*')
        .eq('id', id)
        .single();

    if (distError) {
        console.error('Error fetching distribution:', distError);
        return;
    }
    console.log('Distribution:', dist);

    // 2. Check Groups (Solution Phase 1)
    const { count: groupCount, error: groupError } = await supabase
        .from('groups')
        .select('*', { count: 'exact', head: true })
        .eq('distribution_id', id);

    console.log('Groups count:', groupCount);

    // 3. Check Students
    const { count: studentCount } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('distribution_id', id);
    console.log('Students count:', studentCount);

    // 4. Check Affinities
    // We need to join via students to filter by distribution_id
    const { data: students } = await supabase.from('students').select('id').eq('distribution_id', id);
    const studentIds = students?.map(s => s.id) || [];

    if (studentIds.length > 0) {
        const { count: affinityCount } = await supabase
            .from('student_affinities')
            .select('*', { count: 'exact', head: true })
            .in('student_id', studentIds);
        console.log('Affinities count:', affinityCount);
    } else {
        console.log('No students found, so no affinities.');
    }

    // 5. Check Themes
    const { count: themeCount } = await supabase
        .from('themes')
        .select('*', { count: 'exact', head: true })
        .eq('distribution_id', id);
    console.log('Themes count:', themeCount);
}

const distId = '4fdc71c9-e35a-46f0-a701-48f9f3644c07';
checkDistribution(distId);
