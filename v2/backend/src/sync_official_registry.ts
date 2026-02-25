import dotenv from 'dotenv';
import { DatabaseService } from './services/database/DatabaseService';
import { OfficialStudentRegistryService } from './services/registry/OfficialStudentRegistryService';

dotenv.config();

async function run(): Promise<void> {
  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim();
  const serviceKey = String(process.env.SUPABASE_SERVICE_KEY || '').trim();

  if (!supabaseUrl || !serviceKey) {
    throw new Error('SUPABASE_URL e SUPABASE_SERVICE_KEY sao obrigatorias');
  }

  const database = new DatabaseService(supabaseUrl, serviceKey);
  const registryService = new OfficialStudentRegistryService(database);
  const result = await registryService.syncAllDistributions();

  // Saida estruturada para auditoria/CI.
  console.log(JSON.stringify({
    event: 'official_registry_sync_all_completed',
    timestamp: new Date().toISOString(),
    ...result,
  }));
}

run().catch((error: any) => {
  console.error(JSON.stringify({
    event: 'official_registry_sync_all_failed',
    timestamp: new Date().toISOString(),
    error: String(error?.message || error),
  }));
  process.exit(1);
});
