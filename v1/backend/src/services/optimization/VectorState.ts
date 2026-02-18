import { AffinityMatrix } from '../../domain/AffinityMatrix';
import { Group, Student, Theme } from '../../domain';

export type VectorStateConfig = {
  eta?: number;
  prefWeight?: number;
  groupWeight?: number;
  phaseRepulsionWeight?: number;
  socialWeight?: number;
  collisionRadius?: number;
  collisionStrength?: number;
  collisionPasses?: number;
  velocityDamping?: number;
  maxStep?: number;
};

export type ProjectionMode = 'theme_axes' | 'energy_components';

export type ProjectionWeights = {
  wPref?: number;
  wDup?: number;
  wDiv?: number;
  wSoc?: number;
};

export type ProjectionOptions = {
  mode?: ProjectionMode;
  weights?: ProjectionWeights;
  affinityMatrix?: AffinityMatrix;
};

export type VectorStateSnapshot = {
  themeIds: string[];
  vectors: Record<string, number[]>;
  velocities?: Record<string, number[]>;
};

const SCORE_TABLE = [100, 70, 50, 35, 25, 18, 12, 8];

export class VectorState {
  private themeIds: string[];
  private themeIndexById: Map<string, number>;
  private vectorsByStudentId: Map<string, number[]>;
  private velocitiesByStudentId: Map<string, number[]>;

  constructor(
    themeIds: string[],
    vectorsByStudentId?: Map<string, number[]>,
    velocitiesByStudentId?: Map<string, number[]>
  ) {
    this.themeIds = [...themeIds];
    this.themeIndexById = new Map(this.themeIds.map((themeId, index) => [themeId, index]));
    this.vectorsByStudentId = vectorsByStudentId ? new Map(vectorsByStudentId) : new Map();
    this.velocitiesByStudentId = velocitiesByStudentId ? new Map(velocitiesByStudentId) : new Map();
  }

  static fromStudents(students: Student[], themes: Theme[]): VectorState {
    const themeIds = themes.map((theme) => theme.id);
    const vectorsByStudentId = new Map<string, number[]>();
    const velocitiesByStudentId = new Map<string, number[]>();

    for (const student of students) {
      const rawScores = themeIds.map((themeId) => this.rankToRawScore(this.getRankPosition(student, themeId, themeIds.length)));
      const min = Math.min(...rawScores);
      const max = Math.max(...rawScores);
      const normalized = rawScores.map((score) => {
        if (max === min) {
          return 0.5;
        }
        return Math.max(0, Math.min(1, (score - min) / (max - min)));
      });

      vectorsByStudentId.set(student.id, normalized);
      velocitiesByStudentId.set(student.id, new Array(themeIds.length).fill(0));
    }

    return new VectorState(themeIds, vectorsByStudentId, velocitiesByStudentId);
  }

  static fromSnapshot(snapshot: VectorStateSnapshot): VectorState {
    const vectorsByStudentId = new Map(Object.entries(snapshot.vectors).map(([studentId, vector]) => [studentId, [...vector]]));
    const velocitiesByStudentId = new Map(
      Object.entries(snapshot.velocities || {}).map(([studentId, velocity]) => [studentId, [...velocity]])
    );
    return new VectorState(snapshot.themeIds, vectorsByStudentId, velocitiesByStudentId);
  }

  toSnapshot(): VectorStateSnapshot {
    const vectors: Record<string, number[]> = {};
    const velocities: Record<string, number[]> = {};

    for (const [studentId, vector] of this.vectorsByStudentId.entries()) {
      vectors[studentId] = [...vector];
    }

    for (const [studentId, velocity] of this.velocitiesByStudentId.entries()) {
      velocities[studentId] = [...velocity];
    }

    return {
      themeIds: [...this.themeIds],
      vectors,
      velocities,
    };
  }

  getThemeIds(): string[] {
    return [...this.themeIds];
  }

  getVector(studentId: string): number[] {
    const vector = this.vectorsByStudentId.get(studentId);
    if (!vector) {
      const zero = new Array(this.themeIds.length).fill(0);
      this.vectorsByStudentId.set(studentId, zero);
      return [...zero];
    }
    return [...vector];
  }

  setVector(studentId: string, vector: number[]): void {
    const normalized = vector.slice(0, this.themeIds.length).map((value) => this.clamp01(value));
    while (normalized.length < this.themeIds.length) {
      normalized.push(0);
    }
    this.vectorsByStudentId.set(studentId, normalized);

    if (!this.velocitiesByStudentId.has(studentId)) {
      this.velocitiesByStudentId.set(studentId, new Array(this.themeIds.length).fill(0));
    }
  }

