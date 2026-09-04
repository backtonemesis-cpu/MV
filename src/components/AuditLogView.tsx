import React, { useState } from 'react';
import { History, Shield, Filter, Search, ArrowRight, UserCheck } from 'lucide-react';
import { AuditLogEntry } from '../types';

interface AuditLogViewProps {
  auditLogs: AuditLogEntry[];
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ auditLogs }) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [search, setSearch] = useState('');

  const filteredLogs = auditLogs.filter((log) => {
    if (filterType !== 'all' && log.entityType !== filterType) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchSummary = log.summary.toLowerCase().includes(q);
      const matchActor = log.actorEmail.toLowerCase().includes(q);
      const matchAction = log.action.toLowerCase().includes(q);
      if (!matchSummary && !matchActor && !matchAction) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold mv-text text-neutral-900">Audit Trail</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-1 bg-neutral-100 text-neutral-700 rounded-lg border mv-border border-neutral-200">
            {auditLogs.length} records
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="mv-surface bg-white p-4 rounded-2xl border mv-border border-neutral-200 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 mv-text-muted text-neutral-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border mv-border border-neutral-200 focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-1.5 text-xs rounded-xl border mv-border border-neutral-200 text-neutral-700 mv-surface bg-white"
        >
          <option value="all">All Types</option>
          <option value="transaction">Transactions</option>
          <option value="member">Members</option>
          <option value="account">Accounts</option>
          <option value="backup">Backups</option>
          <option value="system">System Events</option>
        </select>
      </div>

      {/* Audit Entries List */}
      <div className="mv-surface bg-white rounded-2xl border mv-border border-neutral-200 shadow-xs overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="py-12 text-center text-xs mv-text-muted text-neutral-400">
            No matching records.
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {filteredLogs.map((entry) => (
              <div key={entry.id} className="p-4 hover:bg-neutral-50/70 transition">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-neutral-100 text-neutral-700 border mv-border border-neutral-200">
                      {entry.entityType}
                    </span>
                    <span className="text-xs font-mono font-bold text-neutral-800">
                      {entry.action}
                    </span>
                  </div>
                  <div className="text-[11px] mv-text-muted text-neutral-400 font-mono">
                    {new Date(entry.timestamp).toLocaleString('en-GB')}
                  </div>
                </div>

                <p className="text-xs text-neutral-800 font-medium">{entry.summary}</p>

                <div className="flex items-center gap-2 mt-2 text-[11px] mv-text-muted text-neutral-500">
                  <span>By:</span>
                  <span className="font-semibold text-neutral-700">{entry.actorEmail}</span>
                  <span>•</span>
                  <span>{entry.entityId}</span>
                </div>

                {entry.details && Object.keys(entry.details).length > 0 && (
                  <div className="mt-2.5 p-2 mv-surface-muted bg-neutral-50 rounded-lg text-[10px] font-mono text-neutral-600 border border-neutral-100 overflow-x-auto">
                    {JSON.stringify(entry.details, null, 2)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
