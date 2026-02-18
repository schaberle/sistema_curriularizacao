import { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html, Line, OrbitControls } from '@react-three/drei';
import { Color, Mesh, Vector3 } from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import type {
  VisualAffinityEdge,
  VisualGroupPartition,
  VisualIsolationMap,
  VisualStudentNode,
} from '../../../types/distribution.types';
import { useForceLayout3D } from './useForceLayout3D';

type GroupThemeInfo = {
  themeId?: string;
  themeName?: string;
  themeIndex?: number;
  isRealtimeFallback?: boolean;
};

type SimulationNetwork3DProps = {
  students: VisualStudentNode[];
  partition: VisualGroupPartition;
  groupThemes: Record<string, GroupThemeInfo | undefined>;
  affinities: VisualAffinityEdge[];
  isolationScoreByStudentId?: VisualIsolationMap;
  isRunning: boolean;
  showAffinityEdges: boolean;
  showGroupHulls: boolean;
  forceIntensity: number;
};

function colorFromGroupId(groupId: string | null | undefined): string {
  if (!groupId) {
    return '#64748b';
  }
  let hash = 0;
  for (let index = 0; index < groupId.length; index += 1) {
    hash = (hash * 33 + groupId.charCodeAt(index)) >>> 0;
  }
  const palette = ['#0f4c81', '#2a9d8f', '#d97706', '#c1121f', '#6d28d9', '#0e7490', '#a16207', '#334155'];
  return palette[hash % palette.length];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function rankForTheme(utilities: number[], themeIndex?: number): number | undefined {
  if (themeIndex === undefined || themeIndex < 0 || themeIndex >= utilities.length) {
    return undefined;
  }
  const target = utilities[themeIndex];
  if (!Number.isFinite(target)) {
    return undefined;
  }
  let rank = 1;
  for (const utility of utilities) {
    if (utility > target + 1e-9) {
      rank += 1;
    }
  }
  return rank;
}

function radiusFromRank(rank?: number): number {
  if (!rank || !Number.isFinite(rank)) {
    return 0.11;
  }
  const bounded = clamp(Math.floor(rank), 1, 8);
  return 0.18 - (bounded - 1) * 0.013;
}

function visualStyleFromIsolation(baseColorHex: string, isolationScore?: number): {
  color: string;
  opacity: number;
  emissive: string;
} {
  if (isolationScore === undefined || !Number.isFinite(isolationScore)) {
    return {
      color: baseColorHex,
      opacity: 0.9,
      emissive: '#1f2937',
    };
  }

  const normalized = (clamp(isolationScore, -3, 3) + 3) / 6;
  const isolationColor = new Color('#dc2626').lerp(new Color('#16a34a'), normalized);
  const baseColor = new Color(baseColorHex).lerp(isolationColor, 0.35);

  return {
    color: `#${baseColor.getHexString()}`,
    opacity: 0.35 + normalized * 0.6,
    emissive: `#${isolationColor.getHexString()}`,
  };
}

function StudentNode({
  nodeId,
  position,
  radius,
  color,
  emissive,
  opacity,
  showElectricalRing,
  onHover,
  onHoverOut,
}: {
  nodeId: string;
  position: [number, number, number];
  radius: number;
  color: string;
  emissive: string;
  opacity: number;
  showElectricalRing: boolean;
  onHover: (id: string) => void;
  onHoverOut: () => void;
}) {
  const meshRef = useRef<Mesh>(null);
  const ringRef = useRef<Mesh>(null);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) {
      return;
    }
    mesh.position.x += (position[0] - mesh.position.x) * 0.22;
    mesh.position.y += (position[1] - mesh.position.y) * 0.22;
    mesh.position.z += (position[2] - mesh.position.z) * 0.22;

    const ring = ringRef.current;
    if (ring) {
      ring.position.x = mesh.position.x;
      ring.position.y = mesh.position.y;
      ring.position.z = mesh.position.z;
    }
  });

  return (
    <>
      <mesh
        ref={meshRef}
        onPointerOver={() => onHover(nodeId)}
        onPointerOut={() => onHoverOut()}
      >
        <sphereGeometry args={[radius, 16, 16]} />
        <meshStandardMaterial color={color} transparent opacity={opacity} emissive={emissive} emissiveIntensity={0.18} />
      </mesh>
      {showElectricalRing && (
        <mesh ref={ringRef}>
          <sphereGeometry args={[radius * 1.18, 14, 14]} />
          <meshBasicMaterial color="#f8fafc" wireframe transparent opacity={0.85} />
        </mesh>
      )}
    </>
  );
}

