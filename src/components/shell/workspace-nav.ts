import {
  Box,
  Building2,
  Camera,
  ChartNoAxesCombined,
  ClipboardCheck,
  GalleryHorizontalEnd,
  History,
  ListChecks,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@/types/domain';
import { canReview, external } from '@/lib/permissions';

export type View =
  | 'Overview'
  | 'Analytics'
  | 'Timeline'
  | 'Capture'
  | 'Tasks'
  | 'Planning'
  | 'Updates'
  | 'Published updates'
  | 'Quality'
  | 'Model';

/** One icon per view, so an icon always means the same thing whatever the role. */
export const VIEW_ICONS: Record<View, LucideIcon> = {
  Overview: Building2,
  Analytics: ChartNoAxesCombined,
  Timeline: History,
  Capture: Camera,
  Tasks: ListChecks,
  Planning: ClipboardCheck,
  Updates: GalleryHorizontalEnd,
  'Published updates': GalleryHorizontalEnd,
  Quality: ShieldCheck,
  Model: Box,
};

export function navFor(role: Role): View[] {
  if (external(role)) return ['Overview', 'Timeline', 'Published updates', 'Model'];
  if (role === 'engineer') return ['Overview', 'Capture', 'Tasks', 'Updates', 'Quality'];
  if (role === 'director') return ['Overview', 'Analytics', 'Planning', 'Quality', 'Model'];
  if (canReview(role)) return ['Overview', 'Planning', 'Updates', 'Quality', 'Model'];
  return ['Overview', 'Tasks', 'Model'];
}

/** Views that show the dashboard (summary cards + analytics) and the history date filters. */
export const DASHBOARD_VIEWS: View[] = ['Overview', 'Analytics', 'Timeline'];

export const ROLE_TITLES: Record<Role, string> = {
  engineer: 'Your site. Your next move.',
  manager: 'Keep every team moving.',
  director: 'See the whole picture.',
  customer: 'Your home. Taking shape.',
  investor: 'A considered perspective.',
  admin: 'A connected workspace.',
  partner: 'Your work. Clearly defined.',
  property: 'Better places to be.',
};
