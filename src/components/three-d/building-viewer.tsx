'use client';
import { Component, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { NeutralToneMapping } from 'three';
import { PerformanceMonitor } from '@react-three/drei';
import { AnimatePresence, animate, motion, useReducedMotion } from 'motion/react';
import { Layers, Moon, Pause, Play, RotateCcw, ScanLine, Sun, X } from 'lucide-react';
import type { Evidence } from '@/types/domain';
import { Segmented } from '@/components/ui/segmented';
import { BuildingScene, floorStatus, type SceneApi, type ViewerSettings } from './building-scene';

class ViewerBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="viewer-fallback">
        <h3>3D view unavailable</h3>
        <p>
          Enable WebGL or reload in a supported browser. Your project records are still available.
        </p>
        <button onClick={() => this.setState({ failed: false })}>Retry model</button>
      </div>
    ) : (
      this.props.children
    );
  }
}

export default function BuildingViewer({
  file,
  floors,
  progress,
  evidence = [],
}: {
  file: string;
  floors: number;
  progress: number;
  evidence?: Evidence[];
}) {
  const reducedMotion = !!useReducedMotion();
  const [settings, setSettings] = useState<ViewerSettings>({
    planned: false,
    floor: 0,
    layer: 'all',
    explode: 0,
    section: 0,
    dusk: false,
  });
  const [hovered, setHovered] = useState(0);
  const [selected, setSelected] = useState('');
  const [photo, setPhoto] = useState<Evidence | null>(null);
  const [snapshot, setSnapshot] = useState('latest');
  const [loaded, setLoaded] = useState(false);
  // Adaptive resolution: start crisp, step down if the frame rate drops, back up when it recovers.
  const [dpr, setDpr] = useState(1.75);
  // `?still` draws the bare building on a transparent canvas, for scripts/render-stills.cjs.
  const [still] = useState(() => new URLSearchParams(window.location.search).has('still'));
  const scene = useRef<SceneApi | null>(null);
  const set = (patch: Partial<ViewerSettings>) => setSettings((s) => ({ ...s, ...patch }));

  const history = evidence.toSorted((a, b) => a.createdAt.localeCompare(b.createdAt));
  const approved = history.find((e) => e.id === snapshot)?.completion ?? progress;
  // Timelapse: when set, the model shows this progress instead of the approved figure.
  const [timelapse, setTimelapse] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const current = timelapse ?? approved;
  useEffect(() => {
    if (!playing) return;
    const from = timelapse !== null && timelapse < approved - 1 ? timelapse : 0;
    const controls = animate(from, approved, {
      duration: reducedMotion ? 0 : Math.max(2, ((approved - from) / 100) * 9),
      ease: 'linear',
      onUpdate: (v) => setTimelapse(Math.round(v * 10) / 10),
      onComplete: () => {
        setPlaying(false);
        setTimelapse(null);
      },
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);
  const focusFloor = settings.floor;
  const floorEvidence = evidence.filter((e) => e.floor === focusFloor);

  return (
    <section className="viewer-card">
      <div className="section-heading">
        <div>
          <h2>
            {settings.planned ? 'Planned architectural concept' : 'Approved construction stage'}
          </h2>
        </div>
        <span className="badge accent">
          {settings.planned
            ? 'Concept'
            : timelapse !== null
              ? 'Timelapse · ' + Math.round(current) + '%'
              : current + '% approved'}
        </span>
      </div>

      <div className="toolbar">
        <Segmented
          label="Model stage"
          value={settings.planned ? 'planned' : 'current'}
          onChange={(v) => set({ planned: v === 'planned' })}
          options={[
            { value: 'current', label: 'Current stage' },
            { value: 'planned', label: 'Planned result' },
          ]}
        />
        <select
          aria-label="Floor"
          value={settings.floor}
          onChange={(e) => set({ floor: Number(e.target.value) })}
        >
          <option value={0}>Whole building</option>
          {Array.from({ length: floors }, (_, i) => (
            <option key={i} value={i + 1}>
              Floor {i + 1}
            </option>
          ))}
        </select>
        <select
          aria-label="Model layers"
          value={settings.layer}
          onChange={(e) => set({ layer: e.target.value as ViewerSettings['layer'] })}
        >
          <option value="all">All layers</option>
          <option value="structure">Structure only</option>
        </select>
        <button
          className="secondary icon-text"
          onClick={() => {
            scene.current?.reset();
            set({ floor: 0, explode: 0, section: 0 });
            setSelected('');
          }}
        >
          <RotateCcw size={14} /> Reset view
        </button>
        <Segmented
          label="Lighting"
          size="sm"
          value={settings.dusk ? 'dusk' : 'day'}
          onChange={(v) => set({ dusk: v === 'dusk' })}
          options={[
            { value: 'day', label: 'Day' },
            { value: 'dusk', label: 'Dusk' },
          ]}
        />
      </div>

      <ViewerBoundary key={file}>
        <div className="model-canvas">
          <Canvas
            shadows="soft"
            dpr={still ? 2 : dpr}
            camera={{ position: [120, 90, 130], fov: 32, near: 0.5, far: 4000 }}
            gl={{
              preserveDrawingBuffer: true,
              antialias: false,
              powerPreference: 'high-performance',
            }}
            onCreated={({ gl }) => {
              gl.localClippingEnabled = true;
              // Without the effect chain the renderer tone-maps; match the chain's curve.
              if (still) gl.toneMapping = NeutralToneMapping;
            }}
            onPointerMissed={() => set({ floor: 0 })}
          >
            <PerformanceMonitor
              bounds={() => [45, 58]}
              flipflops={3}
              onDecline={() => setDpr((d) => Math.max(1, d - 0.25))}
              onIncline={() => setDpr((d) => Math.min(2, d + 0.25))}
              onFallback={() => setDpr(1)}
            />
            <Suspense fallback={null}>
              <BuildingScene
                file={file}
                floors={floors}
                progress={current}
                settings={settings}
                hovered={hovered}
                evidence={evidence}
                reducedMotion={reducedMotion}
                backdrop={!still}
                apiRef={scene}
                onHover={setHovered}
                onPickFloor={(n) => set({ floor: settings.floor === n ? 0 : n })}
                onPickElement={setSelected}
                onEvidence={setPhoto}
                onReady={() => setLoaded(true)}
              />
            </Suspense>
          </Canvas>

          <AnimatePresence>
            {!loaded && (
              <motion.div
                className="canvas-loader"
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
              >
                <span className="loader-bar" />
                Loading architectural model…
              </motion.div>
            )}
          </AnimatePresence>

          {!settings.planned && (
            <div className="timeline-bar">
              <button
                className="icon-only play"
                aria-label={
                  playing ? 'Pause construction timelapse' : 'Play construction timelapse'
                }
                onClick={() => setPlaying((p) => !p)}
              >
                {playing ? <Pause size={15} /> : <Play size={15} />}
              </button>
              <input
                aria-label="Construction timeline"
                type="range"
                min={0}
                max={approved}
                step={0.5}
                value={current}
                style={
                  {
                    '--fill': (approved ? (current / approved) * 100 : 0) + '%',
                  } as React.CSSProperties
                }
                onChange={(e) => {
                  setPlaying(false);
                  const v = Number(e.target.value);
                  setTimelapse(v >= approved ? null : v);
                }}
              />
              <span className="timeline-value">{Math.round(current)}%</span>
            </div>
          )}

          <div className="viewer-dock">
            <label title="Separate the floors vertically">
              <Layers size={14} />
              Explode
              <input
                aria-label="Explode floors"
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={settings.explode}
                onChange={(e) => set({ explode: Number(e.target.value) })}
              />
            </label>
            <label title="Cut through the building to see inside">
              <ScanLine size={14} />
              Section
              <input
                aria-label="Section cut"
                type="range"
                min={0}
                max={0.95}
                step={0.01}
                value={settings.section}
                onChange={(e) => set({ section: Number(e.target.value) })}
              />
            </label>
          </div>

          <AnimatePresence>
            {focusFloor > 0 && (
              <motion.aside
                className="floor-card"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.3 }}
              >
                <button
                  className="icon-only"
                  aria-label="Close floor details"
                  onClick={() => set({ floor: 0 })}
                >
                  <X size={14} />
                </button>
                <p className="eyebrow">Floor {focusFloor}</p>
                <h3>
                  {settings.planned ? 'Planned design' : floorStatus(focusFloor, current, floors)}
                </h3>
                <p>
                  {floorEvidence.length
                    ? floorEvidence.length +
                      ' approved photo' +
                      (floorEvidence.length > 1 ? 's' : '') +
                      ' on this level'
                    : 'No approved photos on this level yet'}
                </p>
                {floorEvidence.slice(0, 2).map((e) => (
                  <button key={e.id} className="secondary" onClick={() => setPhoto(e)}>
                    {e.point} · {e.completion}%
                  </button>
                ))}
              </motion.aside>
            )}
          </AnimatePresence>
        </div>
      </ViewerBoundary>

      <p className="fine-print" role="status">
        {loaded ? 'Model ready · local GLB loaded' : 'Loading architectural model…'}
      </p>

      <div className="photo-strip">
        {evidence.slice(0, 4).map((e, i) => (
          <button
            key={e.id}
            className="secondary chip"
            aria-label={'Evidence ' + e.point + ' ' + e.completion + '%'}
            onClick={() => setPhoto(e)}
          >
            <span className="chip-dot" />
            Evidence {i + 1} · {e.point}
          </button>
        ))}
      </div>

      <div className="viewer-caption">
        <span>
          {settings.dusk ? <Moon size={12} /> : <Sun size={12} />} Drag to orbit · scroll to zoom ·
          hover a floor · click to focus it · press play to watch it rise
        </span>
        <label>
          Approved history
          <select
            aria-label="Approved history"
            value={snapshot}
            onChange={(e) => setSnapshot(e.target.value)}
          >
            <option value="latest">Latest approved</option>
            {history.map((e) => (
              <option key={e.id} value={e.id}>
                {e.createdAt.slice(0, 10)} · {e.completion}%
              </option>
            ))}
          </select>
        </label>
      </div>

      {selected && <p role="status">Selected element: {selected}</p>}

      <AnimatePresence>
        {photo && (
          <motion.div
            className="evidence-detail"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.image} width={220} alt="Model-linked approved evidence" />
            <div>
              <h3>
                {photo.point} · {photo.completion}%
              </h3>
              <p>{photo.publicSummary ?? 'Approved site photograph'}</p>
              <button className="secondary" onClick={() => setPhoto(null)}>
                Close evidence
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="fine-print">
        Authored conceptual architecture. Floor shading illustrates the reported completion; it is
        not measured geometry. Evidence pins are illustrative locations. History reuses this asset
        with dated approved progress.
      </p>
    </section>
  );
}
