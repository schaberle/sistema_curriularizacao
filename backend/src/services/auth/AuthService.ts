import jwt from 'jsonwebtoken';
import { DatabaseService } from '../database/DatabaseService';

/**
 * AuthService - Gerencia autenticação e autorização
 *
 * Responsabilidades:
 * 1. Geração e validação de JWT
 * 2. Login de organizadores
 * 3. Verificação de tokens
 * 4. Proteção de rotas
 */
export class AuthService {
  private databaseService: DatabaseService;
  private jwtSecret: string;
  private jwtExpiration: string = '24h';

  constructor(databaseService: DatabaseService, jwtSecret: string) {
    this.databaseService = databaseService;
    this.jwtSecret = jwtSecret;
  }

  // ============================================================
  // LOGIN
  // ============================================================

  /**
   * Faz login de organizador
   */
  async login(email: string, password: string): Promise<{
    token: string;
    organizerId: string;
    email: string;
  }> {
    // 1. Buscar organizador por email
    const organizer = await this.databaseService.getOrganizerByEmail(email);

    if (!organizer) {
      throw new Error('Email ou senha inválidos');
    }

    // 2. Verificar password (em produção: usar bcrypt)
    // Nota: Implementação simplificada. Use bcrypt em produção!
    const passwordHash = this.hashPassword(password);
    const isValid = await this.databaseService.verifyOrganizerPassword(
      organizer.id,
      passwordHash
    );

    if (!isValid) {
      throw new Error('Email ou senha inválidos');
    }

    // 3. Gerar JWT
    const token = this.generateToken({
      organizerId: organizer.id,
      email: organizer.email,
    });

    return {
      token,
      organizerId: organizer.id,
      email: organizer.email,
    };
  }

  // ============================================================
  // TOKEN MANAGEMENT
  // ============================================================

  /**
   * Gera novo JWT
   */
  generateToken(payload: { organizerId: string; email: string }): string {
    return jwt.sign(payload, this.jwtSecret as string, {
      expiresIn: this.jwtExpiration,
      algorithm: 'HS256',
    } as any);
  }

  /**
   * Valida e decodifica JWT
   */
  verifyToken(token: string): { organizerId: string; email: string } {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as {
        organizerId: string;
        email: string;
        iat: number;
        exp: number;
      };

      return {
        organizerId: decoded.organizerId,
        email: decoded.email,
      };
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token expirado');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Token inválido');
      }
      throw error;
    }
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

  // ============================================================
  // PASSWORD MANAGEMENT
  // ============================================================

  /**
   * Hash de password (implementação simplificada)
   * Em produção: usar bcrypt (npm install bcrypt)
   */
  private hashPassword(password: string): string {
    // Exemplo simplificado - não use em produção!
    // Em produção: usar bcrypt.hash(password, 10)
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  /**
   * Verifica se password é válida
   */
  private verifyPassword(password: string, hash: string): boolean {
    // Exemplo simplificado - não use em produção!
    return this.hashPassword(password) === hash;
  }

  // ============================================================
  // VALIDAÇÕES
  // ============================================================

  /**
   * Valida credenciais de login
   */
  validateLoginCredentials(email: string, password: string): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Email
    if (!email || email.trim() === '') {
      errors.push('Email é obrigatório');
    } else if (!this.isValidEmail(email)) {
      errors.push('Email inválido');
    }

    // Password
    if (!password || password.trim() === '') {
      errors.push('Senha é obrigatória');
    } else if (password.length < 6) {
      errors.push('Senha deve ter no mínimo 6 caracteres');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Valida formato de email
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // ============================================================
  // PERMISSÕES
  // ============================================================

  /**
   * Verifica se organizador tem acesso a uma distribuição
   * (para garantir que organizador só acessa sua própria distribuição)
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
