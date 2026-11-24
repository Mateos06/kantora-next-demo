'use client';
/* The render loop (useFrame) animates Three.js meshes and materials imperatively, which is how
   react-three-fiber is meant to be used; React Compiler's immutability rule can't tell that apart
   from mutating React state, so it is disabled for this file only. */
/* eslint-disable react-hooks/immutability */
import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { CameraControls, Environment, Html, Lightformer, useGLTF } from '@react-three/drei';
import {
  Bloom,
  EffectComposer,
  N8AO,
  SMAA,
  ToneMapping,
  Vignette,
} from '@react-three/postprocessing';
import { SMAAPreset, ToneMappingMode } from 'postprocessing';
import {
  Box3,
  Color,
  DirectionalLight,
  HemisphereLight,
  MathUtils,
  Mesh,
  Plane,
  Sphere,
  Vector3,
  type Material,
  type MeshStandardMaterial,
  type Object3D,
} from 'three';
import type { Evidence } from '@/types/domain';
import { Crane } from './crane';
import { ColumnStubs, Hoist, Scaffold } from './site-details';

export type FloorStatus = 'Built' | 'In progress' | 'Planned';
export type ViewerSettings = {
  planned: boolean;
  floor: number;
  layer: 'all' | 'structure';
  explode: number;
  section: number;
  dusk: boolean;
};

const FOV = 32;
const HOME_AZIMUTH = 0.7;
const FACADE = /(Window|Glass|Facade|Balcon|Roof)/i;
const GHOST = new Color('#d5dde6');
const HIGHLIGHT = new Color('#f28c28');
const WARM = new Color('#ffc485');
// Day and dusk palettes the scene blends between.
const DAY = {
  sky: new Color('#dde3e9'),
  ground: new Color('#cfd5d9'),
  sun: new Color('#fff1df'),
  sunI: 3.4,
  hemi: 0.35,
  env: 0.55,
};
const DUSK = {
  sky: new Color('#27303d'),
  ground: new Color('#59606a'),
  sun: new Color('#ff9f6b'),
  sunI: 0.9,
  hemi: 0.1,
  env: 0.16,
};

type MeshState = {
  mesh: Mesh;
  floor: number;
  materials: MeshStandardMaterial[];
  base: { color: Color; opacity: number; transparent: boolean }[];
  y: number;
  minY: number;
  site: boolean;
  /** Which materials are glazing (lit from inside at dusk). */
  glass: boolean[];
  /** 0..1 chance the rooms behind this window are lit. */
  lit: number;
};

/** Per-mesh animated values, advanced every frame. */
type Anim = { built: number; glow: number; fade: number };

/** Stable pseudo-random 0..1 from a string, so the same windows light up every time. */
function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

export function floorOf(name: string) {
  const match = name.match(/Floor_(\d+)/i);
  return match ? Number(match[1]) : 0;
}

/** Floors fully built, plus the fraction of the floor currently being built. */
export function buildState(progress: number, floors: number) {
  const exact = (progress / 100) * floors;
  return { complete: Math.floor(exact), partial: exact - Math.floor(exact) };
}

export function floorStatus(n: number, progress: number, floors: number): FloorStatus {
  const { complete, partial } = buildState(progress, floors);
  if (n <= complete) return 'Built';
  if (n === complete + 1 && partial > 0) return 'In progress';
  return 'Planned';
}

