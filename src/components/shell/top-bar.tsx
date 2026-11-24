'use client';
import type { ReactNode } from 'react';
import { Bell, Presentation } from 'lucide-react';
import { roles } from '@/data/projects';
import type { Activity, Role } from '@/types/domain';
import { download } from '@/lib/export';
import { LEGACY_KEY } from '@/store/demo-store';

export function TopBar({
  crumb,
  role,
  identity,
  activities,
  unread,
  legacy,
  onMarkRead,
  onRole,
  onShowcase,
  onReset,
}: {
  crumb: string;
  role: Role;
  /** Picker for which person of this role is presenting. */
  identity?: ReactNode;
  activities: Activity[];
  unread: number;
  legacy: boolean;
  onMarkRead: () => void;
  onRole: (role: Role) => void;
  onShowcase: () => void;
  onReset: () => void;
}) {
  return (
    <header className="top-bar">
      <span className="breadcrumb">Workspace / {crumb}</span>
      <div className="header-actions">
        <details className="notification-panel">
          <summary aria-label="Notifications">
            <Bell size={17} />
            {unread > 0 && <span className="count">{unread}</span>}
          </summary>
          <div className="dropdown">
            <h3>Notifications</h3>
            <button className="secondary" onClick={onMarkRead}>
              Mark all read
            </button>
            {activities.slice(0, 15).map((a) => (
              <p key={a.id}>
                {a.message}
                <br />
                <small>{a.at.slice(0, 16)}</small>
              </p>
            ))}
            {!activities.length && <p>No activity in your assigned buildings.</p>}
          </div>
        </details>
        <label className="role-picker">
          Demo role
          <select aria-label="Role" value={role} onChange={(e) => onRole(e.target.value as Role)}>
            {roles.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        {identity}
        <details className="presenter-panel">
          <summary aria-label="Presentation controls">
            <Presentation size={18} />
          </summary>
          <div className="dropdown">
            <h3>Live presentation</h3>
            <ol className="steps">
              <li>Engineer → Capture → submit.</li>
              <li>Manager → Updates → approve and publish.</li>
              <li>Director → select Lakeview → see revised Time indicators.</li>
              <li>Customer → model and photo timeline.</li>
            </ol>
            <button onClick={onShowcase}>Open showcase workflow</button>
            <button className="secondary" onClick={onReset}>
              Load initial scenario
            </button>
            {legacy && (
              <button
                className="secondary"
                onClick={() =>
                  download(
                    'kantora-previous-demo.json',
                    new Blob([localStorage.getItem(LEGACY_KEY) ?? '{}'], {
                      type: 'application/json',
                    }),
                  )
                }
              >
                Export archived previous demo
              </button>
            )}
            <p className="fine-print">
              Presenter role switching is frontend access simulation, not production security.
            </p>
          </div>
        </details>
      </div>
    </header>
  );
}
