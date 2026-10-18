'use client';

import { KeyRound } from 'lucide-react';
import type { AdminUser, Role } from '@argus/contracts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminUsers, useAuditLog, useSetRole } from '@/lib/use-admin';
import { useSessionRole } from '@/lib/use-session-role';
import { useToast } from '@/lib/toast';
import { AuditTrail } from '../_components/audit-trail';
import { EmptyState } from '../_components/empty-state';
import { PageHeader } from '../_components/page-header';

const ROLES: Array<{ role: Role; label: string }> = [
  { role: 'admin', label: 'Admin' },
  { role: 'analyst', label: 'Analyst' },
  { role: 'viewer', label: 'Viewer' },
];

const ERRORS: Record<string, string> = {
  last_admin: 'There has to be at least one admin.',
  not_found: 'That account no longer exists.',
};

function UserRow({ user }: { user: AdminUser }) {
  const { mutate, isPending } = useSetRole();
  const { push } = useToast();

  const change = (role: Role) =>
    mutate(
      { userId: user.userId, role },
      {
        onSuccess: () => push(`${user.email} is now ${role}`),
        onError: (err) => push(ERRORS[err.message] ?? 'Role change failed', 'error'),
      },
    );

  return (
    <tr>
      <td className="px-5 py-3">
        <div className="text-[13px] text-text-primary">{user.email}</div>
        {user.name && <div className="text-[11.5px] text-text-muted">{user.name}</div>}
      </td>
      <td className="px-3 py-3 font-mono text-[11.5px] text-text-secondary">
        {user.signIn.join(' + ') || '-'}
      </td>
      <td className="px-3 py-3 font-mono text-[11.5px] text-text-muted tabular-nums">
        {user.createdAt.slice(0, 10)}
      </td>
      <td className="px-5 py-3 text-right">
        <select
          aria-label={`Role for ${user.email}`}
          value={user.role}
          disabled={isPending}
          onChange={(e) => change(e.target.value as Role)}
          className="rounded-md border border-border-subtle bg-bg-panel px-2 py-1 text-sm text-text-primary focus:border-accent/50 focus:outline-none"
        >
          {ROLES.map(({ role, label }) => (
            <option key={role} value={role}>
              {label}
            </option>
          ))}
        </select>
      </td>
    </tr>
  );
}

export function AccessView() {
  const role = useSessionRole();
  const isAdmin = role === 'admin';
  const users = useAdminUsers(isAdmin);
  const audit = useAuditLog(isAdmin);

  if (role !== null && !isAdmin) {
    return (
      <EmptyState
        icon={KeyRound}
        title="Admins only"
        body="Account roles and the audit trail are visible to admins."
      />
    );
  }

  const nameOf = (userId: string) =>
    users.data?.find((u) => u.userId === userId)?.email ?? 'a deleted account';

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader title="Access" description="Who can do what, and who did what." />

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="overflow-hidden xl:col-span-3">
          <CardHeader>
            <CardTitle>Accounts</CardTitle>
            <CardDescription>
              Admins manage roles. Analysts triage. Viewers read. Changes apply within 30 seconds.
            </CardDescription>
          </CardHeader>
          {users.isLoading || !role ? (
            <CardContent>
              <Skeleton className="h-32 w-full" />
            </CardContent>
          ) : users.isError ? (
            <CardContent className="text-sm text-severity-critical">
              Could not load accounts.
            </CardContent>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left">
                <thead>
                  <tr className="border-b border-border-subtle font-mono text-[10.5px] tracking-[0.12em] text-text-muted uppercase">
                    <th className="px-5 py-3 font-medium">Account</th>
                    <th className="px-3 py-3 font-medium">Sign-in</th>
                    <th className="px-3 py-3 font-medium">Created</th>
                    <th className="px-5 py-3 text-right font-medium">Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {users.data?.map((user) => (
                    <UserRow key={user.userId} user={user} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Audit trail</CardTitle>
            <CardDescription>Every triage and role change, newest first.</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[640px] overflow-y-auto">
            {audit.isLoading || !role ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <AuditTrail
                entries={audit.data ?? []}
                nameOf={nameOf}
                showTarget
                empty="No changes recorded yet."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
