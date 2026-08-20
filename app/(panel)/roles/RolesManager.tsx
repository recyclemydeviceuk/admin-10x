'use client';

import { useMemo, useState, useTransition } from 'react';
import { Modal } from '@/components/Modal';
import { EmptyState, PageHeader, Pill } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/Confirm';
import { PERMISSION_GROUPS } from '@/lib/permissions';
import { createRole, deleteRole, updateRole } from '@/lib/actions/roles';

export type RoleView = {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  system: boolean;
  memberCount: number;
};

const TOTAL_PERMISSIONS = PERMISSION_GROUPS.reduce((sum, group) => sum + group.permissions.length, 0);

/**
 * How much of each module a role can reach.
 *
 * A count alone ("54 permissions granted") says nothing about WHAT the role
 * touches. A strip per module answers the question actually being asked —
 * can these people refund an order, or only look at one?
 */
function coverage(role: RoleView) {
  const all = role.permissions.includes('*');
  return PERMISSION_GROUPS.map((group) => {
    const granted = all
      ? group.permissions.length
      : group.permissions.filter((permission) => role.permissions.includes(permission.id)).length;
    return { key: group.key, name: group.name, granted, total: group.permissions.length };
  });
}

export function RolesManager({ roles, access }: {
  roles: RoleView[];
  access: { create: boolean; edit: boolean; delete: boolean };
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RoleView | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const { toast } = useToast();
  const { confirm } = useConfirm();

  const begin = (role?: RoleView) => {
    setEditing(role ?? null);
    setSelected(role?.permissions.includes('*') ? ['*'] : role?.permissions ?? []);
    setOpen(true);
  };

  const isFullAccess = selected.includes('*');
  const selectedCount = isFullAccess ? TOTAL_PERMISSIONS : selected.length;

  // Every box ticked = a second Super Admin, which custom roles must never be.
  // The server refuses it too; catching it here explains the rule before the
  // save bounces. Editing the built-in Super Admin itself stays allowed —
  // it IS the full-access role (and the server keeps it read-only anyway).
  const everythingTicked = !isFullAccess && selectedCount === TOTAL_PERMISSIONS;

  const toggleGroup = (groupKey: string, on: boolean) => {
    const group = PERMISSION_GROUPS.find((entry) => entry.key === groupKey);
    if (!group) return;
    const ids = group.permissions.map((permission) => permission.id);
    setSelected((current) =>
      on ? [...new Set([...current, ...ids])] : current.filter((id) => !ids.includes(id)),
    );
  };

  return (
    <div className="space-y-4">
      <PageHeader
        kicker="Admin"
        title="Roles & Access"
        description="Control exactly what each team role can view and change."
        actions={
          <>
            <span className="hidden items-center gap-1.5 rounded-full bg-paper-100 px-3 py-1.5 text-caption font-medium text-fg-muted sm:inline-flex">
              <Icon name="shield" className="h-3.5 w-3.5" />
              {roles.length} role{roles.length === 1 ? '' : 's'}
            </span>
            {access.create ? (
              <button type="button" className="btn-accent" onClick={() => begin()}>
                <Icon name="plus" className="h-4 w-4" />
                Create role
              </button>
            ) : null}
          </>
        }
      />

      {roles.length === 0 ? (
        <EmptyState title="No roles yet" hint="Create a role to decide what a group of people can reach." />
      ) : (
        <div className="grid items-stretch gap-4 lg:grid-cols-2">
          {roles.map((role) => {
            const full = role.permissions.includes('*');
            const modules = coverage(role);
            const reach = modules.filter((module) => module.granted > 0).length;

            return (
              <div key={role.id} className="card flex h-full flex-col">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-title">{role.name}</h2>
                      {role.system ? <Pill>System</Pill> : null}
                      {full ? <Pill tone="accent">Full access</Pill> : null}
                    </div>
                    <p className="mt-1 text-body-sm text-fg-muted">{role.description || 'Custom access role'}</p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-paper-100 px-2.5 py-1 text-caption font-medium text-fg-muted">
                    <Icon name="users" className="h-3 w-3" />
                    {role.memberCount}
                  </span>
                </div>

                {/* Coverage — one bar per module, so the shape of the role reads
                    at a glance instead of as a number. */}
                <div className="mt-5">
                  <div className="mb-2 flex items-baseline justify-between">
                    <p className="text-caption font-medium text-fg-muted">Access</p>
                    <p className="text-caption text-fg-subtle">
                      {full
                        ? 'Every permission'
                        : `${role.permissions.length} of ${TOTAL_PERMISSIONS} · ${reach} module${reach === 1 ? '' : 's'}`}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {modules.map((module) => {
                      const ratio = module.total === 0 ? 0 : module.granted / module.total;
                      return (
                        <span
                          key={module.key}
                          title={`${module.name} — ${module.granted} of ${module.total}`}
                          className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper-200"
                        >
                          <span
                            className={`block h-full rounded-full ${ratio === 1 ? 'bg-accent-pressed' : 'bg-accent'}`}
                            style={{ width: `${Math.round(ratio * 100)}%` }}
                          />
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-auto flex gap-2 pt-5">
                  {access.edit && role.id !== 'super-admin' ? (
                    <button type="button" className="btn-outline" onClick={() => begin(role)}>
                      <Icon name="settings" className="h-4 w-4" />
                      Edit permissions
                    </button>
                  ) : (
                    <p className="text-caption text-fg-subtle">
                      {role.id === 'super-admin'
                        ? 'Built in — always has every permission.'
                        : 'Your role can view this but not change it.'}
                    </p>
                  )}
                  {access.delete && !role.system ? (
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={async () => {
                        if (await confirm({ title: 'Delete role?', message: 'The role must have no assigned members.', confirmLabel: 'Delete' })) {
                          start(async () => toast(await deleteRole(role.id)));
                        }
                      }}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? `Edit ${editing.name}` : 'Create role'} wide>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const input = {
              name: String(form.get('name') ?? ''),
              description: String(form.get('description') ?? ''),
              permissions: selected,
            };
            start(async () => {
              const out = editing ? await updateRole(editing.id, input) : await createRole(input);
              toast(out);
              if (out.ok) setOpen(false);
            });
          }}
          className="space-y-5"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="role-name">Role name</label>
              <input id="role-name" name="name" className="field-input" defaultValue={editing?.name ?? ''} minLength={2} required />
            </div>
            <div>
              <label className="field-label" htmlFor="role-description">Description</label>
              <input id="role-description" name="description" className="field-input" defaultValue={editing?.description ?? ''} placeholder="What this role is for" />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-paper-200 bg-paper-50 px-4 py-3">
            <p className="text-body-sm font-medium">
              {selectedCount} of {TOTAL_PERMISSIONS} permissions
              {isFullAccess ? <span className="ml-2 text-caption text-fg-subtle">Full access — every box is implied</span> : null}
            </p>
            <div className="flex gap-2">
              <button type="button" className="btn-outline" onClick={() => setSelected([])} disabled={selectedCount === 0}>
                Clear all
              </button>
              <button
                type="button"
                className="btn-outline"
                onClick={() => setSelected(PERMISSION_GROUPS.flatMap((group) => group.permissions.map((permission) => permission.id)))}
              >
                Select all
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {PERMISSION_GROUPS.map((group) => {
              const ids = group.permissions.map((permission) => permission.id);
              const granted = isFullAccess ? ids.length : ids.filter((id) => selected.includes(id)).length;
              const allOn = granted === ids.length;

              return (
                <fieldset key={group.key} className="rounded-xl border border-paper-200">
                  <div className="flex items-center justify-between gap-3 border-b border-paper-200 bg-paper-50 px-4 py-2.5">
                    <legend className="contents">
                      <span className="text-body-sm font-semibold">{group.name}</span>
                    </legend>
                    <div className="flex items-center gap-3">
                      <span className="text-caption text-fg-subtle">{granted}/{ids.length}</span>
                      <button
                        type="button"
                        className="text-caption font-medium text-accent-pressed hover:underline disabled:text-fg-subtle disabled:no-underline"
                        disabled={isFullAccess}
                        onClick={() => toggleGroup(group.key, !allOn)}
                      >
                        {allOn ? 'Clear' : 'Select all'}
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-2.5 p-4 sm:grid-cols-2">
                    {group.permissions.map((permission) => (
                      <label key={permission.id} className="flex items-start gap-2.5 text-body-sm">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 shrink-0 accent-accent-pressed"
                          checked={isFullAccess || selected.includes(permission.id)}
                          disabled={isFullAccess}
                          onChange={(event) =>
                            setSelected((current) =>
                              event.target.checked
                                ? [...current, permission.id]
                                : current.filter((id) => id !== permission.id),
                            )
                          }
                        />
                        <span>
                          {permission.label}
                          {permission.hint ? <span className="block text-caption text-fg-subtle">{permission.hint}</span> : null}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              );
            })}
          </div>

          {everythingTicked ? (
            <p role="alert" className="rounded-xl border border-danger/40 bg-danger/[0.06] px-4 py-3 text-body-sm text-danger">
              This role would hold every permission — that makes it a second Super Admin, and the
              system won’t allow it. Assign the built-in Super Admin role instead, or leave at
              least one permission off.
            </p>
          ) : null}

          <button className="btn-accent w-full" disabled={pending || selectedCount === 0 || everythingTicked}>
            {pending ? 'Saving…' : 'Save role'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
