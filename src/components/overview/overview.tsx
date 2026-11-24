'use client';
import { useState, type ReactNode } from 'react';
import type { Dataset, Role } from '@/types/domain';
import type { Insight } from '@/lib/kpi-calculations';
import { external } from '@/lib/permissions';
import {
  dueToday,
  latestPublicSummary,
  openTasks,
  overdueTasks,
  pendingEvidenceBy,
  unresolvedIssues,
} from '@/lib/selectors';
import Analytics from '@/components/dashboards/analytics';
import { ProjectCards } from './project-cards';
import { Segmented } from '@/components/ui/segmented';
import { CountUp, Stagger } from '@/components/ui/motion';
import type { View } from '@/components/shell/workspace-nav';

type Props = {
  data: Dataset;
  role: Role;
  userId: string;
  view: View;
  date: string;
  from: string;
  analyticsTab: string;
  model: ReactNode;
  onAnalyticsTab: (tab: string) => void;
  onDrill: (insight: Insight) => void;
  onNavigate: (view: View, filter?: string) => void;
  onOpenProject: (projectId: string) => void;
  onCapture: () => void;
};

/** Dashboard views (Overview / Analytics / Timeline): the role's main panel under the hero. */
export function Overview(props: Props) {
  const { data, role, view, model, onNavigate } = props;
  const analytics = (tab = props.analyticsTab) => (
    <Analytics
      data={data}
      role={role}
      date={props.date}
      from={props.from}
      tab={tab}
      onTab={props.onAnalyticsTab}
      onDrill={props.onDrill}
    />
  );

  if (external(role)) {
    if (view !== 'Overview') return analytics('Progress');
    return (
      <>
        {model}
        <section className="callout">
          <div>
            <p className="eyebrow">Latest update</p>
            <h2>What changed?</h2>
            <p>{latestPublicSummary(data) ?? 'No published update yet.'}</p>
          </div>
          <button onClick={() => onNavigate('Published updates')}>View approved photographs</button>
        </section>
      </>
    );
  }

  if (role === 'engineer') return <EngineerOverview {...props} analytics={analytics()} />;

  if (role === 'partner' || role === 'property') {
    return (
      <>
        <section className="callout">
          <div>
            <h2>{role === 'property' ? 'Maintenance coordination' : 'Assigned work packages'}</h2>
            <p>
              {openTasks(data).length} open assignments · {overdueTasks(data).length} overdue
            </p>
          </div>
          <button onClick={() => onNavigate('Tasks')}>Open assigned work</button>
        </section>
        {model}
      </>
    );
  }

  // Portfolio view: show the projects themselves before the charts.
  if (view === 'Overview' && data.projects.length > 1)
    return (
      <>
        <ProjectCards data={data} date={props.date} onOpen={props.onOpenProject} />
        {analytics()}
      </>
    );
  return analytics();
}

function EngineerOverview({
  data,
  userId,
  model,
  analytics,
  onNavigate,
  onCapture,
}: Props & { analytics: ReactNode }) {
  const [mode, setMode] = useState<'Site' | 'My work'>('Site');
  const priorities = [
    { label: 'Due today', value: dueToday(data).length },
    { label: 'Missed deadlines', value: overdueTasks(data).length },
    { label: 'Awaiting approval', value: pendingEvidenceBy(data, userId).length },
    { label: 'Issues to resolve', value: unresolvedIssues(data).length },
  ];
  return (
    <>
      <Segmented
        tabs
        label="Overview mode"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'Site', label: 'Site overview' },
          { value: 'My work', label: 'My work analytics' },
        ]}
      />
      {mode === 'My work' ? (
        analytics
      ) : (
        <>
          <section>
            <div className="section-heading">
              <h2>Today’s priorities</h2>
              <button onClick={onCapture}>Capture a site update</button>
            </div>
            <Stagger className="priority-grid">
              {priorities.map((p) => (
                <Stagger.Item as="div" key={p.label} className={p.value ? 'has-value' : ''}>
                  <CountUp value={p.value} />
                  <p>{p.label}</p>
                </Stagger.Item>
              ))}
            </Stagger>
            <ul className="task-preview">
              {openTasks(data)
                .slice(0, 3)
                .map((t) => (
                  <li key={t.id}>
                    <span>{t.title}</span>
                    <time>due {t.due}</time>
                  </li>
                ))}
            </ul>
            <button className="secondary" onClick={() => onNavigate('Tasks')}>
              Open my deadlines
            </button>
          </section>
          {model}
        </>
      )}
    </>
  );
}
