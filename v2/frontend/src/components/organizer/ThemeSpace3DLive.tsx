import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html, Line, OrbitControls } from '@react-three/drei';
import type { Mesh } from 'three';
import type { SimulationPoint3D } from '../../types/distribution.types';

type ThemeSpace3DLiveProps = {
  points: SimulationPoint3D[];
  axisThemeIds: [string, string, string];
  groupsVisible: boolean;
  isRunning: boolean;
  pointRenderMode?: 'real' | 'groupLocked';
};

const GROUP_COLORS = ['#1d4ed8', '#0f766e', '#b45309', '#be123c', '#4c1d95', '#0369a1', '#0f766e', '#334155'];
const PHASE_COLORS = ['#1e3a8a', '#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe', '#64748b', '#475569'];

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function toWorld(value: number): number {
  return (clamp01(value) - 0.5) * 10;
}

function colorFromGroupId(groupId: string | undefined): string {
  if (!groupId) {
    return '#64748b';
  }
  let hash = 0;
  for (let i = 0; i < groupId.length; i++) {
    hash = (hash * 31 + groupId.charCodeAt(i)) >>> 0;
  }
  return GROUP_COLORS[hash % GROUP_COLORS.length];
}

function colorFromPhase(phase: number): string {
  const index = Math.max(1, Math.min(10, Math.floor(phase || 1))) - 1;
  return PHASE_COLORS[index] || '#64748b';
}

function hashToUnitVector(seed: string): [number, number, number] {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const x = ((hash >>> 0) % 997) / 997 - 0.5;
  const y = (((hash >>> 9) % 997) / 997) - 0.5;
  const z = (((hash >>> 18) % 997) / 997) - 0.5;
  const norm = Math.sqrt(x * x + y * y + z * z) || 1;
  return [x / norm, y / norm, z / norm];
}

type PreparedPoint = {
  point: SimulationPoint3D;
  color: string;
  world: [number, number, number];
};

type GroupVisual = {
  groupId: string;
  color: string;
  centroid: [number, number, number];
  memberPositions: [number, number, number][];
  envelopeRadius: number;
};

function AnimatedPoint({ world, color }: { world: [number, number, number]; color: string }) {
  const meshRef = useRef<Mesh>(null);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) {
      return;
    }

    const [targetX, targetY, targetZ] = world;

    mesh.position.x += (targetX - mesh.position.x) * 0.16;
    mesh.position.y += (targetY - mesh.position.y) * 0.16;
    mesh.position.z += (targetZ - mesh.position.z) * 0.16;
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.1, 10, 10]} />
      <meshStandardMaterial color={color} roughness={0.35} metalness={0.1} />
    </mesh>
  );
}

