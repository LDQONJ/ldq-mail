'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Ticket,
  Plus,
  RefreshCw,
  Copy,
  Check,
  Ban,
  Trash2,
  Users,
  Clock,
  ExternalLink,
  X,
  Info,
} from 'lucide-react';
import type { InviteCode } from '@/lib/admin/invite-manager';
import { apiFetch, withBasePath } from '@/lib/browser-navigation';

export function InvitesTab() {
  const [invites, setInvites] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  
  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [logsModalInvite, setLogsModalInvite] = useState<InviteCode | null>(null);

  // Form states
  const [formCode, setFormCode] = useState('');
  const [formMaxUses, setFormMaxUses] = useState(1);
  const [formExpiresDays, setFormExpiresDays] = useState<number | ''>(30);
  const [formNote, setFormNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInvites = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/admin/invites');
      if (res.ok) {
        const data = await res.json();
        setInvites(data.invites || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvites();
  }, [fetchInvites]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await apiFetch('/api/admin/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: formCode ? formCode.trim() : undefined,
          maxUses: Number(formMaxUses),
          expiresDays: formExpiresDays === '' ? null : Number(formExpiresDays),
          note: formNote.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create invite code');
      }

      setCreateModalOpen(false);
      setFormCode('');
      setFormNote('');
      setFormMaxUses(1);
      setFormExpiresDays(30);
      fetchInvites();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Creation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this invite code? User registration with this code will be blocked.')) return;
    try {
      const res = await apiFetch(`/api/admin/invites?id=${encodeURIComponent(id)}&action=revoke`, {
        method: 'DELETE',
      });
      if (res.ok) fetchInvites();
    } catch {
      // ignore
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this invite code record?')) return;
    try {
      const res = await apiFetch(`/api/admin/invites?id=${encodeURIComponent(id)}&action=delete`, {
        method: 'DELETE',
      });
      if (res.ok) fetchInvites();
    } catch {
      // ignore
    }
  };

  const copyToClipboard = (text: string, code: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const getRegisterLink = (code: string) => {
    if (typeof window === 'undefined') return `/register?code=${code}`;
    return `${window.location.origin}${withBasePath(`/register?code=${encodeURIComponent(code)}`)}`;
  };

  // Stats calculation
  const totalInvites = invites.length;
  const activeInvites = invites.filter(
    (i) =>
      !i.isRevoked &&
      (i.maxUses === 0 || i.usedCount < i.maxUses) &&
      (!i.expiresAt || new Date(i.expiresAt) > new Date())
  ).length;
  const totalUsed = invites.reduce((acc, curr) => acc + curr.usedCount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Ticket className="w-6 h-6 text-primary" />
            Registration Invite Codes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generate and manage invite codes required for new user account registration.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchInvites}
            className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-background text-sm text-foreground hover:bg-accent transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Generate Invite Code
          </button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-sm font-medium">
            <span>Total Codes</span>
            <Ticket className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-foreground mt-2">{totalInvites}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-sm font-medium">
            <span>Active Codes</span>
            <Clock className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">{activeInvites}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-sm font-medium">
            <span>Registered Users</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-foreground mt-2">{totalUsed}</div>
        </div>
      </div>

      {/* Table */}
      <div className="border border-border rounded-xl bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-muted-foreground">
                <th className="text-start px-4 py-3 font-medium">Invite Code</th>
                <th className="text-start px-4 py-3 font-medium">Status</th>
                <th className="text-start px-4 py-3 font-medium">Usage</th>
                <th className="text-start px-4 py-3 font-medium">Expiration</th>
                <th className="text-start px-4 py-3 font-medium">Note</th>
                <th className="text-start px-4 py-3 font-medium">Created</th>
                <th className="text-end px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && invites.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    Loading invite codes...
                  </td>
                </tr>
              ) : invites.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    No invite codes generated yet. Click &quot;Generate Invite Code&quot; to create one.
                  </td>
                </tr>
              ) : (
                invites.map((inv) => {
                  const isExpired = inv.expiresAt && new Date(inv.expiresAt) < new Date();
                  const isDepleted = inv.maxUses > 0 && inv.usedCount >= inv.maxUses;
                  const isActive = !inv.isRevoked && !isExpired && !isDepleted;

                  return (
                    <tr key={inv.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-mono font-semibold text-foreground">
                        <div className="flex items-center gap-2">
                          <span>{inv.code}</span>
                          <button
                            onClick={() => copyToClipboard(inv.code, inv.code)}
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="Copy Code"
                          >
                            {copiedCode === inv.code ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {inv.isRevoked ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-destructive/10 text-destructive">
                            Revoked
                          </span>
                        ) : isExpired ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400">
                            Expired
                          </span>
                        ) : isDepleted ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
                            Used Up
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-medium">
                        {inv.usedCount} / {inv.maxUses === 0 ? '∞' : inv.maxUses}
                        {inv.usedBy.length > 0 && (
                          <button
                            onClick={() => setLogsModalInvite(inv)}
                            className="ml-2 text-xs text-primary hover:underline inline-flex items-center gap-1"
                          >
                            Logs ({inv.usedBy.length})
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {inv.expiresAt
                          ? new Date(inv.expiresAt).toLocaleDateString()
                          : 'Never'}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">
                        {inv.note || '-'}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(inv.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-end">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => copyToClipboard(getRegisterLink(inv.code), `link_${inv.code}`)}
                            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="Copy Direct Registration Link"
                          >
                            {copiedCode === `link_${inv.code}` ? (
                              <Check className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <ExternalLink className="w-4 h-4" />
                            )}
                          </button>
                          {isActive && (
                            <button
                              onClick={() => handleRevoke(inv.id)}
                              className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                              title="Revoke Invite Code"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(inv.id)}
                            className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            title="Delete Record"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Generate Invite Code Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Ticket className="w-5 h-5 text-primary" />
                Generate Invite Code
              </h2>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="rounded-md p-1 hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Custom Code (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. INV-VIP-2026 (Leave empty to auto-generate)"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Max Uses
                </label>
                <select
                  value={formMaxUses}
                  onChange={(e) => setFormMaxUses(Number(e.target.value))}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value={1}>1 time (Single-use)</option>
                  <option value={5}>5 times</option>
                  <option value={10}>10 times</option>
                  <option value={0}>Unlimited (0)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Expiration
                </label>
                <select
                  value={formExpiresDays}
                  onChange={(e) => setFormExpiresDays(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value={7}>7 days</option>
                  <option value={30}>30 days</option>
                  <option value={90}>90 days</option>
                  <option value="">Never expire</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Note / Remark
                </label>
                <input
                  type="text"
                  placeholder="e.g. Created for Team Member A"
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="h-9 px-4 rounded-md border border-input bg-background text-sm font-medium text-foreground hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                >
                  {submitting ? 'Generating...' : 'Generate Code'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Usage Logs Modal */}
      {logsModalInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Usage Logs
                </h2>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  Code: {logsModalInvite.code}
                </p>
              </div>
              <button
                onClick={() => setLogsModalInvite(null)}
                className="rounded-md p-1 hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto border border-border rounded-lg divide-y divide-border">
              {logsModalInvite.usedBy.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No registrations with this code yet.
                </div>
              ) : (
                logsModalInvite.usedBy.map((log, index) => (
                  <div key={index} className="p-3 text-xs space-y-1">
                    <div className="flex justify-between font-medium text-foreground">
                      <span>{log.email}</span>
                      <span className="text-muted-foreground font-normal">
                        {new Date(log.usedAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-muted-foreground font-mono text-[11px]">
                      IP: {log.ip}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setLogsModalInvite(null)}
                className="h-9 px-4 rounded-md border border-input bg-background text-sm font-medium text-foreground hover:bg-accent"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
