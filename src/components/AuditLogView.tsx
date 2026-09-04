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
          <h1 className="text-xl font-bold text-main">Audit Trail</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-1 bg-surface-muted text-muted rounded-lg border border-muted">
            {auditLogs.length} records
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface p-4 rounded-2xl border border-muted shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-muted text-subtle absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-muted focus:ring-2 focus:ring-accent"
          />
        </div>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-1.5 text-xs rounded-xl border border-muted text-muted bg-surface"
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
      <div className="bg-surface rounded-2xl border border-muted shadow-xs overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted text-subtle">
            No matching records.
          </div>
        ) : (
          <div className="divide-y divide-muted">
            {filteredLogs.map((entry) => (
              <div key={entry.id} className="p-4 hover:bg-surface-muted transition">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-surface-muted text-muted border border-muted">
                      {entry.entityType}
                    </span>
                    <span className="text-xs font-mono font-bold text-main">
                      {entry.action}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted text-subtle font-mono">
                    {new Date(entry.timestamp).toLocaleString('en-GB')}
                  </div>
                </div>

                <p className="text-xs text-main font-medium">{entry.summary}</p>

                <div className="flex items-center gap-2 mt-2 text-[11px] text-muted text-main0">
                  <span>By:</span>
                  <span className="font-semibold text-muted">{entry.actorEmail}</span>
                  <span>•</span>
                  <span>{entry.entityId}</span>
                </div>

                {entry.details && Object.keys(entry.details).length > 0 && (
                  <div className="mt-2.5 p-2 bg-surface-muted rounded-lg text-[10px] font-mono text-muted border border-muted overflow-x-auto">
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
