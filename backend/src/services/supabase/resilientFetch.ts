type ResilientFetchOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  retryMethods?: string[];
};

const DEFAULT_RETRY_METHODS = new Set(['GET', 'HEAD']);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toErrorText(error: any): string {
  const message = String(error?.message || '');
  const causeMessage = String(error?.cause?.message || '');
  const code = String(error?.code || error?.cause?.code || '');
  return `${message} ${causeMessage} ${code}`.toLowerCase();
}

function isTransientNetworkError(error: any): boolean {
  const text = toErrorText(error);
  return (
    text.includes('fetch failed') ||
    text.includes('econnreset') ||
    text.includes('enotfound') ||
    text.includes('etimedout') ||
    text.includes('eai_again') ||
    text.includes('socket hang up') ||
    text.includes('network error')
  );
}

function isRetriableStatus(status: number): boolean {
  if (status === 408 || status === 429) {
    return true;
  }
  if (status >= 500 && status <= 504) {
    return true;
  }
  return status >= 520 && status <= 524;
}

function resolveMethod(input: any, init?: RequestInit): string {
  const initMethod = String(init?.method || '').toUpperCase();
  if (initMethod) {
    return initMethod;
  }
  if (typeof Request !== 'undefined' && input instanceof Request) {
    return String(input.method || 'GET').toUpperCase();
  }
  return 'GET';
}

export function createResilientFetch(options?: ResilientFetchOptions): any {
  const maxAttempts = Math.max(1, options?.maxAttempts ?? 3);
  const baseDelayMs = Math.max(0, options?.baseDelayMs ?? 160);
  const retryMethods = new Set(
    (options?.retryMethods ?? Array.from(DEFAULT_RETRY_METHODS)).map((method) => String(method || '').toUpperCase())
  );

  return async (input: any, init?: RequestInit): Promise<any> => {
    const method = resolveMethod(input, init);
    const canRetryByMethod = retryMethods.has(method);

    let lastError: any = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await fetch(input as any, init);

        if (!canRetryByMethod || !isRetriableStatus(response.status) || attempt >= maxAttempts) {
          return response;
        }

        const jitter = Math.floor(Math.random() * 70);
        const delay = baseDelayMs * Math.pow(2, attempt - 1) + jitter;
        await sleep(delay);
      } catch (error: any) {
        lastError = error;
        const shouldRetry = canRetryByMethod && isTransientNetworkError(error) && attempt < maxAttempts;
        if (!shouldRetry) {
          throw error;
        }

        const jitter = Math.floor(Math.random() * 70);
        const delay = baseDelayMs * Math.pow(2, attempt - 1) + jitter;
        await sleep(delay);
      }
    }

    throw lastError || new Error('Resilient fetch failed without explicit error');
  };
}

export function isTransientFetchFailure(error: any): boolean {
  return isTransientNetworkError(error);
}
