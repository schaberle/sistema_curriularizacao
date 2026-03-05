export class StudentReauthRequiredError extends Error {
  readonly code = 'STUDENT_REAUTH_REQUIRED';

  constructor(message = 'Sessao de aluno expirada. Autenticacao necessaria.') {
    super(message);
    this.name = 'StudentReauthRequiredError';
  }
}

interface StudentAuthRecoveryOptions {
  runRefresh: () => Promise<boolean>;
  clearLocalSession: () => Promise<void>;
  onReauthRequired: (reason: string) => void;
}

export class StudentAuthRecovery {
  private refreshPromise: Promise<boolean> | null = null;
  private sessionTerminated = false;
  private readonly runRefresh: () => Promise<boolean>;
  private readonly clearLocalSession: () => Promise<void>;
  private readonly onReauthRequired: (reason: string) => void;

  constructor(options: StudentAuthRecoveryOptions) {
    this.runRefresh = options.runRefresh;
    this.clearLocalSession = options.clearLocalSession;
    this.onReauthRequired = options.onReauthRequired;
  }

  isTerminated(): boolean {
    return this.sessionTerminated;
  }

  shouldBlockRequest(url?: string): boolean {
    if (!this.sessionTerminated) {
      return false;
    }

    const normalized = String(url || '').toLowerCase();
    return (
      normalized.includes('/api/students/me') ||
      normalized.includes('/api/auth/refresh') ||
      normalized.includes('/api/auth/logout')
    );
  }

  async refreshSingleFlight(): Promise<boolean> {
    if (this.sessionTerminated) {
      return false;
    }

    if (!this.refreshPromise) {
      this.refreshPromise = this.runRefresh()
        .then(async (ok) => {
          if (!ok) {
            await this.terminate('refresh_failed');
            return false;
          }
          return true;
        })
        .catch(async () => {
          await this.terminate('refresh_failed');
          return false;
        })
        .finally(() => {
          this.refreshPromise = null;
        });
    }

    return this.refreshPromise;
  }

  async terminate(reason: string): Promise<void> {
    if (this.sessionTerminated) {
      return;
    }

    this.sessionTerminated = true;

    try {
      await this.clearLocalSession();
    } catch {
      // noop
    }

    this.onReauthRequired(reason);
  }
}
