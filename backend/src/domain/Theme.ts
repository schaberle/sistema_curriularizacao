import { ThemeData } from './types';

/**
 * Classe Theme - Representa um tema/projeto da atividade
 *
 * Um tema tem:
 * - ID único
 * - Nome e descrição
 * - Número máximo de grupos permitidos
 * - Timestamp de criação
 */
export class Theme {
  id: string;
  distributionId: string;
  name: string;
  description?: string;
  maxGroups: number;
  createdAt: Date;
  updatedAt: Date;

  /**
   * Constructor
   * @param id ID único do tema (UUID ou slug)
   * @param distributionId ID da distribuição a que pertence
   * @param name Nome do tema
   * @param maxGroups Número máximo de grupos que podem escolher este tema
   * @param description Descrição opcional
   */
  constructor(
    id: string,
    distributionId: string,
    name: string,
    maxGroups: number,
    description?: string,
    createdAt: Date = new Date(),
    updatedAt: Date = new Date()
  ) {
    if (!id || id.trim() === '') {
      throw new Error('ID do tema não pode estar vazio');
    }
    if (!distributionId || distributionId.trim() === '') {
      throw new Error('ID da distribuição não pode estar vazio');
    }
    if (!name || name.trim() === '') {
      throw new Error('Nome do tema não pode estar vazio');
    }
    if (!Number.isInteger(maxGroups) || maxGroups < 1) {
      throw new Error(`maxGroups deve ser um inteiro >= 1, recebeu: ${maxGroups}`);
    }

    this.id = id;
    this.distributionId = distributionId;
    this.name = name.trim();
    this.maxGroups = maxGroups;
    this.description = description?.trim();
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  /**
   * Obtém representação string do tema
   */
  toString(): string {
    return `${this.name} (${this.id}) - Max ${this.maxGroups} grupos`;
  }

  /**
   * Obtém representação JSON
   */
  toJSON() {
    return {
      id: this.id,
      distributionId: this.distributionId,
      name: this.name,
      description: this.description,
      maxGroups: this.maxGroups,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Cria Theme a partir de dados do banco
   */
  static fromData(data: ThemeData): Theme {
    return new Theme(
      data.id,
      data.distribution_id,
      data.name,
      data.max_groups,
      data.description,
      new Date(data.created_at),
      new Date(data.updated_at)
    );
  }
}
