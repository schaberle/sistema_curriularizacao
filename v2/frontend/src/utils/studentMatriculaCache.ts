const STORAGE_KEY = 'student_matricula_cache_v1';

type MatriculaCache = Record<string, string>;

function readCache(): MatriculaCache {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    return parsed as MatriculaCache;
  } catch {
    return {};
  }
}

function writeCache(cache: MatriculaCache): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Ignora falhas de persistencia (quota, modo privado etc.).
  }
}

export function getCachedMatricula(distributionId?: string): string {
  if (!distributionId) {
    return '';
  }

  const cache = readCache();
  return String(cache[distributionId] || '').trim();
}

export function cacheMatricula(distributionId: string, matricula: string): void {
  const normalizedMatricula = String(matricula || '').trim();
  if (!distributionId || !normalizedMatricula) {
    return;
  }

  const cache = readCache();
  cache[distributionId] = normalizedMatricula;
  writeCache(cache);
}
