import { useEffect, useMemo, useRef, useState } from 'react';
import { forceCollide, forceLink, forceManyBody, forceSimulation } from 'd3-force-3d';
import type { VisualAffinityEdge, VisualGroupPartition, VisualStudentNode } from '../../../types/distribution.types';

type GroupThemeInfo = {
  themeId?: string;
};

type LayoutNode = {
  id: string;
  groupId: string | null;
  themeId: string | null;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
};

type LayoutLink = {
  source: string;
  target: string;
  strength: number;
  distance: number;
};

type NegativeAffinityPair = {
  sourceId: string;
  targetId: string;
  weight: number;
};

const TARGET_LAYOUT_RADIUS = 3.1;
const COLLISION_RADIUS = 0.22;
const MIN_RENDER_NODE_DISTANCE = 0.42;
const MAX_VISUAL_SCALE = 2.2;

export type UseForceLayout3DParams = {
  students: VisualStudentNode[];
  partition: VisualGroupPartition;
  groupThemes: Record<string, GroupThemeInfo | undefined>;
  affinities: VisualAffinityEdge[];
  forceIntensity: number;
  isRunning: boolean;
};

function clampForceIntensity(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.max(0.2, Math.min(3, value));
}

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seedPosition(studentId: string, index: number): { x: number; y: number; z: number } {
  const hash = hashSeed(studentId) + index * 17;
  const rx = ((hash % 997) / 997) * 2 - 1;
  const ry = (((hash >> 8) % 997) / 997) * 2 - 1;
  const rz = (((hash >> 16) % 997) / 997) * 2 - 1;
  return {
    x: rx * 3.5,
    y: ry * 3.5,
    z: rz * 3.5,
  };
}

