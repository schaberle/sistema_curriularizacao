import { ThemeData } from './types';

/**
 * Classe Theme - Representa um tema/projeto da atividade.
 *
 * Um tema tem:
 * - ID unico
 * - Nome e descricao
 * - Peso de proporcao para distribuicao de grupos
 * - Timestamp de criacao
 */
export class Theme {
  id: string;
  distributionId: string;
  name: string;
  description?: string;
  groupProportion: number;
  createdAt: Date;
  updatedAt: Date;

  /**
   * Constructor
   * @param id ID unico do tema (UUID ou slug)
   * @param distributionId ID da distribuicao a que pertence
   * @param name Nome do tema
   * @param groupProportion Peso proporcional para distribuicao de grupos
   * @param description Descricao opcional
   */
  constructor(
    id: string,
    distributionId: string,
    name: string,
    groupProportion: number,
    description?: string,
    createdAt: Date = new Date(),
    updatedAt: Date = new Date()
  ) {
    if (!id || id.trim() === '') {
      throw new Error('ID do tema nao pode estar vazio');
    }
    if (!distributionId || distributionId.trim() === '') {
      throw new Error('ID da distribuicao nao pode estar vazio');
    }
    if (!name || name.trim() === '') {
      console.warn(`[WARN] TEMA SEM NOME DETECTADO. ID: ${id}. Usando placeholder.`);
      name = `Tema ${id.substring(0, 8)}`;
    }
    if (!Number.isInteger(groupProportion) || groupProportion < 1) {
      throw new Error(`groupProportion deve ser um inteiro >= 1, recebeu: ${groupProportion}`);
    }

    this.id = id;
    this.distributionId = distributionId;
    this.name = name.trim();
    this.groupProportion = groupProportion;
    this.description = description?.trim();
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  /**
   * Obtem representacao string do tema.
   */
  toString(): string {
    return `${this.name} (${this.id}) - Peso ${this.groupProportion}`;
  }

  /**
   * Obtem representacao JSON.
   */
  toJSON() {
    return {
      id: this.id,
      distributionId: this.distributionId,
      name: this.name,
      description: this.description,
      groupProportion: this.groupProportion,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Cria Theme a partir de dados do banco.
   */
  static fromData(data: ThemeData): Theme {
    const rawGroupProportion =
      Number.isFinite(Number(data.group_proportion))
        ? Number(data.group_proportion)
        : Number(data.max_groups);

    return new Theme(
      data.id,
      data.distribution_id,
      data.name,
      Number.isInteger(rawGroupProportion) && rawGroupProportion > 0 ? rawGroupProportion : 1,
      data.description,
      new Date(data.created_at),
      new Date(data.updated_at)
    );
  }
}
