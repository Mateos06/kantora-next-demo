'use client';
import { useId } from 'react';
import { motion } from 'motion/react';

/** Segmented control / tab strip with a highlight that glides to the selected option. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  tabs = false,
  size = 'md',
}: {
  options: readonly (T | { value: T; label: string })[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  tabs?: boolean;
  size?: 'sm' | 'md';
}) {
  const id = useId();
  return (
    <div className={'segmented ' + size} role={tabs ? 'tablist' : 'group'} aria-label={label}>
      {options.map((option) => {
        const { value: v, label: text } =
          typeof option === 'string' ? { value: option, label: option } : option;
        const selected = v === value;
        return (
          <button
            key={v}
            type="button"
            role={tabs ? 'tab' : undefined}
            aria-selected={tabs ? selected : undefined}
            aria-pressed={tabs ? undefined : selected}
            className={selected ? 'selected' : ''}
            onClick={() => onChange(v)}
          >
            {selected && (
              <motion.span
                layoutId={id}
                className="segmented-thumb"
                transition={{ type: 'spring', stiffness: 520, damping: 40 }}
              />
            )}
            <span className="segmented-label">{text}</span>
          </button>
        );
      })}
    </div>
  );
}
