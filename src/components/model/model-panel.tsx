'use client';
import dynamic from 'next/dynamic';
import type { Building, Dataset, User } from '@/types/domain';
import { buildingProgress } from '@/lib/kpi-calculations';
import { approvedEvidence } from '@/lib/selectors';
import { CountUp, Meter, Ring } from '@/components/ui/motion';

const Viewer = dynamic(() => import('../three-d/building-viewer'), {
  ssr: false,
  loading: () => (
    <section className="viewer-card skeleton">
      <div className="model-canvas shimmer" />
    </section>
  ),
});

/** 3D viewer plus the building fact sheet beside it. */
export function ModelPanel({
  data,
  building,
  users,
  date,
  outside,
}: {
  data: Dataset;
  building: Building;
  users: User[];
  date: string;
  outside: boolean;
}) {
  const project = data.projects.find((p) => p.id === building.projectId);
  const progress = buildingProgress(data, building.id, date);
  const engineer = users.find((u) => u.id === building.engineerId)?.name;
  return (
    <div className="model-layout">
      <Viewer
        key={building.id}
        file={building.model}
        floors={building.floors}
        progress={progress}
        evidence={approvedEvidence(data, building.id, date)}
      />
      <section className="model-info">
        <p className="eyebrow">{project?.name}</p>
        <h2>{building.name}</h2>
        <p>{outside ? building.unit : 'Assigned engineer: ' + engineer}</p>
        <div className="model-progress">
          <Ring value={progress} size={64} />
          <div>
            <CountUp value={progress + '%'} />
            <p>Verified completion</p>
          </div>
        </div>
        <p>
          Expected delivery
          <br />
          <b>{project?.delivery}</b>
        </p>
        <hr />
        {data.milestones
          .filter((m) => m.buildingId === building.id)
          .map((m) => (
            <div key={m.id} className="milestone">
              <p>
                {m.title} <span>{m.completion}%</span>
              </p>
              <Meter value={m.completion} />
            </div>
          ))}
        <p className="fine-print">
          Architectural concept reused for fictional demo buildings. Stage configurations illustrate
          progress, not measured as-built geometry.
        </p>
      </section>
    </div>
  );
}