function useBuilding(file: string) {
  const asset = useGLTF('/models/' + file);
  return useMemo(() => {
    const root = asset.scene.clone(true);
    root.updateMatrixWorld(true);
    const meshes: MeshState[] = [];
    const floorBoxes = new Map<number, Box3>();
    // Per building (BuildingA, BuildingB, OfficeA…): floor number -> box.
    const towers = new Map<string, Map<number, Box3>>();
    const structure = new Box3();
    // Section-cut plane, shared by every non-site material.
    const clip = new Plane(new Vector3(-1, 0, 0), Infinity);
    root.traverse((object: Object3D) => {
      if (!(object instanceof Mesh)) return;
      const floor = floorOf(object.name);
      const materials = (Array.isArray(object.material) ? object.material : [object.material]).map(
        (m: Material) => m.clone() as MeshStandardMaterial,
      );
      object.material = materials.length === 1 ? materials[0] : materials;
      object.castShadow = true;
      object.receiveShadow = true;
      const box = new Box3().setFromObject(object);
      const site = /^(Site|Context)/.test(object.name);
      meshes.push({
        mesh: object,
        floor,
        materials,
        base: materials.map((m) => ({
          color: m.color.clone(),
          opacity: m.opacity,
          transparent: m.transparent,
        })),
        y: object.position.y,
        minY: box.min.y,
        site,
        glass: materials.map((m) => /Glass/i.test(m.name)),
        lit: hash(object.name),
      });
      if (!site) {
        structure.union(box);
        for (const mat of materials) {
          mat.clippingPlanes = [clip];
          mat.clipShadows = true;
        }
      }
      if (floor) {
        floorBoxes.set(floor, floorBoxes.get(floor)?.union(box) ?? box.clone());
        const key = object.name.split(/_Floor/i)[0];
        const levels = towers.get(key) ?? new Map<number, Box3>();
        levels.set(floor, levels.get(floor)?.union(box) ?? box.clone());
        towers.set(key, levels);
      }
    });
    const bounds = new Box3().setFromObject(root);
    // Footprint of the tallest tower: the box of its top floor, stretched down to the ground.
    const topFloor = Math.max(0, ...floorBoxes.keys());
    const tower = (floorBoxes.get(topFloor) ?? structure).clone();
    tower.min.y = bounds.min.y;
    return { root, meshes, floorBoxes, towers, bounds, tower, clip };
  }, [asset.scene]);
}

export type SceneApi = { reset: () => void };

