'use client';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';

const PAINT = { color: '#c9a032', roughness: 0.55, metalness: 0.35 } as const;
const STEEL = { color: '#3b4148', roughness: 0.45, metalness: 0.7 } as const;

type Strut = { from: Vector3; to: Vector3 };

/** Lattice of thin box struts between point pairs, drawn as one instanced mesh. */
function Lattice({ struts, thickness }: { struts: Strut[]; thickness: number }) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new Matrix4(),
      q = new Quaternion(),
      up = new Vector3(0, 1, 0);
    struts.forEach(({ from, to }, i) => {
      const dir = to.clone().sub(from);
      q.setFromUnitVectors(up, dir.clone().normalize());
      m.compose(
        from.clone().add(to).multiplyScalar(0.5),
        q,
        new Vector3(thickness, dir.length(), thickness),
      );
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [struts, thickness]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, struts.length]} castShadow>
      <boxGeometry />
      <meshStandardMaterial {...PAINT} />
    </instancedMesh>
  );
}

/** Square lattice section from y0 to y1, width w, with X-bracing on every face. */
function mastStruts(height: number, w: number, step: number) {
  const s: Strut[] = [];
  const h = w / 2;
  const corners = [
    [-h, -h],
    [h, -h],
    [h, h],
    [-h, h],
  ];
  for (const [x, z] of corners)
    s.push({ from: new Vector3(x, 0, z), to: new Vector3(x, height, z) });
  for (let y = 0; y < height - 0.01; y += step) {
    const y1 = Math.min(height, y + step);
    for (let c = 0; c < 4; c++) {
      const [ax, az] = corners[c];
      const [bx, bz] = corners[(c + 1) % 4];
      s.push({ from: new Vector3(ax, y, az), to: new Vector3(bx, y1, bz) });
      s.push({ from: new Vector3(ax, y, az), to: new Vector3(bx, y, bz) });
    }
  }
  return s;
}

/** Triangular jib lattice along +X from x0 to x1. */
function jibStruts(x0: number, x1: number, w: number, depth: number, step: number) {
  const s: Strut[] = [];
  const a = (x: number) => new Vector3(x, 0, -w / 2);
  const b = (x: number) => new Vector3(x, 0, w / 2);
  const t = (x: number) => new Vector3(x, depth, 0);
  s.push({ from: a(x0), to: a(x1) }, { from: b(x0), to: b(x1) }, { from: t(x0), to: t(x1) });
  for (let x = x0; x < x1 - 0.01; x += step) {
    const n = Math.min(x1, x + step);
    s.push({ from: a(x), to: t(n) }, { from: b(x), to: t(n) }, { from: a(x), to: b(x) });
  }
  return s;
}

/**
 * Procedural tower crane shown beside buildings still under construction.
 * Industrial paint and steel, not a toy: thin lattice members, counterweights, hoist cable.
 */
export function Crane({
  position,
  height,
  hookY,
  reach,
  heading,
  animate,
}: {
  position: [number, number, number];
  height: number;
  hookY: number;
  reach: number;
  /** Jib direction in radians (rotation about Y), pointing over the building. */
  heading: number;
  animate: boolean;
}) {
  const slew = useRef<Group>(null);
  const w = 1.6;
  const mast = useMemo(() => mastStruts(height, w, w * 1.1), [height]);
  const jib = useMemo(() => jibStruts(-reach * 0.32, reach, 1.2, 1.4, 1.8), [reach]);
  const trolley = useRef<Group>(null);

  useFrame((state) => {
    if (!animate || !slew.current) return;
    const t = state.clock.elapsedTime;
    // Slow slewing over the site, trolley drifting along the jib.
    slew.current.rotation.y = heading + Math.sin(t * 0.08) * 0.4;
    if (trolley.current) trolley.current.position.x = reach * (0.55 + Math.sin(t * 0.13) * 0.25);
  });

  const cable = height + 0.2 - hookY;
  return (
    <group position={position}>
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[w * 2.6, 0.8, w * 2.6]} />
        <meshStandardMaterial color="#8d8f8c" roughness={0.95} />
      </mesh>
      <Lattice struts={mast} thickness={0.12} />
      <group ref={slew} position={[0, height, 0]} rotation-y={heading}>
        <mesh position={[0, 0.6, 0]} castShadow>
          <boxGeometry args={[w * 1.2, 1.2, w * 1.2]} />
          <meshStandardMaterial {...STEEL} />
        </mesh>
        <mesh position={[0.9, 0.9, w * 0.75]} castShadow>
          <boxGeometry args={[1.6, 1.4, 1.1]} />
          <meshStandardMaterial color="#e9ebe8" roughness={0.4} metalness={0.2} />
        </mesh>
        <group position={[0, 1.2, 0]}>
          <Lattice struts={jib} thickness={0.09} />
          <mesh position={[-reach * 0.27, -0.6, 0]} castShadow>
            <boxGeometry args={[2.4, 1.6, 1.6]} />
            <meshStandardMaterial color="#6c6f70" roughness={0.9} />
          </mesh>
          <mesh position={[0, 3.2, 0]} castShadow>
            <boxGeometry args={[0.5, 4.2, 0.5]} />
            <meshStandardMaterial {...PAINT} />
          </mesh>
          <group ref={trolley} position={[reach * 0.6, 0, 0]}>
            <mesh position={[0, -0.2, 0]}>
              <boxGeometry args={[1, 0.35, 1.3]} />
              <meshStandardMaterial {...STEEL} />
            </mesh>
            <mesh position={[0, -cable / 2 - 0.3, 0]}>
              <cylinderGeometry args={[0.03, 0.03, cable, 6]} />
              <meshStandardMaterial color="#1f2326" roughness={0.6} metalness={0.8} />
            </mesh>
            <mesh position={[0, -cable - 0.5, 0]} castShadow>
              <boxGeometry args={[0.6, 0.6, 0.4]} />
              <meshStandardMaterial {...PAINT} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}
