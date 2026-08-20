import { requirePermission, can } from '@/lib/auth';
import { backendFetch } from '@/lib/backend';
import { PageHeader } from '@/components/ui';
import { TeamManager, type TeamMemberView, type RoleOption } from './TeamManager';

export const metadata = { title: 'Team' };
export const dynamic = 'force-dynamic';

export default async function TeamPage() {
  const user = await requirePermission('team.view');
  const response = await backendFetch('/api/v1/admin/team');
  const body = await response.json().catch(() => ({})) as { members?: TeamMemberView[]; roles?: RoleOption[]; message?: string };

  // TeamManager renders the page header itself — its action opens a modal whose
  // state lives in that client component.
  return (
    <>
      {!response.ok ? (
        <>
          <PageHeader kicker="Admin" title="Team" description="Manage staff accounts and assign role-based access." />
          <div className="card text-body-sm text-danger">{body.message ?? 'The team service is unavailable. Restart the backend and refresh.'}</div>
        </>
      ) : (
        <TeamManager
          members={body.members ?? []}
          roles={body.roles ?? []}
          access={{
            invite: can(user, 'team.invite'),
            roles: can(user, 'team.roles'),
            password: can(user, 'team.password'),
            deactivate: can(user, 'team.deactivate'),
            delete: can(user, 'team.delete'),
          }}
        />
      )}
    </>
  );
}
