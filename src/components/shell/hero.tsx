import type { ReactNode } from 'react';

/**
 * Top of every page: title, scope filters and (on dashboards) the KPI band as one block,
 * with a still of the building currently in view.
 */
export function Hero({
  eyebrow,
  title,
  subtitle,
  render,
  filters,
  summary,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  /** Path of the building still; omitted when no building is in scope. */
  render?: string;
  filters: ReactNode;
  summary?: ReactNode;
}) {
  return (
    <section className="hero">
      <div className="hero-top">
        <div className="hero-copy">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{subtitle}</p>
          {filters}
        </div>
        {render && (
          // Decorative: the same building is described by the text and shown live in the Model view.
          // eslint-disable-next-line @next/next/no-img-element
          <img className="hero-render" src={render} alt="" />
        )}
      </div>
      {summary}
    </section>
  );
}