function GroupHull({ points, color }: { points: [number, number, number][]; color: string }) {
  const hullGeometry = useMemo(() => {
    if (points.length < 4) {
      return null;
    }

    try {
      const vectors = points.map((point) => new Vector3(point[0], point[1], point[2]));
      return new ConvexGeometry(vectors);
    } catch {
      return null;
    }
  }, [points]);

  const fallback = useMemo(() => {
    if (!points.length) {
      return null;
    }
    const centroid: [number, number, number] = [0, 0, 0];
    for (const point of points) {
      centroid[0] += point[0];
      centroid[1] += point[1];
      centroid[2] += point[2];
    }
    centroid[0] /= points.length;
    centroid[1] /= points.length;
    centroid[2] /= points.length;

    let maxDistance = 0.45;
    for (const point of points) {
      const dx = point[0] - centroid[0];
      const dy = point[1] - centroid[1];
      const dz = point[2] - centroid[2];
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (distance > maxDistance) {
        maxDistance = distance;
      }
    }

    return {
      centroid,
      radius: maxDistance + 0.25,
    };
  }, [points]);

  if (hullGeometry) {
    return (
      <mesh geometry={hullGeometry}>
        <meshStandardMaterial color={color} transparent opacity={0.14} />
      </mesh>
    );
  }

  if (!fallback) {
    return null;
  }

  return (
    <mesh position={fallback.centroid}>
      <sphereGeometry args={[fallback.radius, 16, 16]} />
      <meshBasicMaterial color={color} wireframe transparent opacity={0.18} />
    </mesh>
  );
}