  projectTo3D(
    axisThemeIds: [string, string, string],
    students: Student[],
    groups?: Group[],
    options?: ProjectionOptions
  ): Array<{
    studentId: string;
    name: string;
    course: string;
    phase: number;
    x: number;
    y: number;
    z: number;
    groupId?: string;
  }> {
    if (options?.mode === 'energy_components') {
      return this.projectToEnergyComponents3D(students, groups, options);
    }

    const axisIndexes = axisThemeIds.map((themeId) => this.themeIndexById.get(themeId) ?? -1) as [number, number, number];
    const groupByStudentId = new Map<string, string>();

    if (groups) {
      for (const group of groups) {
        for (const student of group.students) {
          groupByStudentId.set(student.id, group.id);
        }
      }
    }

    return students.map((student) => {
      const vector = this.getVector(student.id);
      const x = axisIndexes[0] >= 0 ? vector[axisIndexes[0]] : 0;
      const y = axisIndexes[1] >= 0 ? vector[axisIndexes[1]] : 0;
      const z = axisIndexes[2] >= 0 ? vector[axisIndexes[2]] : 0;

      return {
        studentId: student.id,
        name: student.name,
        course: student.course,
        phase: student.phase,
        x: this.clamp01(x),
        y: this.clamp01(y),
        z: this.clamp01(z),
        groupId: groupByStudentId.get(student.id),
      };
    });
  }

  private projectToEnergyComponents3D(
    students: Student[],
    groups?: Group[],
    options?: ProjectionOptions
  ): Array<{
    studentId: string;
    name: string;
    course: string;
    phase: number;
    x: number;
    y: number;
    z: number;
    groupId?: string;
  }> {
    const wPref = Number.isFinite(Number(options?.weights?.wPref)) ? Number(options?.weights?.wPref) : 1.0;
    const wDup = Number.isFinite(Number(options?.weights?.wDup)) ? Number(options?.weights?.wDup) : 0.9;
    const wDiv = Number.isFinite(Number(options?.weights?.wDiv)) ? Number(options?.weights?.wDiv) : 0.35;
    const wSoc = Number.isFinite(Number(options?.weights?.wSoc)) ? Number(options?.weights?.wSoc) : 1.0;
    const affinityMatrix = options?.affinityMatrix;

    const groupByStudentId = new Map<string, Group>();
    if (groups) {
      for (const group of groups) {
        for (const student of group.students) {
          groupByStudentId.set(student.id, group);
        }
      }
    }

    const rows = students.map((student) => {
      const group = groupByStudentId.get(student.id);
      const vector = this.getVector(student.id);
      const fallbackPref = vector.length > 0 ? vector.reduce((sum, value) => sum + value, 0) / vector.length : 0;

      let xRaw = fallbackPref;
      let yRaw = 0;
      let zRaw = 0;

      if (group) {
        const normalizedPref = this.getNormalizedThemeScore(student, group.themeId);
        const ePrefStudent = -wPref * normalizedPref;
        xRaw = -ePrefStudent;

        const withPhaseEnergy = this.calculatePhaseEnergyForStudents(group.students, wDup, wDiv);
        const withoutPhaseEnergy = this.calculatePhaseEnergyForStudents(
          group.students.filter((member) => member.id !== student.id),
          wDup,
          wDiv
        );
        const eFaseStudent = withPhaseEnergy - withoutPhaseEnergy;
        yRaw = -eFaseStudent;

        if (affinityMatrix) {
          let cohesionWithPeers = 0;
          for (const peer of group.students) {
            if (peer.id === student.id) {
              continue;
            }
            cohesionWithPeers += affinityMatrix.get(student.id, peer.id);
          }
          const eSocStudent = -wSoc * cohesionWithPeers;
          zRaw = -eSocStudent;
        }
      }

      return {
        student,
        groupId: group?.id,
        xRaw,
        yRaw,
        zRaw,
      };
    });

    const xNorm = this.normalizeAxis(rows.map((row) => row.xRaw));
    const yNorm = this.normalizeAxis(rows.map((row) => row.yRaw));
    const zNorm = this.normalizeAxis(rows.map((row) => row.zRaw), true);

    return rows.map((row, index) => ({
      studentId: row.student.id,
      name: row.student.name,
      course: row.student.course,
      phase: row.student.phase,
      x: xNorm[index],
      y: yNorm[index],
      z: zNorm[index],
      groupId: row.groupId,
    }));
  }

