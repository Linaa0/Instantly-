"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { api } from "@/lib/api";
import { SkeletonCard } from "@/components/ui-badges";
import { Button, Card } from "@/components/ui-primitives";
import { formatRelativeTime, getInitials } from "@/lib/utils";
import { useToast } from "@/components/providers";

export default function TeamWorkspacePage() {
  const { notify } = useToast();
  const queryClient = useQueryClient();

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"Owner" | "Admin" | "Member">(
    "Member"
  );

  const { data: team, isLoading } = useQuery({
    queryKey: ["team"],
    queryFn: api.getTeam,
  });

  const inviteMutation = useMutation({
    mutationFn: () => api.inviteTeamMember(inviteEmail, inviteRole),
    onSuccess: (inv) => {
      setInviteEmail("");
      queryClient.invalidateQueries({ queryKey: ["team"] });
      notify("Invite sent", `${inv.email} invited as ${inv.role}.`);
    },
  });

  if (isLoading || !team) {
    return (
      <div className="space-y-6">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="space-y-12" data-testid="team-page">
      {/* Header */}
      <div className="stagger-1 pb-6 border-b border-[var(--border-subtle)]">
        <h1 className="text-3xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
          Team
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Members, shared threads and recent activity in {team.workspace_name}.
        </p>
      </div>

      {/* Invite Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (inviteEmail.trim()) inviteMutation.mutate();
        }}
        className="stagger-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
      >
        <div className="flex-1">
          <input
            type="email"
            required
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="teammate@company.com"
            data-testid="team-invite-email-input"
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
          />
        </div>
        <select
          value={inviteRole}
          onChange={(e) =>
            setInviteRole(e.target.value as "Owner" | "Admin" | "Member")
          }
          className="h-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-xs text-[var(--text-primary)]"
        >
          <option value="Member">Member</option>
          <option value="Admin">Admin</option>
          <option value="Owner">Owner</option>
        </select>
        <Button
          type="submit"
          variant="primary"
          size="md"
          loading={inviteMutation.isPending}
          data-testid="team-invite-submit-button"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Invite
        </Button>
      </form>

      {/* Members + Shared Activity */}
      <div className="stagger-3 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <Card className="lg:col-span-7 p-8 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              Members
            </h2>
            <span className="text-xs text-[var(--text-muted)] tabular-nums">
              {team.members.length}
            </span>
          </div>

          <div className="divide-y divide-[var(--border-subtle)]">
            {team.members.map((m) => (
              <div
                key={m.id}
                className="py-4 flex items-center justify-between gap-4 min-h-[56px]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)]">
                    {getInitials(m.full_name)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {m.full_name}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {m.email}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-[var(--text-muted)] tabular-nums">
                    {m.assigned_count} assigned
                  </span>
                  <span className="rounded-md bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
                    {m.role}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {team.invitations.length > 0 && (
            <div className="pt-4 border-t border-[var(--border-subtle)] space-y-3">
              <p className="text-xs font-medium text-[var(--text-muted)]">
                Pending invites
              </p>
              <div className="space-y-2">
                {team.invitations.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between rounded-lg bg-[var(--bg-elevated)] px-3.5 py-2.5 text-xs"
                  >
                    <span className="text-[var(--text-primary)]">{inv.email}</span>
                    <span className="text-[var(--text-muted)]">{inv.role}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Assignments & Notes */}
        <Card className="lg:col-span-5 p-8 space-y-6">
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              Assigned threads
            </h2>
            <div className="space-y-2.5">
              {team.recent_assignments.map((a) => (
                <div
                  key={a.id}
                  className="rounded-lg bg-[var(--bg-elevated)] p-3.5 border border-[var(--border-subtle)] text-xs"
                >
                  <p className="font-medium text-[var(--text-primary)]">
                    {a.assignee_name}
                  </p>
                  {a.note && (
                    <p className="text-[var(--text-secondary)] mt-1">{a.note}</p>
                  )}
                  <p className="text-[var(--text-muted)] mt-1 tabular-nums">
                    Assigned by {a.assigned_by_name} · {formatRelativeTime(a.created_at)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-6 border-t border-[var(--border-subtle)] space-y-3">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              Team notes
            </h2>
            <div className="space-y-2.5">
              {team.recent_comments.map((c) => (
                <div
                  key={c.id}
                  className="rounded-lg bg-[var(--bg-elevated)] p-3.5 border border-[var(--border-subtle)] text-xs"
                >
                  <p className="font-medium text-[var(--text-primary)]">
                    {c.author_name}
                  </p>
                  <p className="text-[var(--text-secondary)] mt-1">
                    {c.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Activity Log */}
      <Card className="stagger-4 p-8 space-y-4">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          Recent activity
        </h2>
        <div className="divide-y divide-[var(--border-subtle)]">
          {team.audit_log.map((ev) => (
            <div
              key={ev.id}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 text-xs"
            >
              <div className="flex items-center gap-2.5">
                <span className="font-medium text-[var(--text-primary)]">
                  {ev.actor_name}
                </span>
                <span className="text-[var(--text-secondary)]">
                  {ev.description}
                </span>
              </div>
              <span className="text-[var(--text-muted)] tabular-nums mt-1 sm:mt-0">
                {formatRelativeTime(ev.created_at)}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