export function BuildingScene({
  file,
  floors,
  progress,
  settings,
  hovered,
  evidence,
  reducedMotion,
  backdrop = true,
  apiRef,
  onHover,
  onPickFloor,
  onPickElement,
  onEvidence,
  onReady,
}: {
  file: string;
  floors: number;
  progress: number;
  settings: ViewerSettings;
  hovered: number;
  evidence: Evidence[];
  reducedMotion: boolean;
  /** Sky, fog, ground and post-processing. Off for transparent stills of the bare building. */
  backdrop?: boolean;
  apiRef: RefObject<SceneApi | null>;
  onHover: (floor: number) => void;
  onPickFloor: (floor: number) => void;
  onPickElement: (name: string) => void;
  onEvidence: (e: Evidence) => void;
  onReady: () => void;
}) {
  const building = useBuilding(file);
  const { root, floorBoxes, towers, bounds, tower } = building;
  // The render loop animates mesh state imperatively; it reads the building through a ref.
  const live = useRef(building);
  const anim = useRef(new WeakMap<Mesh, Anim>());
  useLayoutEffect(() => {
    live.current = building;
  }, [building]);
  const controls = useRef<CameraControls>(null);
  const sun = useRef<DirectionalLight>(null);
  const hemi = useRef<HemisphereLight>(null);
  const ground = useRef<MeshStandardMaterial>(null);
  const duskMix = useRef(0);
  const started = useRef(0);
  const lastInput = useRef(0);
  const size = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3());
  const radius = Math.max(size.x, size.z) * 0.5;
  const reach = bounds.getBoundingSphere(new Sphere()).radius;
  const { complete, partial } = buildState(progress, floors);

  // Frame a box from a three-quarter view. Keeps the user's current orbit unless `azimuth` is given.
  const fit = (box: Box3, smooth: boolean, azimuth?: number, scale = 1) => {
    const c = controls.current;
    if (!c) return;
    const sphere = box.getBoundingSphere(new Sphere());
    const distance = (sphere.radius / Math.sin(MathUtils.degToRad(FOV / 2))) * 0.92 * scale;
    const eye = new Vector3()
      .setFromSphericalCoords(distance, MathUtils.degToRad(64), azimuth ?? c.azimuthAngle)
      .add(sphere.center);
    const { x, y, z } = sphere.center;
    return c.setLookAt(eye.x, eye.y, eye.z, x, y, z, smooth && !reducedMotion);
  };

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    // Fly in from far out and high up.
    fit(bounds, false, 1.6, 2.4);
    started.current = performance.now();
    fit(bounds, true, HOME_AZIMUTH);
    onReady();
    apiRef.current = { reset: () => fit(bounds, true, HOME_AZIMUTH) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds]);

  // Frame the chosen floor (and everything below it) when the floor filter changes.
  useEffect(() => {
    const box = settings.floor ? floorBoxes.get(settings.floor) : undefined;
    if (!box) return void fit(bounds, true);
    fit(box.clone().expandByScalar(4), true, undefined, 1.15);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.floor]);

  // Sun shadow frustum sized to the building.
  useLayoutEffect(() => {
    const light = sun.current;
    if (!light) return;
    const s = Math.max(size.x, size.y, size.z) * 0.9;
    light.position.set(center.x + s * 0.8, center.y + s * 1.4, center.z + s * 0.6);
    light.target.position.copy(center);
    light.target.updateMatrixWorld();
    Object.assign(light.shadow.camera, {
      left: -s,
      right: s,
      top: s,
      bottom: -s,
      near: 1,
      far: s * 5,
    });
    light.shadow.camera.updateProjectionMatrix();
  }, [center, size]);

  useFrame((state, delta) => {
    const now = performance.now();
    const elapsed = (now - started.current) / 1000;
    const k = reducedMotion ? 1 : 1 - Math.exp(-delta * 7);
    const spacing = settings.explode * 2.4;
    const { meshes, clip } = live.current;
    clip.constant = MathUtils.lerp(bounds.max.x + 1, bounds.min.x - 1, settings.section);
    const cutTop = settings.floor ? (floorBoxes.get(settings.floor)?.max.y ?? Infinity) : Infinity;

    // Day <-> dusk: a slower blend of sky, sun, fill and reflections.
    const kSlow = reducedMotion ? 1 : 1 - Math.exp(-delta * 2.2);
    duskMix.current += ((settings.dusk ? 1 : 0) - duskMix.current) * kSlow;
    const d = duskMix.current;
    if (state.scene.background instanceof Color)
      state.scene.background.copy(DAY.sky).lerp(DUSK.sky, d);
    state.scene.fog?.color.copy(DAY.sky).lerp(DUSK.sky, d);
    state.scene.environmentIntensity = MathUtils.lerp(DAY.env, DUSK.env, d);
    ground.current?.color.copy(DAY.ground).lerp(DUSK.ground, d);
    if (sun.current) {
      sun.current.intensity = MathUtils.lerp(DAY.sunI, DUSK.sunI, d);
      sun.current.color.copy(DAY.sun).lerp(DUSK.sun, d);
    }
    if (hemi.current) hemi.current.intensity = MathUtils.lerp(DAY.hemi, DUSK.hemi, d);

    for (const m of meshes) {
      const n = m.floor;
      let a = anim.current.get(m.mesh);
      if (!a) anim.current.set(m.mesh, (a = { built: 0, glow: 0, fade: 1 }));
      // Built amount: 1 = in place and opaque, 0 = ghosted planned floor.
      let target = 1;
      if (!settings.planned && n) target = n <= complete ? 1 : n === complete + 1 ? partial : 0;
      // Floors rise in sequence on first load.
      if (!reducedMotion && n && elapsed < 0.4 + n * 0.09) target = 0;
      a.built += (target - a.built) * k;

      const hideLayer = settings.layer === 'structure' && FACADE.test(m.mesh.name);
      // Isolating a floor removes everything above it, roofs and crowns included.
      const hideAbove = n
        ? settings.floor > 0 && n > settings.floor
        : !m.site && m.minY > cutTop - 0.2;
      const fadeTarget = hideLayer || hideAbove ? 0 : 1;
      a.fade += (fadeTarget - a.fade) * k;
      m.mesh.visible = a.fade > 0.02;

      const glowTarget = n && (n === hovered || n === settings.floor) ? 1 : 0;
      a.glow += (glowTarget - a.glow) * k;

      m.mesh.position.y = m.y + (1 - a.built) * 1.6 + (n ? n * spacing : 0);

      m.materials.forEach((mat, i) => {
        const base = m.base[i];
        const ghost = 1 - a.built;
        const opacity = MathUtils.lerp(base.opacity, 0.07, ghost) * a.fade;
        const transparent = base.transparent || opacity < 0.995;
        if (mat.transparent !== transparent) {
          mat.transparent = transparent;
          mat.depthWrite = !transparent || base.transparent;
          mat.needsUpdate = true;
        }
        mat.opacity = opacity;
        mat.color.copy(base.color).lerp(GHOST, ghost * 0.7);
        if (mat.emissive) {
          // Hover/selection glow plus, at dusk, warm light behind built windows.
          const windows = m.glass[i] && m.lit > 0.35 ? d * a.built * a.fade * (0.6 + m.lit) : 0;
          mat.emissive
            .copy(HIGHLIGHT)
            .multiplyScalar(a.glow * 0.32)
            .add(WARM.clone().multiplyScalar(windows * 1.6));
          mat.emissiveIntensity = 1;
        }
      });
    }

    // Gentle idle orbit after a few seconds without input.
    if (!reducedMotion && controls.current && now - lastInput.current > 6000 && elapsed > 3) {
      controls.current.azimuthAngle += delta * 0.04;
    }
  });

  const pick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const n = floorOf(e.object.name);
    if (n) onPickFloor(n);
    else onPickElement(e.object.name.replaceAll('_', ' '));
  };
  const move = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const n = floorOf(e.object.name);
    if (n !== hovered) onHover(n);
    document.body.style.cursor = n ? 'pointer' : 'grab';
  };

  // Crane stands behind the tallest tower as seen from the home camera, so it never blocks the view.
  const towerCenter = tower.getCenter(new Vector3());
  const towerSize = tower.getSize(new Vector3());
  const away = new Vector3(-Math.sin(HOME_AZIMUTH), 0, -Math.cos(HOME_AZIMUTH));
  const offset = Math.hypot(towerSize.x, towerSize.z) / 2 + 6;
  const cranePosition: [number, number, number] = [
    towerCenter.x + away.x * offset,
    bounds.min.y,
    towerCenter.z + away.z * offset,
  ];
  const topBuilt = floorBoxes.get(Math.max(1, complete))?.max.y ?? bounds.max.y * 0.5;
  // Works in progress: scaffold and column stubs on each building's floor under construction.
  const active = complete + 1;
  const works = [...towers]
    .filter(([key, levels]) => levels.has(active) && !/^Podium/i.test(key))
    .map(([key, levels]) => ({
      key,
      box: levels.get(active)!,
      below: levels.get(active - 1)?.min.y ?? levels.get(active)!.min.y - 3,
    }));
  const showWorks =
    !settings.planned &&
    complete < floors &&
    settings.explode < 0.02 &&
    (settings.floor === 0 || settings.floor >= active);
  const hoistTop = (floorBoxes.get(active) ?? floorBoxes.get(complete))?.max.y ?? 0;

  const pinFor = (e: Evidence, i: number) => {
    const box = floorBoxes.get(Math.min(Math.max(1, e.floor), floors)) ?? bounds;
    const y = (box.min.y + box.max.y) / 2 + (e.floor || 0) * settings.explode * 2.4;
    const x = MathUtils.lerp(tower.min.x + 2, tower.max.x - 2, (i + 0.5) / 4);
    return [x, y, tower.max.z + 0.6] as const;
  };

  return (
    <>
      {backdrop && <color attach="background" args={['#dde3e9']} />}
      {backdrop && <fog attach="fog" args={['#dde3e9', reach * 6, reach * 16]} />}
      <hemisphereLight ref={hemi} args={['#eef3f8', '#9d968b', 0.35]} />
      <directionalLight
        ref={sun}
        intensity={3.4}
        color="#fff1df"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
      <Environment resolution={256} frames={1} environmentIntensity={0.55}>
        <Lightformer
          intensity={2.2}
          position={[0, 10, 0]}
          rotation-x={Math.PI / 2}
          scale={[20, 20, 1]}
        />
        <Lightformer
          intensity={1.2}
          color="#ffe9cf"
          position={[-12, 4, 6]}
          rotation-y={Math.PI / 2}
          scale={[12, 6, 1]}
        />
        <Lightformer
          intensity={0.9}
          color="#d7e6f5"
          position={[12, 3, -6]}
          rotation-y={-Math.PI / 2}
          scale={[12, 6, 1]}
        />
        <Lightformer form="ring" intensity={0.6} position={[0, 2, 14]} scale={6} />
      </Environment>

      {backdrop && (
        <mesh
          rotation-x={-Math.PI / 2}
          position={[center.x, bounds.min.y - 0.02, center.z]}
          receiveShadow
        >
          <circleGeometry args={[reach * 16, 64]} />
          <meshStandardMaterial ref={ground} color="#cfd5d9" roughness={1} />
        </mesh>
      )}

      <primitive
        object={root}
        dispose={null}
        onClick={pick}
        onPointerMove={move}
        onPointerOut={() => {
          onHover(0);
          document.body.style.cursor = '';
        }}
      />

      {!settings.planned && complete < floors && (
        <Crane
          position={cranePosition}
          heading={Math.atan2(away.z, -away.x)}
          height={bounds.max.y + 10}
          hookY={topBuilt + 2}
          reach={Math.max(18, towerSize.x + towerSize.z)}
          animate={!reducedMotion}
        />
      )}

      {showWorks &&
        works.map(({ key, box, below }) => (
          <group key={key}>
            <Scaffold box={box} bottom={below} />
            <ColumnStubs box={box} rise={partial * (box.max.y - box.min.y)} />
          </group>
        ))}
      {showWorks && hoistTop > bounds.min.y && (
        <Hoist
          x={tower.max.x - 2.5}
          z={tower.max.z + 1.6}
          base={bounds.min.y}
          top={hoistTop}
          animate={!reducedMotion}
        />
      )}

      {hovered > 0 && floorBoxes.get(hovered) && (
        <Html
          position={[
            bounds.max.x,
            (floorBoxes.get(hovered)!.max.y + floorBoxes.get(hovered)!.min.y) / 2 +
              hovered * settings.explode * 2.4,
            center.z,
          ]}
          center
          className="floor-tag"
          zIndexRange={[20, 0]}
        >
          <b>Floor {hovered}</b>
          <span data-status={floorStatus(hovered, progress, floors)}>
            {settings.planned ? 'Planned design' : floorStatus(hovered, progress, floors)}
          </span>
          {evidence.some((e) => e.floor === hovered) && (
            <small>
              {evidence.filter((e) => e.floor === hovered).length} photo
              {evidence.filter((e) => e.floor === hovered).length > 1 ? 's' : ''}
            </small>
          )}
        </Html>
      )}

      {evidence.slice(0, 4).map((e, i) =>
        // Hide pins on floors that are filtered out or not yet built (e.g. mid-timelapse).
        (settings.floor && e.floor > settings.floor) ||
        (!settings.planned && e.floor > complete + 1) ? null : (
          <Html key={e.id} position={pinFor(e, i)} center zIndexRange={[15, 0]}>
            <button
              className="evidence-pin"
              aria-label={'Photo pin ' + e.point}
              onClick={() => {
                const [x, y, z] = pinFor(e, i);
                const c = controls.current;
                if (c) {
                  const eye = new Vector3()
                    .setFromSphericalCoords(
                      Math.max(28, reach * 0.55),
                      MathUtils.degToRad(70),
                      c.azimuthAngle,
                    )
                    .add(new Vector3(x, y, z));
                  c.setLookAt(eye.x, eye.y, eye.z, x, y, z, !reducedMotion);
                }
                onEvidence(e);
              }}
            >
              <span />
            </button>
          </Html>
        ),
      )}

      <CameraControls
        ref={controls}
        makeDefault
        minDistance={8}
        maxDistance={reach * 9}
        maxPolarAngle={Math.PI / 2.05}
        smoothTime={0.6}
        onStart={() => (lastInput.current = performance.now())}
        onEnd={() => (lastInput.current = performance.now())}
      />

      {/* The effect chain writes an opaque frame, so transparent stills render without it. */}
      {backdrop && (
        <EffectComposer multisampling={4} enableNormalPass={false}>
          <N8AO
            halfRes
            aoRadius={Math.max(2, radius * 0.08)}
            intensity={2.2}
            distanceFalloff={1}
            quality="medium"
          />
          <Bloom mipmapBlur luminanceThreshold={0.85} luminanceSmoothing={0.2} intensity={0.55} />
          <SMAA preset={SMAAPreset.ULTRA} />
          <ToneMapping mode={ToneMappingMode.NEUTRAL} />
          <Vignette offset={0.35} darkness={0.28} />
        </EffectComposer>
      )}
    </>
  );
}
