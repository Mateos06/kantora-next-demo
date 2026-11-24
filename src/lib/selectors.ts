import type { Dataset, Evidence } from '@/types/domain';
import { SNAPSHOT } from '@/data/projects';
import { overdue } from './kpi-calculations';

/** Shared record queries, so views read the same thing the same way. */
export const openTasks = (data: Dataset) => data.tasks.filter((t) => t.status !== 'validated');
export const overdueTasks = (data: Dataset) => data.tasks.filter((t) => overdue(t));
export const dueToday = (data: Dataset) =>
  data.tasks.filter((t) => t.due === SNAPSHOT && t.status !== 'validated');
export const unresolvedIssues = (data: Dataset) =>
  data.issues.filter((i) => i.status !== 'resolved');
export const pendingEvidenceBy = (data: Dataset, engineerId: string) =>
  data.evidence.filter((e) => e.status === 'pending' && e.engineerId === engineerId);

const approvedOn = (e: Evidence) => (e.reviewedAt ?? e.createdAt).slice(0, 10);

/** Approved evidence for one building, as known on `date`. */
export const approvedEvidence = (data: Dataset, buildingId: string, date: string) =>
  data.evidence.filter(
    (e) => e.buildingId === buildingId && e.status === 'approved' && approvedOn(e) <= date,
  );

export const latestPublicSummary = (data: Dataset) =>
  data.evidence
    .filter((e) => e.status === 'approved')
    .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.publicSummary;
