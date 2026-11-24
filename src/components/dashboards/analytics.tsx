'use client';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ScatterChart,
  Scatter,
  ZAxis,
} from 'recharts';
import type { Dataset, Role } from '@/types/domain';
import {
  series,
  projectStats,
  progress,
  planned,
  round,
  compactMoney,
  overdue,
  insights,
  type Insight,
} from '@/lib/kpi-calculations';
import { external } from '@/lib/permissions';
import { Segmented } from '@/components/ui/segmented';
import { CountUp, Gauge, Sparkline, Stagger } from '@/components/ui/motion';

const COLORS = ['#1d3a57', '#f28c28', '#6f9fa3'];
const AXIS = { fontSize: 11, fill: '#7a8a9a' };
const MOTION = { animationDuration: 500, animationEasing: 'ease-out' as const };

type TipEntry = { dataKey?: unknown; name?: unknown; value?: unknown; color?: string };

function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: readonly TipEntry[];
  label?: unknown;
  unit: string;
}) {
  if (!active || !payload?.length) return null;
  const seen = new Set<unknown>();
  return (
    <div className="chart-tooltip">
      <b>{String(label ?? '')}</b>
      {payload
        .filter((p) => !seen.has(p.dataKey) && seen.add(p.dataKey))
        .map((p) => (
          <span key={String(p.dataKey)}>
            <i style={{ background: p.color }} />
            {String(p.name)}
            <strong>
              {String(p.value)}
              {unit}
            </strong>
          </span>
        ))}
    </div>
  );
}

function Legend({ keys }: { keys: string[] }) {
  return (
    <div className="chart-legend">
      {keys.map((k, i) => (
        <span key={k}>
          <i style={{ background: COLORS[i % 3] }} />
          {k}
        </span>
      ))}
    </div>
  );
}

