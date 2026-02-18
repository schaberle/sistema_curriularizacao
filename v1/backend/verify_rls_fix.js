
// Script to test backend RLS fix for student preferences
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY; // Using ANON as backend does

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testPreferences() {
    console.log('Testing Student Preferences RLS Fix...');

    // 1. Create a dummy student
    const { data: student, error: createError } = await supabase
        .from('students')
        .insert({
            name: 'RLS Test Student',
            course: 'EE',
            phase: 1,
            distribution_id: 'b46e565c-2f5b-4176-b20c-477e0d193a77' // Valid ID from DB
        })
        .select()
        .single();

    if (createError) {
        console.error('Error creating student:', createError);
        // Try to fetch existing if create fails (maybe unique constraint or something, though not expected here)
        return;
    }

    console.log('Student created:', student.id);

    // 2. Insert preferences
    const { error: prefError } = await supabase
        .from('student_preferences')
        .insert([
            { student_id: student.id, theme_id: '00000000-0000-0000-0000-000000000000', rank: 1 } // Fake theme ID, might fail FK if strict, but we want to test RLS
        ]);

    // We expect FK error or success, but NOT RLS error
    if (prefError) {
        if (prefError.code === '42501') {
            console.error('FAIL: RLS Violation still present!');
        } else {
            console.log('Success (RLS passed):', prefError.message); // Likely FK error, which means RLS passed
        }
    } else {
        console.log('Success: Preferences inserted!');
    }

    // 3. Clean up
    await supabase.from('students').delete().eq('id', student.id);
    console.log('Cleanup complete.');
}

testPreferences();