export function SimulationNetwork3D({
  students,
  partition,
  groupThemes,
  affinities,
  isolationScoreByStudentId,
  isRunning,
  showAffinityEdges,
  showGroupHulls,
  forceIntensity,
}: SimulationNetwork3DProps) {
  const [hoveredStudentId, setHoveredStudentId] = useState<string | null>(null);
  const { positionsByStudentId, layoutVersion } = useForceLayout3D({
    students,
    partition,
    groupThemes,
    affinities,
    forceIntensity,
    isRunning,
  });

  const studentById = useMemo(() => new Map(students.map((student) => [student.id, student])), [students]);

  const nodeVisuals = useMemo(() => {
    return students.map((student) => {
      const groupId = partition.assignmentByStudentId[student.id] ?? null;
      const groupTheme = groupId ? groupThemes[groupId] : undefined;
      const rank = rankForTheme(student.utilities, groupTheme?.themeIndex);
      const baseColor = colorFromGroupId(groupId);
      const isolation = isolationScoreByStudentId?.[student.id];
      const style = visualStyleFromIsolation(baseColor, isolation);

      return {
        student,
        groupId,
        groupTheme,
        rank,
        radius: radiusFromRank(rank),
        color: style.color,
        opacity: style.opacity,
        emissive: style.emissive,
      };
    });
  }, [students, partition, groupThemes, isolationScoreByStudentId, layoutVersion]);

  const affinityLines = useMemo(() => {
    if (!showAffinityEdges) {
      return [];
    }

    return affinities
      .map((affinity) => {
        const source = positionsByStudentId[affinity.sourceId];
        const target = positionsByStudentId[affinity.targetId];
        if (!source || !target) {
          return null;
        }
        return {
          key: `${affinity.sourceId}:${affinity.targetId}`,
          points: [source, target] as [[number, number, number], [number, number, number]],
          color: affinity.value >= 0 ? '#22c55e' : '#ef4444',
          width: 0.5 + Math.abs(affinity.value) * 1.5,
        };
      })
      .filter((line): line is { key: string; points: [[number, number, number], [number, number, number]]; color: string; width: number } => Boolean(line));
  }, [showAffinityEdges, affinities, positionsByStudentId, layoutVersion]);

  const hulls = useMemo(() => {
    if (!showGroupHulls) {
      return [];
    }

    return partition.groups
      .map((group) => {
        const points = group.studentIds
          .map((studentId) => positionsByStudentId[studentId])
          .filter((point): point is [number, number, number] => Boolean(point));
        if (!points.length) {
          return null;
        }
        return {
          groupId: group.groupId,
          color: colorFromGroupId(group.groupId),
          points,
        };
      })
      .filter((item): item is { groupId: string; color: string; points: [number, number, number][] } => Boolean(item));
  }, [showGroupHulls, partition.groups, positionsByStudentId, layoutVersion]);

  const hoveredData = useMemo(() => {
    if (!hoveredStudentId) {
      return null;
    }
    const student = studentById.get(hoveredStudentId);
    if (!student) {
      return null;
    }
    const groupId = partition.assignmentByStudentId[student.id] ?? null;
    const groupTheme = groupId ? groupThemes[groupId] : undefined;
    const rank = rankForTheme(student.utilities, groupTheme?.themeIndex);
    const isolationScore = isolationScoreByStudentId?.[student.id];
    const position = positionsByStudentId[student.id];
    if (!position) {
      return null;
    }
    return {
      position,
      student,
      groupId,
      groupTheme,
      rank,
      isolationScore,
    };
  }, [hoveredStudentId, studentById, partition.assignmentByStudentId, groupThemes, isolationScoreByStudentId, positionsByStudentId, layoutVersion]);

  if (!students.length) {
    return (
      <div className="flex h-[520px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
        Inicie uma fase ao vivo para visualizar a rede 3D.
      </div>
    );
  }

  return (
    <div className="h-[520px] overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100">
      <Canvas camera={{ position: [8.5, 8.5, 8.5], fov: 54 }}>
        <color attach="background" args={['#f8fafc']} />
        <ambientLight intensity={0.62} />
        <directionalLight position={[9, 10, 7]} intensity={0.82} />
        <pointLight position={[-8, -7, -8]} intensity={0.22} />

        {nodeVisuals.map((node) => (
          <StudentNode
            key={node.student.id}
            nodeId={node.student.id}
            position={positionsByStudentId[node.student.id] ?? [0, 0, 0]}
            radius={node.radius}
            color={node.color}
            emissive={node.emissive}
            opacity={node.opacity}
            showElectricalRing={node.student.course === 'ELECTRICAL'}
            onHover={setHoveredStudentId}
            onHoverOut={() => setHoveredStudentId(null)}
          />
        ))}

        {affinityLines.map((line) => (
          <Line
            key={line.key}
            points={line.points}
            color={line.color}
            lineWidth={line.width}
            transparent
            opacity={0.52}
          />
        ))}

        {hulls.map((hull) => (
          <GroupHull key={hull.groupId} points={hull.points} color={hull.color} />
        ))}

        {hoveredData && (
          <Html position={hoveredData.position} center>
            <div className="min-w-[230px] rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-[11px] text-slate-700 shadow-lg">
              <p><span className="font-semibold">ID:</span> {hoveredData.student.id}</p>
              <p><span className="font-semibold">Curso:</span> {hoveredData.student.course === 'ELECTRICAL' ? 'Eletrica' : 'Mecanica'}</p>
              <p><span className="font-semibold">Fase:</span> {hoveredData.student.phase}</p>
              <p><span className="font-semibold">Grupo:</span> {hoveredData.groupId ?? 'n/d (tempo real)'}</p>
              <p><span className="font-semibold">Tema:</span> {hoveredData.groupTheme?.themeName ?? 'n/d (tempo real)'}</p>
              <p><span className="font-semibold">Rank:</span> {hoveredData.rank ?? 'n/d (tempo real)'}</p>
              <p>
                <span className="font-semibold">S(i,g):</span>{' '}
                {hoveredData.isolationScore !== undefined ? hoveredData.isolationScore.toFixed(3) : 'n/d (tempo real)'}
              </p>
            </div>
          </Html>
        )}

        <OrbitControls makeDefault enablePan enableZoom autoRotate={isRunning} autoRotateSpeed={0.35} />
      </Canvas>
    </div>
  );
}
