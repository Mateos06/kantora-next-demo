import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Platform from '@/components/platform';
import { roles, type Role } from '@/data/projects';

const WORKSPACES = [...roles, 'projects'];

export function generateStaticParams() {
  return WORKSPACES.map((workspace) => ({ workspace }));
}

async function Workspace({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;
  if (!WORKSPACES.includes(workspace)) notFound();
  return <Platform initialRole={workspace === 'projects' ? 'manager' : (workspace as Role)} />;
}

// The URL segment is read inside Suspense so the shell can stream instantly.
export default function Page({ params }: { params: Promise<{ workspace: string }> }) {
  return (
    <Suspense fallback={<main className="boot" />}>
      <Workspace params={params} />
    </Suspense>
  );
}
