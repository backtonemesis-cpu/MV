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
      <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-neutral-900">Household Access</h1>
          </div>
          <span className="px-3 py-1 bg-neutral-100 border border-neutral-200 text-neutral-700 text-xs font-semibold rounded-lg flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-neutral-600" />
            Role: <strong className="capitalize">{userRole.replace('_', ' ')}</strong>
          </span>
        </div>
      </div>

      {/* Pending Approval Queue */}
      {pendingMembers.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-200 p-5 rounded-2xl shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-amber-700" />
            <h2 className="text-sm font-bold text-amber-900">
              Pending ({pendingMembers.length})
            </h2>
          </div>

          <div className="space-y-3">
            {pendingMembers.map((member) => (
              <div
                key={member.id}
                className="bg-white p-4 rounded-xl border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="text-xs font-bold text-neutral-900">{member.name || member.email}</div>
                  <div className="text-[11px] text-neutral-500">{member.email}</div>
                  <div className="text-[10px] text-neutral-400 mt-0.5">
                    Requested access: {new Date(member.joinedAt).toLocaleString('en-GB')}
                  </div>
                </div>

                {isOwner ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onApproveMember(member.id, 'editor')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg transition"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Editor
                    </button>
                    <button
                      onClick={() => onApproveMember(member.id, 'view_only')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      View Only
                    </button>
                    <button
                      onClick={() => onRemoveMember(member.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold rounded-lg transition"
                    >
                      <X className="w-3.5 h-3.5" />
                      Reject
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-neutral-500 italic">
                    Owner approval required
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Members */}
      <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs">
        <h2 className="text-sm font-bold text-neutral-900 mb-4">Active Household Members</h2>

        <div className="divide-y divide-neutral-100">
          {activeMembers.map((member) => {
            const isMarius = member.email.toLowerCase() === 'backtonemesis@gmail.com';
            return (
              <div
                key={member.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-700 flex items-center justify-center font-bold text-sm">
                    {member.name.substring(0, 1)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-neutral-900">{member.name}</span>
                      {isMarius && (
                        <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.2 rounded-full border border-amber-300">
                          Owner
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-neutral-500">{member.email}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {isOwner && !isMarius ? (
                    <div className="flex items-center gap-2">
                      <select
                        value={member.role}
                        onChange={(e) => onChangeRole(member.id, e.target.value as UserRole)}
                        className="px-2.5 py-1.5 text-xs rounded-lg border border-neutral-300 bg-white font-medium text-neutral-700"
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
                        className="p-1.5 text-neutral-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                        title="Remove member"
                      >
                        <UserX className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-700 capitalize border border-neutral-200">
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
        <div className="bg-neutral-50 p-5 rounded-2xl border border-neutral-200 shadow-xs">
          <h3 className="text-xs font-bold text-neutral-700 mb-2">Removed</h3>
          <div className="space-y-2">
            {removedMembers.map((m) => (
              <div key={m.id} className="text-xs text-neutral-600 flex justify-between items-center bg-white p-2.5 rounded-lg border border-neutral-200">
                <span>{m.email}</span>
                {isOwner && (
                  <button
                    onClick={() => onChangeRole(m.id, 'editor')}
                    className="text-[11px] font-semibold text-emerald-700 hover:underline"
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
