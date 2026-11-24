'use client';
import { useEffect, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { useDemo, LEGACY_KEY } from '@/store/demo-store';
import { SNAPSHOT } from '@/data/projects';
import type { Role, Evidence } from '@/types/domain';
import { external, canReview, scopedData } from '@/lib/permissions';
import { filterDataset, progress, projectStats, type Insight } from '@/lib/kpi-calculations';
import { downloadCsv } from '@/lib/export';
import { Capture, Updates, Tasks, Milestones, Quality } from './workflows/records';
import { openTasks, unresolvedIssues } from '@/lib/selectors';
import { Sidebar } from './shell/sidebar';
import { TopBar } from './shell/top-bar';
import { ContextBar } from './shell/context-bar';
import { DASHBOARD_VIEWS, ROLE_TITLES, navFor, type View } from './shell/workspace-nav';
import { ModelPanel } from './model/model-panel';
import { Overview } from './overview/overview';
import { Segmented } from './ui/segmented';
import { Enter } from './ui/motion';
import { Hero } from './shell/hero';
import { Summary } from './dashboards/analytics';
import { cutoutOf, renderOf } from '@/lib/renders';

type Act = (fn: () => void) => void;

export default function Platform({ initialRole }: { initialRole?: Role }) {
  const s = useDemo();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [tab, setTab] = useState<View>('Overview');
  const [analyticsTab, setAnalyticsTab] = useState('Time');
  const [planningTab, setPlanningTab] = useState('Tasks');
  const [filter, setFilter] = useState('');
  const [from, setFrom] = useState('2026-05');
  const [date, setDate] = useState(SNAPSHOT);
  const [editing, setEditing] = useState<Evidence | undefined>();
  const [legacy, setLegacy] = useState(false);

  useEffect(() => {
    Promise.resolve(useDemo.persist.rehydrate())
      .then(() => {
        if (initialRole && useDemo.getState().role !== initialRole)
          useDemo.getState().setDemoRole(initialRole);
        setLegacy(!!localStorage.getItem(LEGACY_KEY));
        setReady(true);
      })
      .catch((e) => setError('Could not restore saved demo: ' + e.message));
  }, [initialRole]);

  if (!ready)
    return (
      <main className="boot">
        <span className="brand-mark pulse" />
        <p>{error || 'Restoring your demonstration…'}</p>
      </main>
    );

  const outside = external(s.role);
  const review = canReview(s.role);
  const allowed = scopedData(s);
  const data = filterDataset(allowed, s.selectedProject, s.selectedBuilding);
  const building = data.buildings[0];
  const project = data.projects.find((p) => p.id === building?.projectId);
  const nav = navFor(s.role);
  const active: View = nav.includes(tab) ? tab : 'Overview';
  const dashboard = DASHBOARD_VIEWS.includes(active);
  const wholePortfolio = s.selectedProject === 'all';

  // Open work per view, so the navigation shows where attention is needed.
  const open = openTasks(data).length;
  const counts = {
    Tasks: open,
    Planning: open,
    Updates: data.evidence.filter((e) => e.status === 'pending').length,
    Quality: unresolvedIssues(data).length,
  };

  const act: Act = (fn) => {
    try {
      fn();
      setMessage('Saved in this browser.');
      setError('');
    } catch (e) {
      setError((e as Error).message);
      setMessage('');
    }
  };
  const navigate = (next: View, f = '') => {
    setFilter(f);
    setTab(next);
    setMessage('');
    setError('');
  };
  const scope = (fn: () => void) => {
    act(fn);
    setEditing(undefined);
  };
  const drill = (i: Insight) => {
    act(() => s.selectProject(i.projectId));
    if (i.view === 'Milestones') {
      setPlanningTab('Milestones');
      navigate('Planning', i.filter);
    } else if (i.view === 'Analytics') {
      setAnalyticsTab(i.filter);
      navigate(s.role === 'director' ? 'Analytics' : 'Overview');
    } else if (i.view === 'Updates' && s.role === 'director') {
      setPlanningTab('Updates');
      navigate('Planning', i.filter);
    } else navigate(i.view as View, i.filter);
  };
  const reset = () => {
    if (!confirm('Reset all current scenario records? The archived previous demo is kept.')) return;
    act(() => {
      s.resetDemoData();
      s.setDemoRole(s.role);
    });
    navigate('Overview');
  };
  const openModel = (id: string) => {
    act(() => s.selectBuilding(id));
    navigate('Model');
  };

  const model = building && (
    <ModelPanel data={data} building={building} users={s.users} date={date} outside={outside} />
  );

  return (
    <MotionConfig reducedMotion="user">
      <div className="app-shell">
        <Sidebar
          role={s.role}
          nav={nav}
          active={active}
          counts={outside ? {} : counts}
          userName={s.users.find((u) => u.id === s.userId)?.name}
          scope={{
            title: wholePortfolio ? 'Portfolio' : (project?.name ?? ''),
            detail: wholePortfolio
              ? data.projects.length + ' projects'
              : s.selectedBuilding === 'all'
                ? data.buildings.length + ' buildings'
                : (building?.name ?? ''),
            progress: progress(data, data.buildings, date),
            render: building && cutoutOf(building.model),
          }}
          onNavigate={(v) => navigate(v)}
        />
        <main>
          <TopBar
            crumb={wholePortfolio ? 'Portfolio' : (project?.name ?? '')}
            identity={
              <label className="role-picker">
                as
                <select
                  aria-label="Demo identity"
                  value={s.userId}
                  onChange={(e) => scope(() => s.selectUser(e.target.value))}
                >
                  {s.users
                    .filter((u) => u.role === s.role)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                </select>
              </label>
            }
            role={s.role}
            activities={allowed.activities}
            unread={allowed.activities.filter((a) => !a.readBy.includes(s.userId)).length}
            legacy={legacy}
            onMarkRead={() => act(s.markNotificationsRead)}
            onRole={(role) => {
              act(() => s.setDemoRole(role));
              navigate('Overview');
              setEditing(undefined);
              window.history.replaceState(null, '', '/' + role);
            }}
            onShowcase={() => {
              act(() => {
                s.setDemoRole('engineer');
                s.selectBuilding('lakeview-1');
              });
              navigate('Capture');
            }}
            onReset={reset}
          />

          <Enter id={s.role}>
            <Hero
              eyebrow={active}
              title={ROLE_TITLES[s.role]}
              subtitle={
                outside
                  ? 'Approved updates for your authorized property.'
                  : 'Connected site evidence. Clear management decisions.'
              }
              render={building && renderOf(building.model)}
              filters={
                <ContextBar
                  allowed={allowed}
                  project={s.selectedProject}
                  building={s.selectedBuilding}
                  allowAll={!outside && s.role !== 'engineer'}
                  showDates={dashboard}
                  from={from}
                  date={date}
                  onProject={(id) => scope(() => s.selectProject(id))}
                  onBuilding={(id) => scope(() => s.selectBuilding(id))}
                  onFrom={setFrom}
                  onDate={setDate}
                />
              }
              summary={dashboard && <Summary data={data} role={s.role} date={date} />}
            />
          </Enter>

          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
          {message && (
            <div className="notice" role="status">
              {message}
            </div>
          )}

          <Enter id={s.role + active}>
            {dashboard && (
              <Overview
                data={data}
                role={s.role}
                userId={s.userId}
                view={active}
                date={date}
                from={from}
                analyticsTab={analyticsTab}
                model={model}
                onAnalyticsTab={setAnalyticsTab}
                onDrill={drill}
                onNavigate={navigate}
                onOpenProject={(id) => scope(() => s.selectProject(id))}
                onCapture={() => {
                  setEditing(undefined);
                  navigate('Capture');
                }}
              />
            )}

            {active === 'Model' && model}

            {active === 'Capture' && s.role === 'engineer' && building && (
              <Capture
                key={building.id + (editing?.id ?? 'new')}
                data={data}
                building={building}
                editing={editing}
                act={act}
                onDone={() => {
                  setEditing(undefined);
                  navigate('Updates', 'pending');
                }}
              />
            )}

            {(active === 'Updates' || active === 'Published updates') && (
              <Updates
                key={filter + s.selectedProject + s.selectedBuilding}
                data={data}
                act={act}
                filter={outside ? 'approved' : filter}
                onEdit={(e) => {
                  setEditing(e);
                  act(() => s.selectBuilding(e.buildingId));
                  navigate('Capture');
                }}
                onModel={openModel}
              />
            )}

            {active === 'Tasks' && <Tasks data={data} act={act} />}

            {active === 'Planning' && (
              <>
                <Segmented
                  tabs
                  label="Planning view"
                  value={planningTab}
                  onChange={(t) => {
                    setPlanningTab(t);
                    setFilter('');
                  }}
                  options={['Tasks', 'Milestones', ...(s.role === 'director' ? ['Updates'] : [])]}
                />
                {planningTab === 'Milestones' ? (
                  <Milestones
                    key={filter + s.selectedProject}
                    data={data}
                    act={act}
                    filter={filter}
                  />
                ) : planningTab === 'Updates' ? (
                  <Updates
                    data={data}
                    act={act}
                    filter={filter}
                    onEdit={() => {}}
                    onModel={openModel}
                  />
                ) : (
                  <Tasks data={data} act={act} />
                )}
              </>
            )}

            {active === 'Quality' && (
              <Quality
                key={filter + s.selectedProject + s.selectedBuilding}
                data={data}
                act={act}
                filter={filter}
              />
            )}

            {review && active === 'Overview' && analyticsTab === 'Cost' && (
              <CostEstimates data={data} act={act} update={s.updateRemainingCost} />
            )}

            {!outside && active === 'Overview' && <ActivityPanel data={data} />}
          </Enter>

          <footer>
            <span>
              Fictional demonstration data · frontend access simulation · snapshot {SNAPSHOT}
            </span>
            <button className="text-button" onClick={reset}>
              Reset demo data
            </button>
          </footer>
        </main>
      </div>
    </MotionConfig>
  );
}

function CostEstimates({
  data,
  act,
  update,
}: {
  data: ReturnType<typeof filterDataset>;
  act: Act;
  update: (projectId: string, value: number) => void;
}) {
  return (
    <section>
      <h2>Revise remaining-cost estimate</h2>
      {data.projects.map((p) => (
        <form
          key={p.id}
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            act(() => update(p.id, Number(new FormData(e.currentTarget).get('remaining'))));
          }}
        >
          <label>
            {p.name} · remaining cost (€)
            <input name="remaining" type="number" min={0} required defaultValue={p.remaining} />
          </label>
          <button>Save cost estimate</button>
        </form>
      ))}
    </section>
  );
}

function ActivityPanel({ data }: { data: ReturnType<typeof filterDataset> }) {
  const exportCsv = () =>
    downloadCsv(
      'kantora-projects.csv',
      data.projects.map((p) => {
        const a = projectStats(data, p);
        return {
          project: p.name,
          verified: a.actual,
          planned: a.target,
          budget: a.budget,
          actualSpend: a.actualSpend,
          plannedSpend: a.plannedSpend,
          forecast: a.forecast,
          inspectionPassRate: a.quality,
        };
      }),
    );
  return (
    <details className="activity-panel">
      <summary>Project activity & data export</summary>
      <button className="secondary" onClick={exportCsv}>
        Export project summary CSV
      </button>
      {data.activities.slice(0, 20).map((a) => (
        <p key={a.id}>
          {a.at} · {a.message}
        </p>
      ))}
    </details>
  );
}