  calculateGroupCompactness(group: Group): number {
    const memberIds = group.students.map((student) => student.id);
    return this.calculateCompactnessByStudentIds(memberIds);
  }

  calculateGroupsCompactness(groups: Group[]): number {
    let total = 0;
    for (const group of groups) {
      total += this.calculateGroupCompactness(group);
    }
    return total;
  }

  calculateCompactnessByStudentIds(studentIds: string[]): number {
    if (studentIds.length <= 1) {
      return 0;
    }

    const centroid = this.calculateCentroid(studentIds);
    let totalDistance = 0;

    for (const studentId of studentIds) {
      const vector = this.getVector(studentId);
      totalDistance += this.squaredDistance(vector, centroid);
    }

    return totalDistance / studentIds.length;
  }

  applyDynamics(
    groups: Group[],
    phase: 'phase1' | 'phase2',
    config?: VectorStateConfig,
    affinityMatrix?: AffinityMatrix
  ): void {
    if (!groups.length) {
      return;
    }

    const eta = config?.eta ?? 0.08;
    const prefWeight = config?.prefWeight ?? 0.9;
    const groupWeight = config?.groupWeight ?? 0.75;
    const phaseRepulsionWeight = config?.phaseRepulsionWeight ?? 0.2;
    const socialWeight = config?.socialWeight ?? 0.35;
    const collisionRadius = config?.collisionRadius ?? 0.08;
    const collisionStrength = config?.collisionStrength ?? 0.85;
    const collisionPasses = Math.max(1, config?.collisionPasses ?? 2);
    const velocityDamping = config?.velocityDamping ?? 0.78;
    const maxStep = config?.maxStep ?? 0.05;

    const activeStudents = this.collectActiveStudents(groups);
    const groupByStudentId = new Map<string, Group>();
    for (const group of groups) {
      for (const student of group.students) {
        groupByStudentId.set(student.id, group);
      }
    }

    const nextVectors = new Map<string, number[]>();
    const nextVelocities = new Map<string, number[]>();

    for (const student of activeStudents) {
      const currentVector = this.getVector(student.id);
      const currentVelocity = this.getVelocity(student.id);
      const force = new Array(this.themeIds.length).fill(0);
      const group = groupByStudentId.get(student.id);

      if (group) {
        const memberIds = group.students.map((member) => member.id);
        const centroid = this.calculateCentroid(memberIds);
        const themeIndex = this.themeIndexById.get(group.themeId) ?? -1;

        if (themeIndex >= 0) {
          const prefTarget = new Array(this.themeIds.length).fill(0);
          prefTarget[themeIndex] = 1;
          this.accumulateAttractionField(force, currentVector, prefTarget, prefWeight);
        }

        this.accumulateAttractionField(force, currentVector, centroid, groupWeight);

        const samePhasePeers = group.students.filter((peer) => peer.id !== student.id && peer.phase === student.phase);
        for (const peer of samePhasePeers) {
          const peerVector = this.getVector(peer.id);
          this.accumulateRepulsionField(
            force,
            currentVector,
            peerVector,
            phaseRepulsionWeight / Math.max(1, samePhasePeers.length)
          );
        }

        if (phase === 'phase2' && affinityMatrix) {
          for (const peer of group.students) {
            if (peer.id === student.id) {
              continue;
            }
            const affinity = affinityMatrix.get(student.id, peer.id);
            if (affinity === 0) {
              continue;
            }
            const peerVector = this.getVector(peer.id);
            if (affinity > 0) {
              this.accumulateAttractionField(force, currentVector, peerVector, socialWeight * affinity);
            } else {
              this.accumulateRepulsionField(force, currentVector, peerVector, socialWeight * Math.abs(affinity));
            }
          }
        }
      }

      const acceleration = this.scale(force, eta);
      const dampedVelocity = this.scale(currentVelocity, velocityDamping);
      const integratedVelocity = this.add(dampedVelocity, acceleration);
      const boundedVelocity = this.limitMagnitude(integratedVelocity, maxStep);
      const updated = this.clampVector(this.add(currentVector, boundedVelocity));

      nextVectors.set(student.id, updated);
      nextVelocities.set(student.id, boundedVelocity);
    }

    this.resolveCollisions(nextVectors, nextVelocities, activeStudents, collisionRadius, collisionStrength, collisionPasses);

    for (const [studentId, vector] of nextVectors.entries()) {
      this.vectorsByStudentId.set(studentId, vector);
    }

    for (const [studentId, velocity] of nextVelocities.entries()) {
      this.velocitiesByStudentId.set(studentId, velocity);
    }
  }

