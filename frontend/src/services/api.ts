import axios, { AxiosInstance, AxiosError } from 'axios';

/**
 * API Client - Cliente HTTP para comunicação com backend
 *
 * Responsabilidades:
 * 1. Configurar cliente Axios
 * 2. Adicionar interceptadores (auth, erro)
 * 3. Fornecer métodos tipados para cada rota
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

class APIClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Interceptador: adicionar token JWT às requisições
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Interceptador: tratar erros
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Token expirado, logout
          localStorage.removeItem('token');
          localStorage.removeItem('organizerId');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // ============================================================
  // AUTH
  // ============================================================

  async login(email: string, password: string) {
    const response = await this.client.post('/api/auth/login', {
      email,
      password,
    });
    return response.data;
  }

  async verifyToken() {
    const response = await this.client.get('/api/auth/verify');
    return response.data;
  }

  // ============================================================
  // STUDENTS
  // ============================================================

  async registerStudent(distributionId: string, name: string, course: string, phase: number) {
    const response = await this.client.post(
      `/api/students/${distributionId}`,
      {
        name,
        course,
        phase,
      }
    );
    return response.data;
  }

  async updateStudentPreferences(studentId: string, preferences: Array<{ themeId: string; rank: number }>) {
    const response = await this.client.put(
      `/api/students/${studentId}/preferences`,
      { preferences }
    );
    return response.data;
  }

  async getStudent(studentId: string) {
    const response = await this.client.get(`/api/students/${studentId}`);
    return response.data;
  }

  // ============================================================
  // THEMES (PUBLIC)
  // ============================================================

  async getThemes(distributionId: string) {
    const response = await this.client.get(
      `/api/themes/${distributionId}`
    );
    return response.data;
  }

  // ============================================================
  // SEARCH (PUBLIC)
  // ============================================================

  async searchStudent(name: string, distributionId: string) {
    const response = await this.client.get('/api/search', {
      params: {
        name,
        distributionId,
      },
    });
    return response.data;
  }

  // ============================================================
  // ORGANIZER
  // ============================================================

  async createDistribution() {
    const response = await this.client.post('/api/organizer/distributions');
    return response.data;
  }

  async uploadThemes(distributionId: string, themes: Array<{ name: string; description: string; maxGroups: number }>) {
    const response = await this.client.post(
      `/api/organizer/distributions/${distributionId}/themes`,
      { themes }
    );
    return response.data;
  }

  async executeDistribution(distributionId: string) {
    const response = await this.client.post(
      `/api/organizer/distributions/${distributionId}/execute`
    );
    return response.data;
  }

  async getDistributionResults(distributionId: string) {
    const response = await this.client.get(
      `/api/organizer/distributions/${distributionId}/results`
    );
    return response.data;
  }

  // ============================================================
  // HEALTH
  // ============================================================

  async healthCheck() {
    try {
      const response = await this.client.get('/health');
      return response.data;
    } catch {
      return null;
    }
  }
}

export default new APIClient();
