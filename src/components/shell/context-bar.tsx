'use client';
import { SNAPSHOT } from '@/data/projects';
import type { Dataset } from '@/types/domain';

/** Project / building scope plus the history window shown on dashboard views. */
export function ContextBar({
  allowed,
  project,
  building,
  allowAll,
  showDates,
  from,
  date,
  onProject,
  onBuilding,
  onFrom,
  onDate,
}: {
  allowed: Dataset;
  project: string;
  building: string;
  allowAll: boolean;
  showDates: boolean;
  from: string;
  date: string;
  onProject: (id: string) => void;
  onBuilding: (id: string) => void;
  onFrom: (month: string) => void;
  onDate: (day: string) => void;
}) {
  return (
    <div className="context-bar">
      <label>
        Project
        <select aria-label="Project" value={project} onChange={(e) => onProject(e.target.value)}>
          {allowAll && <option value="all">All assigned projects</option>}
          {allowed.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Building
        <select aria-label="Building" value={building} onChange={(e) => onBuilding(e.target.value)}>
          {allowAll && <option value="all">All assigned buildings</option>}
          {allowed.buildings
            .filter((b) => project === 'all' || b.projectId === project)
            .map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} · {b.projectId}
              </option>
            ))}
        </select>
      </label>
      {showDates && (
        <>
          <label>
            History from
            <input
              aria-label="History from"
              type="month"
              min="2026-05"
              max={date.slice(0, 7)}
              value={from}
              onChange={(e) =>
                e.target.value && e.target.value <= date.slice(0, 7) && onFrom(e.target.value)
              }
            />
          </label>
          <label>
            As of
            <input
              aria-label="As of"
              type="date"
              min={from + '-01'}
              max={SNAPSHOT}
              value={date}
              onChange={(e) => {
                const v = e.target.value;
                if (v && v >= from + '-01' && v <= SNAPSHOT) onDate(v);
              }}
            />
          </label>
        </>
      )}
    </div>
  );
}
