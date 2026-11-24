'use client';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  DoubleSide,
  Euler,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
  type Box3,
  type Group,
} from 'three';

type Piece = { at: [number, number, number]; size: [number, number, number]; rotY?: number };

/** Many boxes of one material drawn as a single instanced mesh. */
function Boxes({
  pieces,
  color,
  roughness = 0.7,
  metalness = 0,
  shadows = true,
}: {
  pieces: Piece[];
  color: string;
  roughness?: number;
  metalness?: number;
  shadows?: boolean;
}) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new Matrix4();
    const q = new Quaternion();
    pieces.forEach((p, i) => {
      q.setFromEuler(new Euler(0, p.rotY ?? 0, 0));
      m.compose(new Vector3(...p.at), q, new Vector3(...p.size));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [pieces]);
  if (!pieces.length) return null;
  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, pieces.length]}
      castShadow={shadows}
      receiveShadow
    >
      <boxGeometry />
      <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />
    </instancedMesh>
  );
}

/** Points every `step` along a rectangle's perimeter (x/z), corners included. */
function perimeter(minX: number, maxX: number, minZ: number, maxZ: number, step: number) {
  const pts: [number, number][] = [];
  const edge = (ax: number, az: number, bx: number, bz: number) => {
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.round(len / step));
    for (let i = 0; i < n; i++) pts.push([ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n]);
  };
  edge(minX, minZ, maxX, minZ);
  edge(maxX, minZ, maxX, maxZ);
  edge(maxX, maxZ, minX, maxZ);
  edge(minX, maxZ, minX, minZ);
  return pts;
}

/**
 * Tube-and-fitting scaffold wrapped around the floors being built, with planks at every lift
 * and translucent debris netting on the outside face.
 */
