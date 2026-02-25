import crypto from 'crypto';

function normalizeText(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeMatricula(value: string): string {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function hashMatricula(matricula: string, pepper: string): string {
  return crypto
    .createHash('sha256')
    .update(`${normalizeMatricula(matricula)}:${pepper}`)
    .digest('hex');
}

/**
 * Gera UUID deterministico para aluno operacional a partir da matricula hash.
 * Mantem idempotencia na materializacao da lista oficial em `students`.
 */
export function buildOperationalStudentId(
  distributionId: string,
  matriculaHash: string
): string {
  const seed = `${String(distributionId || '').toLowerCase()}:${String(matriculaHash || '').toLowerCase()}`;
  const digest = crypto.createHash('sha1').update(seed).digest('hex').slice(0, 32).split('');

  // UUIDv5-like: fixa version e variant para formato UUID valido.
  digest[12] = '5';
  const variantNibble = parseInt(digest[16], 16);
  digest[16] = ((variantNibble & 0x3) | 0x8).toString(16);

  return [
    digest.slice(0, 8).join(''),
    digest.slice(8, 12).join(''),
    digest.slice(12, 16).join(''),
    digest.slice(16, 20).join(''),
    digest.slice(20, 32).join(''),
  ].join('-');
}

export function isAutomacaoOrigin(origemAluno: string): boolean {
  const normalized = normalizeText(origemAluno);
  return normalized.includes('CONTROLE') && normalized.includes('AUTOMACAO');
}

export function mapOrigemAlunoToCourse(origemAluno: string): 'EE' | 'ME' | null {
  const normalized = normalizeText(origemAluno);
  if (normalized.includes('ELETRICA')) {
    return 'EE';
  }
  if (normalized.includes('MECANICA')) {
    return 'ME';
  }
  return null;
}

export function normalizeHeaderKey(value: string): string {
  return normalizeText(value);
}
