import { Request, Response, NextFunction } from 'express';

/**
 * Middleware de Validação
 *
 * Valida dados de entrada (body, params, query)
 */

/**
 * Valida dados de registro de aluno
 */
export function validateStudentRegistration(req: Request, res: Response, next: NextFunction) {
  const { name, course, phase } = req.body;
  const errors: string[] = [];

  // Nome
  if (!name || name.trim() === '') {
    errors.push('Nome é obrigatório');
  } else if (name.length > 255) {
    errors.push('Nome não pode ter mais de 255 caracteres');
  }

  // Curso
  if (!course) {
    errors.push('Curso é obrigatório');
  } else if (!['EE', 'ME'].includes(course)) {
    errors.push('Curso deve ser EE (Engenharia Elétrica) ou ME (Engenharia Mecânica)');
  }

  // Fase
  if (phase === undefined || phase === null) {
    errors.push('Fase é obrigatória');
  } else if (!Number.isInteger(phase) || phase < 1 || phase > 10) {
    errors.push('Fase deve ser um número entre 1 e 10');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validação falhou',
      details: errors,
    });
  }

  next();
}

/**
 * Valida dados de preferências de aluno
 */
export function validateStudentPreferences(req: Request, res: Response, next: NextFunction) {
  const { preferences } = req.body;
  const errors: string[] = [];

  if (!preferences || !Array.isArray(preferences)) {
    errors.push('Preferências deve ser um array');
  } else if (preferences.length === 0) {
    errors.push('Deve haver pelo menos uma preferência');
  } else {
    // Validar cada preferência
    preferences.forEach((pref: any, index: number) => {
      if (!pref.themeId || pref.themeId.trim() === '') {
        errors.push(`Preferência ${index + 1}: themeId é obrigatório`);
      }
      if (!Number.isInteger(pref.rank) || pref.rank < 1) {
        errors.push(`Preferência ${index + 1}: rank deve ser um número >= 1`);
      }
    });

    // Validar que ranks são sequenciais (1, 2, 3, ...)
    const ranks = preferences.map((p: any) => p.rank).sort((a: number, b: number) => a - b);
    for (let i = 0; i < ranks.length; i++) {
      if (ranks[i] !== i + 1) {
        errors.push('Ranks devem ser sequenciais (1, 2, 3, ...)');
        break;
      }
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validação falhou',
      details: errors,
    });
  }

  next();
}

/**
 * Valida dados de upload de temas
 */
export function validateThemeUpload(req: Request, res: Response, next: NextFunction) {
  const { themes } = req.body;
  const errors: string[] = [];

  if (!themes || !Array.isArray(themes)) {
    errors.push('Temas deve ser um array');
  } else if (themes.length === 0) {
    errors.push('Deve haver pelo menos um tema');
  } else {
    themes.forEach((theme: any, index: number) => {
      if (!theme.name || theme.name.trim() === '') {
        errors.push(`Tema ${index + 1}: nome é obrigatório`);
      }
      if (!Number.isInteger(theme.maxGroups) || theme.maxGroups < 1) {
        errors.push(`Tema ${index + 1}: maxGroups deve ser um número >= 1`);
      }
    });
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validação falhou',
      details: errors,
    });
  }

  next();
}

/**
 * Valida dados de login
 */
export function validateLoginCredentials(req: Request, res: Response, next: NextFunction) {
  const { email, password } = req.body;
  const errors: string[] = [];

  if (!email || email.trim() === '') {
    errors.push('Email é obrigatório');
  }
  if (!password || password.trim() === '') {
    errors.push('Senha é obrigatória');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validação falhou',
      details: errors,
    });
  }

  next();
}

/**
 * Valida ID de distribuição (formato UUID)
 */
export function validateDistributionId(req: Request, res: Response, next: NextFunction) {
  const distributionId = req.params.distributionId as string;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(distributionId)) {
    return res.status(400).json({
      error: 'ID de distribuição inválido',
    });
  }

  next();
}

/**
 * Valida ID de aluno (formato UUID)
 */
export function validateStudentId(req: Request, res: Response, next: NextFunction) {
  const studentId = req.params.studentId as string;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(studentId)) {
    return res.status(400).json({
      error: 'ID de aluno inválido',
    });
  }

  next();
}

/**
 * Valida parâmetro de busca (nome do aluno)
 */
export function validateSearchQuery(req: Request, res: Response, next: NextFunction) {
  const { name, distributionId } = req.query;
  const errors: string[] = [];

  if (!name || name === '') {
    errors.push('Parâmetro "name" é obrigatório');
  } else if (typeof name !== 'string' || name.length > 255) {
    errors.push('Nome deve ser uma string com máximo 255 caracteres');
  }

  if (!distributionId || distributionId === '') {
    errors.push('Parâmetro "distributionId" é obrigatório');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validação falhou',
      details: errors,
    });
  }

  next();
}

/**
 * Valida configuração de seed de dados de teste
 */
export function validateSeedConfig(req: Request, res: Response, next: NextFunction) {
  if (req.body === null || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({
      error: 'ValidaÃ§Ã£o falhou',
      details: ['Payload de seed deve ser um objeto JSON'],
    });
  }

  const { studentCount, generatePreferences, generateAffinities, affinityDensity } = req.body;
  const errors: string[] = [];

  if (studentCount !== undefined) {
    if (!Number.isInteger(studentCount) || studentCount < 4 || studentCount > 500) {
      errors.push('studentCount deve ser um inteiro entre 4 e 500');
    }
  }

  if (generatePreferences !== undefined && typeof generatePreferences !== 'boolean') {
    errors.push('generatePreferences deve ser boolean');
  }

  if (generateAffinities !== undefined && typeof generateAffinities !== 'boolean') {
    errors.push('generateAffinities deve ser boolean');
  }

  if (affinityDensity !== undefined) {
    if (typeof affinityDensity !== 'number' || affinityDensity < 0 || affinityDensity > 1) {
      errors.push('affinityDensity deve ser um número entre 0 e 1');
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validação falhou',
      details: errors,
    });
  }

  next();
}
