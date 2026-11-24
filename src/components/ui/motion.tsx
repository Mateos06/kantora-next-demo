'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { animate, motion, useInView, useReducedMotion, type Variants } from 'motion/react';

const EASE = [0.22, 1, 0.36, 1] as const;

/** Number that counts up from zero the first time it scrolls into view. Keeps decimals, prefix and suffix. */
export function CountUp({ value, testId }: { value: string | number; testId?: string }) {
  const ref = useRef<HTMLElement>(null);
  const seen = useInView(ref, { once: true });
  const reduced = useReducedMotion();
  const text = String(value);
  const match = text.match(/^([^\d-]*)(-?\d+(?:\.\d+)?)(.*)$/);
  useEffect(() => {
    const el = ref.current;
    if (!el || !match || !seen || reduced) return;
    const [, prefix, digits, suffix] = match;
    const target = Number(digits);
    const decimals = digits.split('.')[1]?.length ?? 0;
    const controls = animate(0, target, {
      duration: 0.6,
      ease: EASE,
      onUpdate: (v) => (el.textContent = prefix + v.toFixed(decimals) + suffix),
      onComplete: () => (el.textContent = text),
    });
    return () => {
      controls.stop();
      el.textContent = text;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, seen, reduced]);
  return (
    <strong ref={ref} data-testid={testId}>
      {text}
    </strong>
  );
}

const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.03 } } };
const item: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } },
};

/** Children marked with <Stagger.Item> fade in one after another. */
export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={container} initial="hidden" animate="show">
      {children}
    </motion.div>
  );
}
Stagger.Item = function StaggerItem({
  children,
  className,
  as = 'section',
}: {
  children: ReactNode;
  className?: string;
  as?: 'section' | 'div' | 'article';
}) {
  const Tag = motion[as];
  return (
    <Tag className={className} variants={item}>
      {children}
    </Tag>
  );
};

/** Content that fades up when its key changes (tab switches, role switches). */
export function Enter({ children, id }: { children: ReactNode; id: string }) {
  return (
    <motion.div
      key={id}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** Horizontal bar that fills to `value` percent on first view. */
export function Meter({ value, tone = 'accent' }: { value: number; tone?: 'accent' | 'ink' }) {
  return (
    <div
      className={'meter ' + tone}
      role="meter"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <motion.span
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: Math.max(0, Math.min(1, value / 100)) }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: EASE }}
      />
    </div>
  );
}

/** Bullet gauge: a bar filled to `value` percent with a tick where the plan says it should be. */
export function Gauge({ value, plan }: { value: number; plan: number }) {
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  return (
    <div
      className="gauge"
      role="img"
      aria-label={value + '% verified against ' + plan + '% planned'}
    >
      <motion.span
        initial={{ scaleX: 0 }}
        animate={{ scaleX: clamp(value) / 100 }}
        transition={{ duration: 0.7, ease: EASE }}
      />
      <i style={{ left: clamp(plan) + '%' }} />
    </div>
  );
}

/** Circular progress ring that sweeps to `value` percent. */
export function Ring({ value, size = 56 }: { value: number; size?: number }) {
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  return (
    <svg
      className="progress-ring"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden
    >
      <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        className="ring-fill"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - Math.max(0, Math.min(1, value / 100))) }}
        transition={{ duration: 0.7, ease: EASE }}
      />
    </svg>
  );
}

/** Tiny trend line for metric cards. */
export function Sparkline({
  values,
  width = 120,
  height = 34,
}: {
  values: number[];
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values),
    max = Math.max(...values);
  // A flat line says nothing; show the sparkline only when the value actually moved.
  if (max === min) return null;
  const span = max - min;
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * width,
    height - 3 - ((v - min) / span) * (height - 6),
  ]);
  const d = pts.map(([x, y], i) => (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1)).join(' ');
  return (
    <svg
      className="sparkline"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
    >
      <motion.path
        d={d}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1.5}
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.7, ease: EASE }}
      />
    </svg>
  );
}
