import React from 'react';
import {
  Users,
  Shield,
  UserCheck,
  Lock,
  Clock,
  UserX,
  AlertCircle,
  Check,
  X,
  ShieldAlert,
} from 'lucide-react';
import { HouseholdMember, UserRole } from '../types';

interface MembersViewProps {
  members: HouseholdMember[];
  userRole: UserRole;
  currentUserEmail: string;
  onApproveMember: (memberId: string, role: 'editor' | 'view_only') => Promise<void>;
  onChangeRole: (memberId: string, newRole: UserRole) => Promise<void>;
  onRemoveMember: (memberId: string) => Promise<void>;
}

export const MembersView: React.FC<MembersViewProps> = ({
  members,
  userRole,
  currentUserEmail,
  onApproveMember,
  onChangeRole,
  onRemoveMember,
}) => {
  const isOwner = userRole === 'owner';

  const pendingMembers = members.filter((m) => m.role === 'pending');
  const activeMembers = members.filter((m) => m.role !== 'pending' && m.role !== 'removed');
  const removedMembers = members.filter((m) => m.role === 'removed');

  return (
    <div className="space-y-6 pb-12">
      {/* Title & Security Principles Banner */}
      <div className="bg-surface p-6 rounded-2xl border border-muted shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-main">Household Access</h1>
          </div>
          <span className="px-3 py-1 bg-surface-muted border border-muted text-muted text-xs font-semibold rounded-lg flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-muted" />
            Role: <strong className="capitalize">{userRole.replace('_', ' ')}</strong>
          </span>
        </div>
      </div>

      {/* Pending Approval Queue */}
      {pendingMembers.length > 0 && (
        <div className="bg-warning-soft border border-warning p-5 rounded-2xl shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-warning" />
            <h2 className="text-sm font-bold text-warning">
              Pending ({pendingMembers.length})
            </h2>
          </div>

          <div className="space-y-3">
            {pendingMembers.map((member) => (
              <div
                key={member.id}
                className="bg-surface p-4 rounded-xl border border-warning flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="text-xs font-bold text-main">{member.name || member.email}</div>
                  <div className="text-[11px] text-muted text-main0">{member.email}</div>
                  <div className="text-[10px] text-muted text-subtle mt-0.5">
                    Requested access: {new Date(member.joinedAt).toLocaleString('en-GB')}
                  </div>
                </div>

                {isOwner ? (
                  <div className="mv-hscroll mv-edge-safe items-center">
                    <button
                      onClick={() => onApproveMember(member.id, 'editor')}
                      className="inline-flex shrink-0 whitespace-nowrap items-center gap-1 px-3 py-1.5 bg-accent hover:bg-success-soft text-on-accent text-xs font-semibold rounded-lg transition"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Editor
                    </button>
                    <button
                      onClick={() => onApproveMember(member.id, 'view_only')}
                      className="inline-flex shrink-0 whitespace-nowrap items-center gap-1 px-3 py-1.5 bg-accent-soft hover:bg-accent-soft text-on-accent text-xs font-semibold rounded-lg transition"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      View Only
                    </button>
                    <button
                      onClick={() => onRemoveMember(member.id)}
                      className="inline-flex shrink-0 whitespace-nowrap items-center gap-1 px-3 py-1.5 bg-danger-soft text-danger hover:bg-danger-soft text-xs font-semibold rounded-lg transition"
                    >
                      <X className="w-3.5 h-3.5" />
                      Reject
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-muted text-main0 italic">
                    Owner approval required
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Members */}
      <div className="bg-surface p-5 rounded-2xl border border-muted shadow-xs">
        <h2 className="text-sm font-bold text-main mb-4">Active Household Members</h2>

        <div className="divide-y divide-muted">
          {activeMembers.map((member) => {
            const isMarius = member.email.toLowerCase() === 'backtonemesis@gmail.com';
            return (
              <div
                key={member.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-surface-muted text-muted flex items-center justify-center font-bold text-sm">
                    {member.name.substring(0, 1)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-main">{member.name}</span>
                      {isMarius && (
                        <span className="text-[10px] font-bold bg-warning-soft text-warning px-2 py-0.2 rounded-full border border-warning">
                          Owner
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted text-main0">{member.email}</div>
                  </div>
                </div>

                <div className="mv-hscroll mv-edge-safe items-center">
                  {isOwner && !isMarius ? (
                    <div className="mv-hscroll items-center">
                      <select
                        value={member.role}
                        onChange={(e) => onChangeRole(member.id, e.target.value as UserRole)}
                        className="px-2.5 py-1.5 text-xs rounded-lg border border-muted bg-surface font-medium text-muted"
                      >
                        <option value="editor">Editor</option>
                        <option value="view_only">View Only</option>
                        <option value="owner">Co-Owner</option>
                      </select>

                      <button
                        onClick={() => {
                          if (window.confirm(`Revoke access and remove ${member.name}?`)) {
                            onRemoveMember(member.id);
                          }
                        }}
                        className="p-1.5 text-muted text-subtle hover:text-danger rounded-lg hover:bg-danger-soft transition"
                        title="Remove member"
                      >
                        <UserX className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-surface-muted text-muted capitalize border border-muted">
                      {member.role.replace('_', ' ')}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Removed Members (if any) */}
      {removedMembers.length > 0 && (
        <div className="bg-surface-muted p-5 rounded-2xl border border-muted shadow-xs">
          <h3 className="text-xs font-bold text-muted mb-2">Removed</h3>
          <div className="space-y-2">
            {removedMembers.map((m) => (
              <div key={m.id} className="text-xs text-muted flex justify-between items-center bg-surface p-2.5 rounded-lg border border-muted">
                <span>{m.email}</span>
                {isOwner && (
                  <button
                    onClick={() => onChangeRole(m.id, 'editor')}
                    className="text-[11px] font-semibold text-success hover:underline"
                  >
                    Restore
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
