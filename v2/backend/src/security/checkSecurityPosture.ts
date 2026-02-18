import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

function requiredEnv(name: string): string {
  const value = (process.env[name] || '').trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

async function main() {
  const supabaseUrl = requiredEnv('SUPABASE_URL');
  const serviceKey = requiredEnv('SUPABASE_SERVICE_KEY');
  const client = createClient(supabaseUrl, serviceKey);

  const [rlsViolations, permissivePolicies, grantViolations] = await Promise.all([
    client.from('security_rls_violations').select('*'),
    client.from('security_permissive_write_policy_violations').select('*'),
    client.from('security_grant_violations').select('*'),
  ]);

  if (rlsViolations.error) {
    throw rlsViolations.error;
  }
  if (permissivePolicies.error) {
    throw permissivePolicies.error;
  }
  if (grantViolations.error) {
    throw grantViolations.error;
  }

  const errors: string[] = [];
  if ((rlsViolations.data || []).length > 0) {
    errors.push(`RLS violations: ${(rlsViolations.data || []).length}`);
  }
  if ((permissivePolicies.data || []).length > 0) {
    errors.push(`Permissive write policies: ${(permissivePolicies.data || []).length}`);
  }
  if ((grantViolations.data || []).length > 0) {
    errors.push(`Grant violations for anon/authenticated: ${(grantViolations.data || []).length}`);
  }

  if (errors.length > 0) {
    console.error('Security posture check failed');
    for (const message of errors) {
      console.error(`- ${message}`);
    }
    process.exit(1);
  }

  console.log('Security posture check passed');
}

main().catch((error) => {
  console.error('Security posture check error:', error?.message || error);
  process.exit(1);
});
