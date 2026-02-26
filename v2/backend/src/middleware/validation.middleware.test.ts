import { Request, Response, NextFunction } from 'express';
import {
  validateStudentRegistration,
  validateStudentPreferences,
  validateThemeUpload,
  validateLoginCredentials,
  validateSearchQuery,
} from './validation.middleware';

describe('Validation Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let jsonResponse: any;

  beforeEach(() => {
    jsonResponse = null;

    mockReq = {
      body: {},
      query: {},
      params: {},
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockImplementation((data) => {
        jsonResponse = data;
        return mockRes;
      }),
    };

    mockNext = jest.fn();
  });

  describe('validateStudentRegistration', () => {
    it('should pass with valid student data', () => {
      mockReq.body = {
        name: 'João Silva',
        course: 'EE',
        phase: 3,
      };

      validateStudentRegistration(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should fail with missing name', () => {
      mockReq.body = {
        course: 'EE',
        phase: 3,
      };

      validateStudentRegistration(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(jsonResponse.details).toContain('Nome é obrigatório');
    });

    it('should fail with invalid course', () => {
      mockReq.body = {
        name: 'João',
        course: 'CS', // Invalid
        phase: 3,
      };

      validateStudentRegistration(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(jsonResponse.details.some((d: string) => d.includes('Curso'))).toBe(true);
    });

    it('should fail with invalid phase', () => {
      mockReq.body = {
        name: 'João',
        course: 'EE',
        phase: 15, // Out of range
      };

      validateStudentRegistration(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(jsonResponse.details.some((d: string) => d.includes('Fase'))).toBe(true);
    });

    it('should validate both EE and ME courses', () => {
      mockReq.body = {
        name: 'Maria',
        course: 'ME',
        phase: 5,
      };

      validateStudentRegistration(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('validateStudentPreferences', () => {
    it('should pass with valid preferences', () => {
      mockReq.body = {
        preferences: [
          { themeId: 'tema_a', rank: 1 },
          { themeId: 'tema_b', rank: 2 },
          { themeId: 'tema_c', rank: 3 },
        ],
      };

      validateStudentPreferences(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should fail with empty preferences array', () => {
      mockReq.body = {
        preferences: [],
      };

      validateStudentPreferences(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should fail with missing themeId', () => {
      mockReq.body = {
        preferences: [
          { rank: 1 }, // Missing themeId
        ],
      };

      validateStudentPreferences(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should fail with non-sequential ranks', () => {
      mockReq.body = {
        preferences: [
          { themeId: 'tema_a', rank: 1 },
          { themeId: 'tema_b', rank: 3 }, // Skips 2
        ],
      };

      validateStudentPreferences(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(jsonResponse.details.some((d: string) => d.includes('sequenciais'))).toBe(true);
    });
  });

  describe('validateThemeUpload', () => {
    it('should pass with valid themes', () => {
      mockReq.body = {
        themes: [
          { name: 'Tema A', description: 'Descrição A', groupProportion: 2 },
          { name: 'Tema B', description: 'Descrição B', groupProportion: 3 },
        ],
      };

      validateThemeUpload(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should pass with legacy maxGroups alias', () => {
      mockReq.body = {
        themes: [
          { name: 'Tema A', description: 'Descrição A', maxGroups: 2 },
        ],
      };

      validateThemeUpload(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should pass with default groupProportion when omitted', () => {
      mockReq.body = {
        themes: [
          { name: 'Tema A', description: 'Descrição A' },
        ],
      };

      validateThemeUpload(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should fail with empty themes array', () => {
      mockReq.body = {
        themes: [],
      };

      validateThemeUpload(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should fail with invalid groupProportion', () => {
      mockReq.body = {
        themes: [
          { name: 'Tema', description: 'Desc', groupProportion: 0 },
        ],
      };

      validateThemeUpload(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('validateLoginCredentials', () => {
    it('should pass with valid credentials', () => {
      mockReq.body = {
        email: 'test@example.com',
        password: 'password123',
      };

      validateLoginCredentials(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should fail with missing email', () => {
      mockReq.body = {
        password: 'password123',
      };

      validateLoginCredentials(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(jsonResponse.details.some((d: string) => d.includes('Email'))).toBe(true);
    });

    it('should fail with missing password', () => {
      mockReq.body = {
        email: 'test@example.com',
      };

      validateLoginCredentials(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(jsonResponse.details.some((d: string) => d.includes('Senha'))).toBe(true);
    });
  });

  describe('validateSearchQuery', () => {
    it('should pass with valid query parameters', () => {
      mockReq.query = {
        name: 'João Silva',
        distributionId: 'dist_123',
      };

      validateSearchQuery(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should fail with missing name', () => {
      mockReq.query = {
        distributionId: 'dist_123',
      };

      validateSearchQuery(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should fail with missing distributionId', () => {
      mockReq.query = {
        name: 'João Silva',
      };

      validateSearchQuery(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });
});