function GroupOverlays({ groups }: { groups: GroupVisual[] }) {
  return (
    <>
      {groups.map((group) => (
        <group key={group.groupId}>
          {group.memberPositions.map((memberPosition, index) => (
            <Line
              key={`${group.groupId}-line-${index}`}
              points={[memberPosition, group.centroid]}
              color={group.color}
              lineWidth={1}
              transparent
              opacity={0.24}
            />
          ))}

          <mesh position={group.centroid}>
            <sphereGeometry args={[0.18, 14, 14]} />
            <meshStandardMaterial color={group.color} emissive={group.color} emissiveIntensity={0.2} />
          </mesh>

          <mesh position={group.centroid}>
            <sphereGeometry args={[group.envelopeRadius, 18, 18]} />
            <meshBasicMaterial color={group.color} wireframe transparent opacity={0.2} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function AxisLabels({ axisThemeIds }: { axisThemeIds: [string, string, string] }) {
  return (
    <>
      <Html position={[5.4, 0, 0]} center>
        <span className="rounded bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
          X: {axisThemeIds[0]}
        </span>
      </Html>
      <Html position={[0, 5.4, 0]} center>
        <span className="rounded bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
          Y: {axisThemeIds[1]}
        </span>
      </Html>
      <Html position={[0, 0, 5.4]} center>
        <span className="rounded bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
          Z: {axisThemeIds[2]}
        </span>
      </Html>
    </>
  );
}

export function ThemeSpace3DLive({
  points,
  axisThemeIds,
  groupsVisible,
  isRunning,
  pointRenderMode = 'real',
}: ThemeSpace3DLiveProps) {
  const preparedPoints = useMemo<PreparedPoint[]>(() => {
    if (!points.length) {
      return [];
    }

    const grouped = new Map<string, SimulationPoint3D[]>();
    for (const point of points) {
      if (!point.groupId) {
        continue;
      }
      const current = grouped.get(point.groupId) ?? [];
      current.push(point);
      grouped.set(point.groupId, current);
    }

    const centroids = new Map<string, [number, number, number]>();
    const maxRadii = new Map<string, number>();

    grouped.forEach((members, groupId) => {
      if (!members.length) {
        return;
      }
      const centroid: [number, number, number] = [0, 0, 0];
      for (const member of members) {
        centroid[0] += member.x;
        centroid[1] += member.y;
        centroid[2] += member.z;
      }
      centroid[0] /= members.length;
      centroid[1] /= members.length;
      centroid[2] /= members.length;
      centroids.set(groupId, centroid);

      let maxNorm = 1e-6;
      for (const member of members) {
        const dx = member.x - centroid[0];
        const dy = member.y - centroid[1];
        const dz = member.z - centroid[2];
        const norm = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (norm > maxNorm) {
          maxNorm = norm;
        }
      }
      maxRadii.set(groupId, maxNorm);
    });

    const groupLocked = pointRenderMode === 'groupLocked' && groupsVisible;

    return points.map((point) => {
      const color = groupsVisible ? colorFromGroupId(point.groupId) : colorFromPhase(point.phase);
      let nx = point.x;
      let ny = point.y;
      let nz = point.z;

      if (groupLocked && point.groupId && centroids.has(point.groupId)) {
        const centroid = centroids.get(point.groupId)!;
        const maxRadius = maxRadii.get(point.groupId) ?? 1;
        let dx = point.x - centroid[0];
        let dy = point.y - centroid[1];
        let dz = point.z - centroid[2];
        let norm = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (norm < 1e-6) {
          const randomDir = hashToUnitVector(point.studentId);
          dx = randomDir[0];
          dy = randomDir[1];
          dz = randomDir[2];
          norm = 1;
        }

        const unitX = dx / norm;
        const unitY = dy / norm;
        const unitZ = dz / norm;
        const relative = Math.min(1, norm / maxRadius);
        const compactRadius = 0.02 + relative * 0.06;

        nx = clamp01(centroid[0] + unitX * compactRadius);
        ny = clamp01(centroid[1] + unitY * compactRadius);
        nz = clamp01(centroid[2] + unitZ * compactRadius);
      }

      return {
        point,
        color,
        world: [toWorld(nx), toWorld(ny), toWorld(nz)],
      };
    });
  }, [points, groupsVisible, pointRenderMode]);

  const groupVisuals = useMemo<GroupVisual[]>(() => {
    if (!groupsVisible) {
      return [];
    }

    const grouped = new Map<string, [number, number, number][]>();
    const colorByGroup = new Map<string, string>();

    for (const prepared of preparedPoints) {
      const groupId = prepared.point.groupId;
      if (!groupId) {
        continue;
      }
      const members = grouped.get(groupId) ?? [];
      members.push(prepared.world);
      grouped.set(groupId, members);
      if (!colorByGroup.has(groupId)) {
        colorByGroup.set(groupId, prepared.color);
      }
    }

    return Array.from(grouped.entries()).map(([groupId, members]) => {
      const centroid: [number, number, number] = [0, 0, 0];
      for (const member of members) {
        centroid[0] += member[0];
        centroid[1] += member[1];
        centroid[2] += member[2];
      }
      centroid[0] /= members.length;
      centroid[1] /= members.length;
      centroid[2] /= members.length;

      let maxDistance = 0.3;
      for (const member of members) {
        const dx = member[0] - centroid[0];
        const dy = member[1] - centroid[1];
        const dz = member[2] - centroid[2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist > maxDistance) {
          maxDistance = dist;
        }
      }

      return {
        groupId,
        color: colorByGroup.get(groupId) ?? colorFromGroupId(groupId),
        centroid,
        memberPositions: members,
        envelopeRadius: maxDistance + 0.22,
      };
    });
  }, [preparedPoints, groupsVisible]);

  if (!points.length) {
    return (
      <div className="flex h-[520px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
        Inicie uma fase ao vivo para visualizar o espaco 3D.
      </div>
    );
  }

  return (
    <div className="h-[520px] overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100">
      <Canvas camera={{ position: [8, 8, 8], fov: 52 }}>
        <color attach="background" args={['#f8fafc']} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[8, 10, 6]} intensity={0.75} />
        <pointLight position={[-8, -6, -8]} intensity={0.3} />

        <axesHelper args={[5.5]} />
        <gridHelper args={[10, 10, '#cbd5e1', '#e2e8f0']} rotation={[Math.PI / 2, 0, 0]} />

        {preparedPoints.map(({ point, color, world }) => (
          <AnimatedPoint key={point.studentId} world={world} color={color} />
        ))}

        {groupVisuals.length > 0 && <GroupOverlays groups={groupVisuals} />}

        <AxisLabels axisThemeIds={axisThemeIds} />
        <OrbitControls makeDefault enablePan={true} enableZoom={true} autoRotate={isRunning} autoRotateSpeed={0.45} />
      </Canvas>
    </div>
  );
}
