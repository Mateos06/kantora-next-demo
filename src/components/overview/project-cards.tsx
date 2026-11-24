'use client';
import type { Dataset } from '@/types/domain';
import { planned, progress, projectStats } from '@/lib/kpi-calculations';
import { renderOf } from '@/lib/renders';
import { Gauge, Stagger } from '@/components/ui/motion';

/** Portfolio at a glance: one card per project with a still of its building and progress against plan. */
export function ProjectCards({
  data,
  date,
  onOpen,
}: {
  data: Dataset;
  date: string;
  onOpen: (projectId: string) => void;
}) {
  return (
    <Stagger className="project-cards">
      {data.projects.map((project) => {
        const buildings = data.buildings.filter((b) => b.projectId === project.id);
        const done = progress(data, buildings, date);
        const plan = planned(data, buildings, date);
        const { late } = projectStats(data, project, date);
        return (
          <Stagger.Item as="article" key={project.id} className="project-card">
            {buildings[0] && (
              <div className="project-card-image">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={renderOf(buildings[0].model)} alt="" />
              </div>
            )}
            <div className="project-card-body">
              <h3>{project.name}</h3>
              <small>
                {project.city} · {buildings.length} building{buildings.length === 1 ? '' : 's'}
              </small>
              <strong>{done}%</strong>
              <Gauge value={done} plan={plan} />
              <p>
                Plan {plan}% · {late ? late + ' late' : 'on schedule'} · delivery{' '}
                {project.delivery.slice(0, 7)}
              </p>
              <button className="text-button" onClick={() => onOpen(project.id)}>
                Open {project.name}
              </button>
            </div>
          </Stagger.Item>
        );
      })}
    </Stagger>
  );
}
