'use client';

import { useState, useTransition } from 'react';
import { Modal } from '@/components/Modal';
import { Avatar, DateCell, EmptyState, PageHeader, Pill, Table, td } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/Confirm';
import { addTeamMember, deleteTeamMember, resetTeamPassword, toggleTeamMember, updateTeamMember } from '@/lib/actions/team';

export type RoleOption = { id: string; name: string };
export type TeamMemberView = {
  id: string;
  name: string;
  email: string;
  roleId: string;
  roleName: string;
  active: boolean;
  protected: boolean;
  createdAt: string | null;
  lastLoginAt: string | null;
};

/** Row action — icon with a tooltip, matching every other list page. */
function RowAction({
  label,
  icon,
  tone = 'default',
  onClick,
}: {
  label: string;
  icon: string;
  tone?: 'default' | 'danger';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded-md text-fg-subtle transition-colors ${
        tone === 'danger'
          ? 'hover:bg-danger/10 hover:text-danger'
          : 'hover:bg-accent-soft hover:text-accent-pressed'
      }`}
    >
      <Icon name={icon} className="h-3.5 w-3.5" />
    </button>
  );
}

export function TeamManager({ members, roles, access }: {
  members: TeamMemberView[];
  roles: RoleOption[];
  access: { invite: boolean; roles: boolean; password: boolean; deactivate: boolean; delete: boolean };
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMemberView | null>(null);
  const [pending, start] = useTransition();
  const { toast } = useToast();
  const { confirm } = useConfirm();

  const submit = (formData: FormData) => start(async () => {
    const out = editing ? await updateTeamMember(editing.id, formData) : await addTeamMember(formData);
    toast(withTempPassword(out));
    if (out.ok) { setOpen(false); setEditing(null); }
  });

  // Only present when the invite email could not be sent — shown once so the
  // account isn't stranded without a way in.
  function withTempPassword<T extends { message?: string; tempPassword?: string }>(out: T): T {
    if (out.tempPassword) return { ...out, message: `${out.message} ${out.tempPassword}` };
    return out;
  }

  const active = members.filter((member) => member.active).length;

  return (
    <div className="space-y-4">
      <PageHeader
        kicker="Admin"
        title="Team"
        description="Manage staff accounts and assign role-based access."
        actions={
          <>
            <span className="hidden items-center gap-1.5 rounded-full bg-paper-100 px-3 py-1.5 text-caption font-medium text-fg-muted sm:inline-flex">
              <Icon name="users" className="h-3.5 w-3.5" />
              {active} active of {members.length}
            </span>
            {access.invite ? (
              <button type="button" className="btn-accent" onClick={() => { setEditing(null); setOpen(true); }}>
                <Icon name="plus" className="h-4 w-4" />
                Add team member
              </button>
            ) : null}
          </>
        }
      />

      {members.length === 0 ? (
        <EmptyState
          title="No team members yet"
          hint="Add an account and assign it a role — everyone signs in with their own credentials."
        />
      ) : (
        <Table head={['Member', 'Role', 'Status', 'Added', 'Last sign-in', <span key="a" className="block text-right">Actions</span>]}>
          {members.map((member, index) => (
            <tr key={member.id} className="transition-colors hover:bg-accent-soft/40">
              <td className={td}>
                <div className="flex items-center gap-2.5">
                  <Avatar name={member.name} seed={index} />
                  <span className="min-w-0 leading-tight">
                    <span className="block truncate font-semibold">{member.name}</span>
                    <span className="block truncate text-[11px] text-fg-subtle">{member.email}</span>
                  </span>
                </div>
              </td>
              <td className={td}>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-paper-100 px-2.5 py-1 text-[11.5px] font-medium text-fg-muted">
                  <Icon name="shield" className="h-3 w-3" />
                  {member.roleName}
                </span>
              </td>
              <td className={td}>
                <Pill tone={member.active ? 'accent' : 'neutral'}>{member.active ? 'Active' : 'Inactive'}</Pill>
              </td>
              <td className={td}><DateCell iso={member.createdAt} /></td>
              <td className={td}>
                {member.lastLoginAt ? <DateCell iso={member.lastLoginAt} /> : <span className="text-fg-subtle">Never</span>}
              </td>
              <td className={td}>
                {member.protected ? (
                  // The .env owner can't be edited from here by design — say so
                  // rather than showing buttons that would always fail.
                  <div className="flex justify-end">
                    <span
                      title="This account is defined in the backend environment file"
                      className="inline-flex items-center gap-1.5 rounded-full bg-paper-100 px-2.5 py-1 text-[11px] font-medium text-fg-subtle"
                    >
                      <Icon name="lock" className="h-3 w-3" />
                      Environment owner
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-end gap-0.5">
                    {access.roles ? (
                      <RowAction label="Edit member" icon="settings" onClick={() => { setEditing(member); setOpen(true); }} />
                    ) : null}
                    {access.password ? (
                      <RowAction label="Email a new temporary password" icon="key" onClick={async () => {
                        if (await confirm({ title: 'Reset password?', message: `${member.name} gets a new temporary password by email and signs in with that.`, confirmLabel: 'Reset & email' })) {
                          start(async () => toast(withTempPassword(await resetTeamPassword(member.id))));
                        }
                      }} />
                    ) : null}
                    {access.deactivate ? (
                      <RowAction
                        label={member.active ? 'Deactivate' : 'Reactivate'}
                        icon={member.active ? 'lock' : 'check'}
                        onClick={() => start(async () => toast(await toggleTeamMember(member.id)))}
                      />
                    ) : null}
                    {access.delete ? (
                      <RowAction label="Delete member" icon="trash" tone="danger" onClick={async () => {
                        if (await confirm({ title: 'Delete team member?', message: `${member.name} will immediately lose access.`, confirmLabel: 'Delete' })) {
                          start(async () => toast(await deleteTeamMember(member.id)));
                        }
                      }} />
                    ) : null}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Modal open={open} onClose={() => { setOpen(false); setEditing(null); }} title={editing ? 'Edit team member' : 'Add team member'}>
        <form action={submit} className="space-y-4">
          <div>
            <label className="field-label" htmlFor="member-name">Name</label>
            <input id="member-name" name="name" className="field-input" minLength={2} defaultValue={editing?.name ?? ''} required />
          </div>
          <div>
            <label className="field-label" htmlFor="member-email">Email</label>
            <input id="member-email" name="email" type="email" className="field-input" defaultValue={editing?.email ?? ''} required />
          </div>
          <div>
            <label className="field-label" htmlFor="member-role">Role</label>
            <select id="member-role" name="roleId" className="field-input" defaultValue={editing?.roleId ?? roles[0]?.id} required>
              {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
            </select>
            <p className="mt-1.5 text-caption text-fg-subtle">The role decides every screen and action this person can reach.</p>
          </div>
          {!editing ? (
            <p className="rounded-lg bg-paper-100 px-3.5 py-2.5 text-caption text-fg-muted">
              They get an email with a temporary password and can change it after signing in. Super Admin is not on the list — it exists only in the server's environment file.
            </p>
          ) : null}
          <button className="btn-accent w-full" disabled={pending}>
            {pending ? 'Saving…' : editing ? 'Save changes' : 'Add member'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