export function Plot({
  title,
  rows,
  keys,
  x = 'name',
  line = false,
  unit = '',
  small = false,
}: {
  title: string;
  rows: Record<string, unknown>[];
  keys: string[];
  x?: string;
  line?: boolean;
  unit?: string;
  small?: boolean;
}) {
  const tooltip = (
    <Tooltip
      cursor={line ? { stroke: '#c5cfd8', strokeDasharray: '3 4' } : { fill: '#14283f08' }}
      content={(props) => <ChartTooltip {...(props as object)} unit={unit} />}
    />
  );
  const axes = [
    <CartesianGrid key="grid" stroke="#e6ebf0" vertical={false} />,
    <XAxis key="x" dataKey={x} tick={AXIS} axisLine={false} tickLine={false} dy={6} />,
    <YAxis key="y" unit={unit} tick={AXIS} axisLine={false} tickLine={false} width={44} />,
  ];
  const margin = { top: 8, right: 8, left: -8, bottom: 0 };
  return (
    <Stagger.Item className="chart-card">
      <div className="chart-head">
        <h2>{title}</h2>
        <Legend keys={keys} />
      </div>
      {!rows.length ? (
        <p>No records for these filters.</p>
      ) : (
        <div style={{ height: small ? 190 : 260, minWidth: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            {line ? (
              <ComposedChart data={rows} margin={margin}>
                {axes}
                {tooltip}
                {keys.map((k, i) => (
                  <Area
                    key={'area-' + k}
                    dataKey={k}
                    type="monotone"
                    stroke="none"
                    fill={COLORS[i % 3]}
                    fillOpacity={0.05}
                    tooltipType="none"
                    {...MOTION}
                  />
                ))}
                {keys.map((k, i) => (
                  <Line
                    key={k}
                    dataKey={k}
                    type="monotone"
                    stroke={COLORS[i % 3]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
                    {...MOTION}
                  />
                ))}
              </ComposedChart>
            ) : (
              <BarChart data={rows} margin={margin} barGap={4}>
                {axes}
                {tooltip}
                {keys.map((k, i) => (
                  <Bar
                    key={k}
                    dataKey={k}
                    fill={COLORS[i % 3]}
                    radius={[2, 2, 0, 0]}
                    maxBarSize={38}
                    {...MOTION}
                  />
                ))}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </Stagger.Item>
  );
}

export function Summary({ data, role, date }: { data: Dataset; role: Role; date: string }) {
  const stats = data.projects.map((p) => projectStats(data, p, date));
  const passed = stats.reduce((n, p) => n + p.passed, 0),
    total = stats.reduce((n, p) => n + p.inspected, 0),
    forecast = stats.reduce((n, p) => n + p.forecast, 0),
    budget = stats.reduce((n, p) => n + p.budget, 0);
  const done = progress(data, data.buildings, date);
  const trend = series(data, data.buildings, '2026-05', date.slice(0, 7));
  const late = stats.reduce((n, p) => n + p.late, 0);
  const rate = total ? round((100 * passed) / total) : 0;
  const plan = planned(data, data.buildings, date);
  return (
    <Stagger className="metrics">
      <Stagger.Item className="metric lead">
        <small>Verified completion</small>
        <CountUp value={done + '%'} testId="completion" />
        <Gauge value={done} plan={plan} />
        <p>
          Plan {plan}% · {data.buildings.length} authorized buildings
        </p>
      </Stagger.Item>
      <Stagger.Item className={'metric' + (late ? ' warn' : '')}>
        <small>Time / schedule</small>
        <CountUp value={late + ' late'} />
        <p>Milestones past their planned date</p>
      </Stagger.Item>
      {!external(role) && (
        <>
          <Stagger.Item className="metric">
            <small>Forecast at completion</small>
            <CountUp value={compactMoney(forecast)} />
            <p>{compactMoney(forecast - budget)} variance to original budget</p>
            <Sparkline values={trend.map((t) => t.actualSpend)} />
          </Stagger.Item>
          <Stagger.Item className={'metric' + (total && rate < 90 ? ' warn' : '')}>
            <small>Quality / inspection pass rate</small>
            <CountUp value={total ? rate + '%' : '—'} />
            <p>
              {passed} / {total} completed inspections passed
            </p>
          </Stagger.Item>
        </>
      )}
    </Stagger>
  );
}
export default function Analytics({
  data,
  role,
  date,
  from,
  tab,
  onTab,
  onDrill,
}: {
  data: Dataset;
  role: Role;
  date: string;
  from: string;
  tab: string;
  onTab: (s: string) => void;
  onDrill: (i: Insight) => void;
}) {
  const allowed = external(role)
    ? ['Progress']
    : role === 'engineer'
      ? ['Progress', 'My work']
      : ['Time', 'Cost', 'Quality', 'Workload', 'Risk'];
  const active = allowed.includes(tab) ? tab : allowed[0];
  const stats = data.projects.map((p) => projectStats(data, p, date));
  const history = series(data, data.buildings, from, date.slice(0, 7));
  const tasks = data.tasks.filter((t) => t.createdAt >= from + '-01' && t.createdAt <= date);
  const issues = data.issues.filter((i) => i.createdAt >= from + '-01' && i.createdAt <= date);
  const inspections = data.inspections.filter(
    (i) => i.createdAt >= from + '-01' && i.createdAt <= date,
  );
  const evidence = data.evidence.filter(
    (e) => e.createdAt.slice(0, 10) >= from + '-01' && e.createdAt.slice(0, 10) <= date,
  );
  const decisions = insights(data, date);
  const name = (id: string) => data.users.find((u) => u.id === id)?.name.split(' ')[0] ?? id;
  return (
    <>
      <Segmented
        tabs
        label="Analytics category"
        value={active}
        onChange={onTab}
        options={allowed}
      />
      <Stagger key={active} className="chart-grid">
        {(active === 'Time' || active === 'Progress') && (
          <>
            <Plot
              title="Planned vs verified progress"
              rows={history.map((r) => ({
                month: r.month,
                Planned: r.planned,
                Verified: r.approved,
              }))}
              keys={['Planned', 'Verified']}
              x="month"
              line
              unit="%"
            />
            {external(role) ? (
              <Plot
                title="Milestone completion"
                rows={data.milestones.map((m) => ({
                  name: m.title,
                  Verified: m.completion,
                  Planned: m.due <= date ? 100 : 0,
                }))}
                keys={['Planned', 'Verified']}
                unit="%"
              />
            ) : (
              <Plot
                title="Schedule delay by project"
                rows={stats.map((s) => ({
                  name: s.name.split(' ')[0],
                  'Days overdue': s.delayDays,
                }))}
                keys={['Days overdue']}
              />
            )}
          </>
        )}
        {active === 'Cost' && (
          <>
            <Plot
              title="Original budget vs final forecast (€M)"
              rows={stats.map((s) => ({
                name: s.name.split(' ')[0],
                Budget: round(s.budget / 1e6),
                Forecast: round(s.forecast / 1e6),
              }))}
              keys={['Budget', 'Forecast']}
            />
            <Plot
              title="Monthly spending (€M)"
              rows={history.map((r) => ({
                month: r.month,
                Planned: round(r.plannedSpend),
                Actual: round(r.actualSpend),
              }))}
              keys={['Planned', 'Actual']}
              x="month"
              line
            />
          </>
        )}
        {active === 'Quality' && (
          <>
            <Plot
              title="Unresolved defects by severity"
              rows={['low', 'medium', 'high', 'critical'].map((severity) => ({
                name: severity,
                Open: issues.filter(
                  (i) => i.severity === severity && (!i.resolvedAt || i.resolvedAt > date),
                ).length,
              }))}
              keys={['Open']}
            />
            <Plot
              title="Inspection and resolution history"
              rows={history.map((h) => ({
                month: h.month,
                Inspections: inspections.filter((i) => i.createdAt.startsWith(h.month)).length,
                Resolved: data.issues.filter(
                  (i) => i.resolvedAt?.startsWith(h.month) && i.resolvedAt <= date,
                ).length,
              }))}
              keys={['Inspections', 'Resolved']}
              x="month"
              line
            />
          </>
        )}
        {active === 'Workload' && (
          <>
            <Plot
              title="Engineer workload"
              rows={[...new Set(tasks.map((t) => t.assignee))].map((id) => ({
                name: name(id),
                Active: tasks.filter((t) => t.assignee === id && t.status !== 'validated').length,
                Validated: tasks.filter((t) => t.assignee === id && t.status === 'validated')
                  .length,
              }))}
              keys={['Active', 'Validated']}
            />
            <Plot
              title="Overdue task distribution"
              rows={data.buildings.map((b) => ({
                name: b.name,
                Overdue: tasks.filter((t) => t.buildingId === b.id && overdue(t, date)).length,
              }))}
              keys={['Overdue']}
            />
          </>
        )}
        {active === 'My work' && (
          <>
            <Plot
              title="Personal completion trend"
              rows={history.map((h) => ({
                month: h.month,
                Validated: tasks.filter((t) => t.validatedAt?.startsWith(h.month)).length,
              }))}
              keys={['Validated']}
              x="month"
              line
            />
            <Plot
              title="Evidence submission timeline"
              rows={history.map((h) => ({
                month: h.month,
                Submitted: evidence.filter((e) => e.createdAt.startsWith(h.month)).length,
                Approved: evidence.filter(
                  (e) =>
                    e.status === 'approved' && (e.reviewedAt ?? e.createdAt).startsWith(h.month),
                ).length,
              }))}
              keys={['Submitted', 'Approved']}
              x="month"
            />
          </>
        )}
        {active === 'Risk' && (
          <Stagger.Item className="chart-card wide">
            <h2>Schedule / cost risk matrix</h2>
            <p>
              Bubble size = open defects. X = schedule gap (percentage points); Y = forecast overrun
              (%).
            </p>
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart>
                  <CartesianGrid stroke="#e6ebf0" />
                  <XAxis
                    type="number"
                    dataKey="gap"
                    name="Schedule gap"
                    unit="pp"
                    tick={AXIS}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="number"
                    dataKey="overrun"
                    name="Forecast overrun"
                    unit="%"
                    tick={AXIS}
                    axisLine={false}
                    tickLine={false}
                  />
                  <ZAxis dataKey="defects" range={[80, 500]} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter
                    fill="#f28c28"
                    fillOpacity={0.75}
                    stroke="#c96d14"
                    {...MOTION}
                    data={stats.map((s) => ({
                      name: s.name,
                      gap: round(s.target - s.actual),
                      overrun: round((100 * s.variance) / s.budget),
                      defects: s.open,
                    }))}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </Stagger.Item>
        )}
      </Stagger>
      {active === 'Time' && (
        <section>
          <h2>Completion outlook</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Schedule gap</th>
                  <th>On-time milestones</th>
                  <th>Planned delivery</th>
                  <th>Scenario forecast*</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{round(s.actual - s.target)} pp</td>
                    <td>{s.onTime ?? '—'}%</td>
                    <td>{s.delivery}</td>
                    <td>
                      {new Date(Date.parse(s.delivery) + s.delayDays * 86400000)
                        .toISOString()
                        .slice(0, 10)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            *Deterministic scenario: planned delivery plus maximum open milestone delay. Not a
            predictive model.
          </p>
        </section>
      )}
      {active === 'Cost' && (
        <section>
          <h2>Cost reconciliation</h2>
          <p>
            Final forecast = recorded spend + remaining-cost estimate. Building budgets and
            remaining estimates are allocated equally for the demo.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Actual spend</th>
                  <th>Planned to date</th>
                  <th>Spend variance</th>
                  <th>Remaining</th>
                  <th>Forecast variance</th>
                  <th>Budget used</th>
                </tr>
              </thead>
              <tbody>
                {stats
                  .toSorted((a, b) => b.variance - a.variance)
                  .map((s) => (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td>{compactMoney(s.actualSpend)}</td>
                      <td>{compactMoney(s.plannedSpend)}</td>
                      <td>{compactMoney(s.spendVariance)}</td>
                      <td>{compactMoney(s.remaining)}</td>
                      <td>{compactMoney(s.variance)}</td>
                      <td>{s.usage}%</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {active === 'Quality' && (
        <section>
          <h2>Quality issues by project</h2>
          {stats.map((s) => (
            <div className="task" key={s.id}>
              <b>{s.name}</b>
              <span>
                {s.open} open · {s.critical} critical · {s.quality}% inspection pass rate
              </span>
            </div>
          ))}
        </section>
      )}
      {!external(role) && role !== 'engineer' && (
        <section>
          <h2>Decisions to make</h2>
          <p>Rule-based diagnostics from the selected records · as of {date}</p>
          <Stagger className="insights">
            {decisions.map((i) => (
              <Stagger.Item as="article" key={i.id} className="insight">
                <span className={'badge ' + i.severity}>{i.severity}</span>
                <h3>{i.title}</h3>
                <p>{i.evidence}</p>
                <button className="secondary" onClick={() => onDrill(i)}>
                  {i.action}
                </button>
              </Stagger.Item>
            ))}
            {!decisions.length && <p>No rules triggered for this selection.</p>}
          </Stagger>
        </section>
      )}
    </>
  );
}
