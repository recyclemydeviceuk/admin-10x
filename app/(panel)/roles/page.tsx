import { requirePermission, can } from '@/lib/auth';
import { backendFetch } from '@/lib/backend';
import { PageHeader } from '@/components/ui';
import { RolesManager, type RoleView } from './RolesManager';

export const metadata = { title: 'Roles & Access' };
export const dynamic = 'force-dynamic';

export default async function RolesPage() {
  const user = await requirePermission('roles.view');
  const response = await backendFetch('/api/v1/admin/roles');
  const body = await response.json().catch(() => ({})) as { roles?: RoleView[]; message?: string };
  // RolesManager renders the page header itself — its action opens a modal
  // whose state lives in that client component.
  return (
    <>
      {!response.ok ? (
        <>
          <PageHeader kicker="Admin" title="Roles & Access" description="Control exactly what each team role can view and change." />
          <div className="card text-body-sm text-danger">{body.message ?? 'The roles service is unavailable. Restart the backend and refresh.'}</div>
        </>
      ) : (
        <RolesManager roles={body.roles ?? []} access={{ create: can(user, 'roles.create'), edit: can(user, 'roles.edit'), delete: can(user, 'roles.delete') }} />
      )}
    </>
  );
}
