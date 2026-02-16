import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DatabaseService } from '../database/DatabaseService';

/**
 * AuthService - Gerencia autenticação via Supabase
 */
export class AuthService {
  private databaseService: DatabaseService;
  private supabase: SupabaseClient;

  constructor(
    databaseService: DatabaseService,
    supabaseUrl: string,
    supabaseServiceKey: string
  ) {
    this.databaseService = databaseService;
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  /**
   * Verifica validade do token chamando Supabase
   */
  async verifyToken(token: string): Promise<{ organizerId: string; email: string }> {
    const { data: { user }, error } = await this.supabase.auth.getUser(token);

    if (error || !user || !user.email) {
      throw new Error('Token inválido ou expirado');
    }

    return {
      organizerId: user.id,
      email: user.email,
    };
  }

  /**
   * Extrai token do header Authorization
   */
  extractTokenFromHeader(authHeader: string | undefined): string {
    if (!authHeader) {
      throw new Error('Header Authorization não fornecido');
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      throw new Error('Formato de Authorization inválido');
    }

    return parts[1];
  }

  /**
   * Verifica se organizador tem acesso a uma distribuição
   */
  async canAccessDistribution(
    organizerId: string,
    distributionId: string
  ): Promise<boolean> {
    const distribution = await this.databaseService.getDistribution(distributionId);

    if (!distribution) {
      return false;
    }

    return distribution.organizer_id === organizerId;
  }
}