  private collectActiveStudents(groups: Group[]): Student[] {
    const unique = new Map<string, Student>();
    for (const group of groups) {
      for (const student of group.students) {
        unique.set(student.id, student);
      }
    }
    return Array.from(unique.values());
  }

  // Magnetic-like field derived from ideal preference/diversity/social terms.
  private accumulateAttractionField(
    force: number[],
    originVector: number[],
    targetVector: number[],
    weight: number
  ): void {
    const delta = this.subtract(targetVector, originVector);
    const distance = this.norm(delta);
    if (distance <= 1e-9 || weight <= 0) {
      return;
    }
    const direction = this.scale(delta, 1 / distance);
    const field = weight / (distance + 0.05);
    this.accumulate(force, direction, field);
  }

  private accumulateRepulsionField(
    force: number[],
    originVector: number[],
    peerVector: number[],
    weight: number
  ): void {
    const delta = this.subtract(originVector, peerVector);
    const distance = this.norm(delta);
    if (distance <= 1e-9 || weight <= 0) {
      return;
    }
    const direction = this.scale(delta, 1 / distance);
    const field = weight / (distance * distance + 0.02);
    this.accumulate(force, direction, field);
  }

  private resolveCollisions(
    vectors: Map<string, number[]>,
    velocities: Map<string, number[]>,
    students: Student[],
    collisionRadius: number,
    collisionStrength: number,
    collisionPasses: number
  ): void {
    if (collisionRadius <= 0 || collisionStrength <= 0 || students.length < 2) {
      return;
    }

    for (let pass = 0; pass < collisionPasses; pass++) {
      for (let i = 0; i < students.length; i++) {
        for (let j = i + 1; j < students.length; j++) {
          const studentA = students[i];
          const studentB = students[j];
          const vectorA = vectors.get(studentA.id);
          const vectorB = vectors.get(studentB.id);

          if (!vectorA || !vectorB) {
            continue;
          }

          const delta = this.subtract(vectorB, vectorA);
          const distance = this.norm(delta);

          if (distance >= collisionRadius) {
            continue;
          }

          const direction = distance > 1e-9
            ? this.scale(delta, 1 / distance)
            : this.seededDirection(studentA.id, studentB.id, vectorA.length);

          const overlap = collisionRadius - distance;
          const correctionMagnitude = overlap * 0.5 * collisionStrength;
          const correction = this.scale(direction, correctionMagnitude);

          const correctedA = this.clampVector(this.subtract(vectorA, correction));
          const correctedB = this.clampVector(this.add(vectorB, correction));

          vectors.set(studentA.id, correctedA);
          vectors.set(studentB.id, correctedB);

          const impulse = this.scale(direction, overlap * collisionStrength * 0.25);
          const velocityA = velocities.get(studentA.id) || new Array(vectorA.length).fill(0);
          const velocityB = velocities.get(studentB.id) || new Array(vectorA.length).fill(0);

          velocities.set(studentA.id, this.limitMagnitude(this.subtract(velocityA, impulse), 0.25));
          velocities.set(studentB.id, this.limitMagnitude(this.add(velocityB, impulse), 0.25));
        }
      }
    }
  }

  private seededDirection(studentAId: string, studentBId: string, dimensions: number): number[] {
    const seed = `${studentAId}|${studentBId}`;
    const direction = new Array(Math.max(1, dimensions)).fill(0).map((_, index) => {
      let hash = 0;
      const token = `${seed}:${index}`;
      for (let i = 0; i < token.length; i++) {
        hash = ((hash << 5) - hash + token.charCodeAt(i)) | 0;
      }
      return ((hash % 2000) / 1000) - 1;
    });

    return this.normalize(direction);
  }

  private getVelocity(studentId: string): number[] {
    const velocity = this.velocitiesByStudentId.get(studentId);
    if (!velocity) {
      const zero = new Array(this.themeIds.length).fill(0);
      this.velocitiesByStudentId.set(studentId, zero);
      return [...zero];
    }
    return [...velocity];
  }

