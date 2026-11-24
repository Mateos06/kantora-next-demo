'use client';
import { motion } from 'motion/react';
import { Building2 } from 'lucide-react';
import type { Role } from '@/types/domain';
import { VIEW_ICONS, type View } from './workspace-nav';

export function Sidebar({
  role,
  nav,
  active,
  counts = {},
  userName,
  scope,
  onNavigate,
}: {
  role: Role;
  nav: View[];
  active: View;
  /** Open items per view, shown as a count beside the label. */
  counts?: Partial<Record<View, number>>;
  userName?: string;
  /** The project or portfolio currently in view. */
  scope?: { title: string; detail: string; progress: number; render?: string };
  onNavigate: (view: View) => void;
}) {
  const initials = (userName ?? '')
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('');
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">
          <Building2 size={16} />
        </span>
        <div>
          KANTORA<small>Construction, clearly.</small>
        </div>
      </div>
      {scope && (
        <div className="sidebar-scope">
          {scope.render && (
            <span className="scope-thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={scope.render} alt="" />
            </span>
          )}
          <div>
            {scope.title}
            <small>{scope.detail}</small>
          </div>
          <b>{scope.progress}%</b>
        </div>
      )}
      <p className="eyebrow">{role} workspace</p>
      <nav>
        {nav.map((view) => {
          const Icon = VIEW_ICONS[view];
          const selected = active === view;
          return (
            <button
              key={view}
              className={selected ? 'active' : ''}
              aria-current={selected ? 'page' : undefined}
              onClick={() => onNavigate(view)}
            >
              {selected && (
                <motion.span
                  layoutId="nav-pill"
                  className="nav-pill"
                  transition={{ type: 'spring', stiffness: 600, damping: 45 }}
                />
              )}
              <Icon size={17} />
              <span>{view}</span>
              {!!counts[view] && (
                <b className="nav-count" aria-hidden title={counts[view] + ' open'}>
                  {counts[view]}
                </b>
              )}
            </button>
          );
        })}
      </nav>
      <div className="sidebar-bottom">
        <p className="snapshot">
          <span className="status-dot" /> Synthetic portfolio · 30 Oct 2026
        </p>
        {userName && (
          <div className="sidebar-user">
            <span className="avatar">{initials}</span>
            <div>
              {userName}
              <small>{role}</small>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