export function Scaffold({ box, bottom }: { box: Box3; bottom: number }) {
  const gap = 1.1;
  const minX = box.min.x - gap,
    maxX = box.max.x + gap,
    minZ = box.min.z - gap,
    maxZ = box.max.z + gap;
  const top = box.max.y + 1.2;
  const height = top - bottom;
  const { tubes, planks } = useMemo(() => {
    const tubes: Piece[] = [];
    const planks: Piece[] = [];
    for (const [x, z] of perimeter(minX, maxX, minZ, maxZ, 2.6))
      tubes.push({ at: [x, bottom + height / 2, z], size: [0.07, height, 0.07] });
    const w = maxX - minX,
      d = maxZ - minZ;
    for (let y = bottom + 2; y <= top; y += 2) {
      // Ledgers (horizontal rails) on all four sides.
      tubes.push({ at: [(minX + maxX) / 2, y, minZ], size: [w, 0.06, 0.06] });
      tubes.push({ at: [(minX + maxX) / 2, y, maxZ], size: [w, 0.06, 0.06] });
      tubes.push({ at: [minX, y, (minZ + maxZ) / 2], size: [0.06, 0.06, d] });
      tubes.push({ at: [maxX, y, (minZ + maxZ) / 2], size: [0.06, 0.06, d] });
      // Plank decks between the building face and the scaffold.
      planks.push({
        at: [(minX + maxX) / 2, y - 0.05, minZ + gap / 2],
        size: [w, 0.05, gap * 0.9],
      });
      planks.push({
        at: [(minX + maxX) / 2, y - 0.05, maxZ - gap / 2],
        size: [w, 0.05, gap * 0.9],
      });
      planks.push({
        at: [minX + gap / 2, y - 0.05, (minZ + maxZ) / 2],
        size: [gap * 0.9, 0.05, d],
      });
      planks.push({
        at: [maxX - gap / 2, y - 0.05, (minZ + maxZ) / 2],
        size: [gap * 0.9, 0.05, d],
      });
    }
    return { tubes, planks };
  }, [minX, maxX, minZ, maxZ, bottom, top, height]);

  const netY = bottom + height / 2;
  const nets: { at: [number, number, number]; w: number; rot: number }[] = [
    { at: [(minX + maxX) / 2, netY, minZ - 0.05], w: maxX - minX, rot: 0 },
    { at: [(minX + maxX) / 2, netY, maxZ + 0.05], w: maxX - minX, rot: 0 },
    { at: [minX - 0.05, netY, (minZ + maxZ) / 2], w: maxZ - minZ, rot: Math.PI / 2 },
    { at: [maxX + 0.05, netY, (minZ + maxZ) / 2], w: maxZ - minZ, rot: Math.PI / 2 },
  ];
  return (
    <group>
      <Boxes pieces={tubes} color="#8e9499" roughness={0.4} metalness={0.8} />
      <Boxes pieces={planks} color="#9a7f5a" roughness={0.85} />
      {nets.map((n, i) => (
        <mesh key={i} position={n.at} rotation-y={n.rot}>
          <planeGeometry args={[n.w, height]} />
          <meshStandardMaterial
            color="#dfe6e3"
            transparent
            opacity={0.32}
            roughness={0.9}
            side={DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Concrete column stubs and protruding rebar on the slab currently being poured. */
export function ColumnStubs({ box, rise }: { box: Box3; rise: number }) {
  const { columns, rebar } = useMemo(() => {
    const columns: Piece[] = [];
    const rebar: Piece[] = [];
    const spacing = 6;
    const h = Math.max(0.3, rise);
    const inset = 1.2;
    const nx = Math.max(2, Math.round((box.max.x - box.min.x - inset * 2) / spacing) + 1);
    const nz = Math.max(2, Math.round((box.max.z - box.min.z - inset * 2) / spacing) + 1);
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < nz; j++) {
        const x = box.min.x + inset + ((box.max.x - box.min.x - inset * 2) * i) / (nx - 1);
        const z = box.min.z + inset + ((box.max.z - box.min.z - inset * 2) * j) / (nz - 1);
        columns.push({ at: [x, box.min.y + h / 2, z], size: [0.55, h, 0.55] });
        for (const [dx, dz] of [
          [-0.18, -0.18],
          [0.18, -0.18],
          [-0.18, 0.18],
          [0.18, 0.18],
        ])
          rebar.push({ at: [x + dx, box.min.y + h + 0.45, z + dz], size: [0.035, 0.9, 0.035] });
      }
    return { columns, rebar };
  }, [box, rise]);
  return (
    <group>
      <Boxes pieces={columns} color="#a6a49c" roughness={0.92} />
      <Boxes pieces={rebar} color="#5b4a3c" roughness={0.6} metalness={0.6} shadows={false} />
    </group>
  );
}

/** Rack-and-pinion construction hoist on the facade; the cage travels between ground and top. */
export function Hoist({
  x,
  z,
  base,
  top,
  animate,
}: {
  x: number;
  z: number;
  base: number;
  top: number;
  animate: boolean;
}) {
  const cage = useRef<Group>(null);
  const height = top - base;
  const ties = useMemo<Piece[]>(() => {
    const out: Piece[] = [];
    for (let y = base + 3; y < top; y += 3)
      out.push({ at: [x, y, z - 0.6], size: [0.08, 0.08, 1.2] });
    return out;
  }, [x, z, base, top]);
  useFrame((state) => {
    if (!cage.current) return;
    const t = animate ? state.clock.elapsedTime : 0;
    // Ease up, pause, ease down: a slow 24 s cycle.
    const phase = (Math.sin((t / 24) * Math.PI * 2 - Math.PI / 2) + 1) / 2;
    cage.current.position.y = base + 1.2 + phase * Math.max(0, height - 3);
  });
  return (
    <group>
      <mesh position={[x, base + height / 2, z]} castShadow>
        <boxGeometry args={[0.5, height, 0.5]} />
        <meshStandardMaterial color="#b9a04a" roughness={0.5} metalness={0.5} />
      </mesh>
      <Boxes pieces={ties} color="#8e9499" roughness={0.4} metalness={0.8} shadows={false} />
      <group ref={cage} position={[x, base + 1.2, z + 1]}>
        <mesh castShadow>
          <boxGeometry args={[1.6, 2.3, 1.4]} />
          <meshStandardMaterial color="#d7d9d6" roughness={0.45} metalness={0.4} />
        </mesh>
        <mesh position={[0, 0, 0.71]}>
          <planeGeometry args={[1.2, 1.8]} />
          <meshStandardMaterial color="#3a4148" roughness={0.3} metalness={0.6} />
        </mesh>
      </group>
    </group>
  );
}