  private calculateCentroid(studentIds: string[]): number[] {
    if (!studentIds.length) {
      return new Array(this.themeIds.length).fill(0);
    }

    const centroid = new Array(this.themeIds.length).fill(0);
    for (const studentId of studentIds) {
      const vector = this.getVector(studentId);
      for (let i = 0; i < vector.length; i++) {
        centroid[i] += vector[i];
      }
    }
    for (let i = 0; i < centroid.length; i++) {
      centroid[i] /= studentIds.length;
    }
    return centroid;
  }

  private squaredDistance(a: number[], b: number[]): number {
    let sum = 0;
    const length = Math.min(a.length, b.length);
    for (let i = 0; i < length; i++) {
      const d = a[i] - b[i];
      sum += d * d;
    }
    return sum;
  }

  private norm(vector: number[]): number {
    return Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  }

  private subtract(a: number[], b: number[]): number[] {
    const length = Math.min(a.length, b.length);
    const result = new Array(length).fill(0);
    for (let i = 0; i < length; i++) {
      result[i] = a[i] - b[i];
    }
    return result;
  }

  private add(a: number[], b: number[]): number[] {
    const length = Math.min(a.length, b.length);
    const result = new Array(length).fill(0);
    for (let i = 0; i < length; i++) {
      result[i] = a[i] + b[i];
    }
    return result;
  }

  private scale(vector: number[], scalar: number): number[] {
    return vector.map((value) => value * scalar);
  }

  private clampVector(vector: number[]): number[] {
    return vector.map((value) => this.clamp01(value));
  }

  private limitMagnitude(vector: number[], maxMagnitude: number): number[] {
    const magnitude = this.norm(vector);
    if (magnitude <= maxMagnitude || magnitude <= 1e-9) {
      return [...vector];
    }
    return this.scale(vector, maxMagnitude / magnitude);
  }

  private normalize(vector: number[]): number[] {
    const norm = this.norm(vector);
    if (norm <= 1e-12) {
      return new Array(vector.length).fill(0);
    }
    return vector.map((value) => value / norm);
  }

  private accumulate(target: number[], source: number[], scale: number): void {
    const length = Math.min(target.length, source.length);
    for (let i = 0; i < length; i++) {
      target[i] += source[i] * scale;
    }
  }

  private calculatePhaseEnergyForStudents(students: Student[], wDup: number, wDiv: number): number {
    if (!students.length) {
      return 0;
    }

    const phaseCounts = new Map<number, number>();
    for (const student of students) {
      phaseCounts.set(student.phase, (phaseCounts.get(student.phase) || 0) + 1);
    }

    let duplicates = 0;
    for (const count of phaseCounts.values()) {
      if (count > 1) {
        duplicates += count - 1;
      }
    }

    const diversity = phaseCounts.size;
    return wDup * duplicates - wDiv * diversity;
  }

  private getNormalizedThemeScore(student: Student, themeId: string): number {
    const preferenceCount = Math.max(1, student.preferences?.length || this.themeIds.length || 8);
    const rank = VectorState.getRankPosition(student, themeId, preferenceCount);
    const rawScore = VectorState.rankToRawScore(rank);
    const minRaw = VectorState.rankToRawScore(preferenceCount);
    const maxRaw = VectorState.rankToRawScore(1);

    if (maxRaw === minRaw) {
      return 0.5;
    }

    return this.clamp01((rawScore - minRaw) / (maxRaw - minRaw));
  }

  private normalizeAxis(values: number[], forceZeroWhenFlat = false): number[] {
    if (!values.length) {
      return [];
    }

    const min = Math.min(...values);
    const max = Math.max(...values);

    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return values.map(() => 0);
    }

    if (Math.abs(max - min) <= 1e-9) {
      if (forceZeroWhenFlat) {
        return values.map(() => 0);
      }
      if (Math.abs(max) <= 1e-9) {
        return values.map(() => 0);
      }
      return values.map(() => 0.5);
    }

    return values.map((value) => this.clamp01((value - min) / (max - min)));
  }

  private static getRankPosition(student: Student, themeId: string, fallbackMaxRank: number): number {
    const rank = student.getThemeRank(themeId);
    if (rank > 0) {
      return rank;
    }
    return fallbackMaxRank + 1;
  }

  private static rankToRawScore(rank: number): number {
    if (rank < 1) {
      return 0;
    }
    if (rank <= SCORE_TABLE.length) {
      return SCORE_TABLE[rank - 1];
    }
    return Math.max(0, 8 - (rank - SCORE_TABLE.length));
  }

  private clamp01(value: number): number {
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
  }
}