export function useForceLayout3D({
  students,
  partition,
  groupThemes,
  affinities,
  forceIntensity,
  isRunning,
}: UseForceLayout3DParams): { positionsByStudentId: Record<string, [number, number, number]>; layoutVersion: number } {
  const [layoutVersion, setLayoutVersion] = useState(0);
  const positionsRef = useRef<Record<string, [number, number, number]>>({});

  const simulationKey = useMemo(
    () =>
      JSON.stringify({
        students: students.map((student) => student.id),
        groups: partition.groups.map((group) => [group.groupId, group.studentIds]),
        assignment: partition.assignmentByStudentId,
        affinities: affinities.map((affinity) => [affinity.sourceId, affinity.targetId, affinity.value]),
        themes: Object.entries(groupThemes).map(([groupId, theme]) => [groupId, theme?.themeId ?? null]),
        forceIntensity: clampForceIntensity(forceIntensity),
        isRunning,
      }),
    [students, partition, affinities, groupThemes, forceIntensity, isRunning]
  );

  useEffect(() => {
    if (!students.length) {
      positionsRef.current = {};
      setLayoutVersion((value) => value + 1);
      return undefined;
    }

    const intensity = clampForceIntensity(forceIntensity);
    const assignment = partition.assignmentByStudentId || {};
    const nodes: LayoutNode[] = students.map((student, index) => {
      const groupId = assignment[student.id] ?? null;
      const themeId = groupId ? groupThemes[groupId]?.themeId ?? null : null;
      const seeded = seedPosition(student.id, index);
      return {
        id: student.id,
        groupId,
        themeId,
        x: seeded.x,
        y: seeded.y,
        z: seeded.z,
        vx: 0,
        vy: 0,
        vz: 0,
      };
    });

    const nodeById = new Map(nodes.map((node) => [node.id, node]));

    const groupLinks: LayoutLink[] = [];
    for (const group of partition.groups) {
      for (let index = 0; index < group.studentIds.length; index += 1) {
        for (let peer = index + 1; peer < group.studentIds.length; peer += 1) {
          groupLinks.push({
            source: group.studentIds[index],
            target: group.studentIds[peer],
            strength: 0.18 * intensity,
            distance: 1.1,
          });
        }
      }
    }

    const themeMembers = new Map<string, string[]>();
    for (const node of nodes) {
      if (!node.themeId || !node.groupId) {
        continue;
      }
      const current = themeMembers.get(node.themeId) ?? [];
      current.push(node.id);
      themeMembers.set(node.themeId, current);
    }

    const themeLinks: LayoutLink[] = [];
    for (const [themeId, memberIds] of themeMembers.entries()) {
      if (!memberIds.length) {
        continue;
      }
      for (let index = 0; index < memberIds.length; index += 1) {
        for (let peer = index + 1; peer < memberIds.length; peer += 1) {
          const memberA = nodeById.get(memberIds[index]);
          const memberB = nodeById.get(memberIds[peer]);
          if (!memberA || !memberB || memberA.groupId === memberB.groupId) {
            continue;
          }
          themeLinks.push({
            source: memberIds[index],
            target: memberIds[peer],
            strength: 0.04 * intensity,
            distance: 2.2,
          });
        }
      }
      themeMembers.set(themeId, memberIds);
    }

    const positiveAffinityLinks: LayoutLink[] = [];
    const negativeAffinityPairs: NegativeAffinityPair[] = [];
    for (const affinity of affinities) {
      if (!nodeById.has(affinity.sourceId) || !nodeById.has(affinity.targetId)) {
        continue;
      }
      if (affinity.value > 0) {
        positiveAffinityLinks.push({
          source: affinity.sourceId,
          target: affinity.targetId,
          strength: Math.max(0.02, 0.15 * affinity.value * intensity),
          distance: Math.max(0.55, 1.9 - 1.2 * affinity.value),
        });
      } else if (affinity.value < 0) {
        negativeAffinityPairs.push({
          sourceId: affinity.sourceId,
          targetId: affinity.targetId,
          weight: Math.abs(affinity.value),
        });
      }
    }

    const simulation = forceSimulation(nodes).numDimensions(3);
    simulation.alpha(1);
    simulation.alphaDecay(isRunning ? 0.025 : 0.04);
    simulation.force('charge', forceManyBody().strength(-90 * intensity));
    simulation.force(
      'group_links',
      forceLink(groupLinks)
        .id((node: LayoutNode) => node.id)
        .distance((link: LayoutLink) => link.distance)
        .strength((link: LayoutLink) => link.strength)
    );
    simulation.force(
      'affinity_positive',
      forceLink(positiveAffinityLinks)
        .id((node: LayoutNode) => node.id)
        .distance((link: LayoutLink) => link.distance)
        .strength((link: LayoutLink) => link.strength)
    );
    simulation.force(
      'theme_links',
      forceLink(themeLinks)
        .id((node: LayoutNode) => node.id)
        .distance((link: LayoutLink) => link.distance)
        .strength((link: LayoutLink) => link.strength)
    );
    simulation.force(
      'collision',
      forceCollide()
        .radius(COLLISION_RADIUS)
        .strength(0.9)
        .iterations(isRunning ? 1 : 2)
    );
    simulation.force('affinity_negative', () => {
      const kAffinity = 0.7 * intensity;
      for (const pair of negativeAffinityPairs) {
        const sourceNode = nodeById.get(pair.sourceId);
        const targetNode = nodeById.get(pair.targetId);
        if (!sourceNode || !targetNode) {
          continue;
        }
        const dx = (sourceNode.x || 0) - (targetNode.x || 0);
        const dy = (sourceNode.y || 0) - (targetNode.y || 0);
        const dz = (sourceNode.z || 0) - (targetNode.z || 0);
        const distanceSq = Math.max(1e-6, dx * dx + dy * dy + dz * dz);
        const distance = Math.sqrt(distanceSq);
        const force = (kAffinity * pair.weight) / distanceSq;
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;
        const fz = (dz / distance) * force;
        sourceNode.vx += fx;
        sourceNode.vy += fy;
        sourceNode.vz += fz;
        targetNode.vx -= fx;
        targetNode.vy -= fy;
        targetNode.vz -= fz;
      }
    });
    simulation.force('damping', () => {
      for (const node of nodes) {
        node.vx *= 0.95;
        node.vy *= 0.95;
        node.vz *= 0.95;
      }
    });

    let animationFrame = 0;
    const syncPositions = () => {
      let centerX = 0;
      let centerY = 0;
      let centerZ = 0;
      for (const node of nodes) {
        centerX += node.x || 0;
        centerY += node.y || 0;
        centerZ += node.z || 0;
      }
      centerX /= nodes.length;
      centerY /= nodes.length;
      centerZ /= nodes.length;

      let maxDistance = 0;
      let minDistance = Number.POSITIVE_INFINITY;
      for (const node of nodes) {
        const dx = (node.x || 0) - centerX;
        const dy = (node.y || 0) - centerY;
        const dz = (node.z || 0) - centerZ;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (distance > maxDistance) {
          maxDistance = distance;
        }
      }

      for (let index = 0; index < nodes.length; index += 1) {
        for (let peer = index + 1; peer < nodes.length; peer += 1) {
          const ax = (nodes[index].x || 0) - centerX;
          const ay = (nodes[index].y || 0) - centerY;
          const az = (nodes[index].z || 0) - centerZ;
          const bx = (nodes[peer].x || 0) - centerX;
          const by = (nodes[peer].y || 0) - centerY;
          const bz = (nodes[peer].z || 0) - centerZ;
          const dx = ax - bx;
          const dy = ay - by;
          const dz = az - bz;
          const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (distance > 0 && distance < minDistance) {
            minDistance = distance;
          }
        }
      }

      const radiusBase = Math.max(TARGET_LAYOUT_RADIUS, maxDistance);
      const compactScale = TARGET_LAYOUT_RADIUS / radiusBase;
      const spacingScale =
        Number.isFinite(minDistance) && minDistance > 0
          ? MIN_RENDER_NODE_DISTANCE / minDistance
          : compactScale;
      const visualScale = Math.min(MAX_VISUAL_SCALE, Math.max(compactScale, spacingScale));

      const nextPositions: Record<string, [number, number, number]> = {};
      for (const node of nodes) {
        nextPositions[node.id] = [
          ((node.x || 0) - centerX) * visualScale,
          ((node.y || 0) - centerY) * visualScale,
          ((node.z || 0) - centerZ) * visualScale,
        ];
      }
      positionsRef.current = nextPositions;
      if (!animationFrame) {
        animationFrame = window.requestAnimationFrame(() => {
          animationFrame = 0;
          setLayoutVersion((value) => value + 1);
        });
      }
    };

    simulation.on('tick', syncPositions);
    syncPositions();

    return () => {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
      }
      simulation.stop();
    };
  }, [simulationKey, students, partition, groupThemes, affinities, forceIntensity, isRunning]);

  return {
    positionsByStudentId: positionsRef.current,
    layoutVersion,
  };
}
