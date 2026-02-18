import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DatabaseService } from '../database/DatabaseService';
import { createResilientFetch, isTransientFetchFailure } from '../supabase/resilientFetch';

/**
 * AuthService - Gerencia autenticacao via Supabase
 */
export class AuthService {
  private databaseService: DatabaseService;
  private supabase: SupabaseClient;
  private readonly authRetryMaxAttempts = 3;
  private readonly authRetryBaseDelayMs = 140;
  private readonly authCacheTtlMs = 60_000;
  private readonly authCacheMaxSize = 2000;
  private readonly inFlightVerification = new Map<string, Promise<{ organizerId: string; email: string }>>();
  private readonly tokenCache = new Map<string, {
    organizerId: string;
    email: string;
    expiresAt: number;
  }>();

  constructor(
    databaseService: DatabaseService,
    supabaseUrl: string,
    supabaseServiceKey: string
  ) {
    this.databaseService = databaseService;
    this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        fetch: createResilientFetch({
          maxAttempts: this.authRetryMaxAttempts,
          baseDelayMs: this.authRetryBaseDelayMs,
          retryMethods: ['GET', 'HEAD'],
        }),
      },
    });
  }

  private async wait(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async getUserWithRetry(token: string): Promise<{ user: any; error: any }> {
    let lastError: any = null;

    for (let attempt = 1; attempt <= this.authRetryMaxAttempts; attempt += 1) {
      try {
        const response = await this.supabase.auth.getUser(token);
        return {
          user: response.data?.user,
          error: response.error,
        };
      } catch (error: any) {
        lastError = error;
        const canRetry = isTransientFetchFailure(error) && attempt < this.authRetryMaxAttempts;
        if (!canRetry) {
          break;
        }

        const jitter = Math.floor(Math.random() * 60);
        const delay = this.authRetryBaseDelayMs * Math.pow(2, attempt - 1) + jitter;
        await this.wait(delay);
      }
    }

    if (lastError) {
      throw lastError;
    }

    return { user: null, error: null };
  }

  /**
   * Verifica validade do token chamando Supabase
   */
  async verifyToken(token: string): Promise<{ organizerId: string; email: string }> {
    const inFlight = this.inFlightVerification.get(token);
    if (inFlight) {
      return inFlight;
    }

    const verificationPromise = this.verifyTokenInternal(token);
    this.inFlightVerification.set(token, verificationPromise);

    try {
      return await verificationPromise;
    } finally {
      this.inFlightVerification.delete(token);
    }
  }

  private async verifyTokenInternal(token: string): Promise<{ organizerId: string; email: string }> {
    const now = Date.now();
    const cachedAuth = this.tokenCache.get(token);
    if (cachedAuth && cachedAuth.expiresAt > now) {
      return {
        organizerId: cachedAuth.organizerId,
        email: cachedAuth.email,
      };
    }
    if (cachedAuth) {
      this.tokenCache.delete(token);
    }

    let user: any = null;
    let error: any = null;

    try {
      const result = await this.getUserWithRetry(token);
      user = result.user;
      error = result.error;
    } catch (networkError: any) {
      if (isTransientFetchFailure(networkError)) {
        const transientError: any = new Error('Provedor de autenticacao indisponivel temporariamente');
        transientError.name = 'AuthNetworkError';
        transientError.cause = networkError;
        throw transientError;
      }
      throw networkError;
    }

    if (error || !user || !user.email) {
      this.tokenCache.delete(token);
      throw new Error('Token invalido ou expirado');
    }

    const authPayload = {
      organizerId: user.id,
      email: user.email,
    };

    if (this.tokenCache.size >= this.authCacheMaxSize) {
      this.tokenCache.clear();
    }
    this.tokenCache.set(token, {
      organizerId: authPayload.organizerId,
      email: authPayload.email,
      expiresAt: now + this.authCacheTtlMs,
    });

    return authPayload;
  }

  /**
   * Extrai token do header Authorization
   */
  extractTokenFromHeader(authHeader: string | undefined): string {
    if (!authHeader) {
      throw new Error('Header Authorization nao fornecido');
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      throw new Error('Formato de Authorization invalido');
    }

    return parts[1];
  }

  /**
   * Verifica se organizador tem acesso a uma distribuicao
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
