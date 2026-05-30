import Card from '@/components/common/Card';
import StatusBadge from '@/components/common/StatusBadge';
import { FileText, Inbox } from 'lucide-react';

export default function SyncQueueTable({ items }) {
  const getStatusBadge = (status) => {
    switch (status) {
      case 'ready':
        return <StatusBadge status="warning" label="Ready" />;
      case 'in-progress':
        return <StatusBadge status="warning" label="In Progress" />;
      case 'synced':
        return <StatusBadge status="pass" label="Synced" />;
      case 'error':
        return <StatusBadge status="fail" label="Error" />;
      default:
        return <StatusBadge status="warning" label={status} />;
    }
  };

  if (items.length === 0) {
    return (
      <Card title="Sync Queue" subtitle="Records queued for upload">
        <div className="py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-indusia-surfaceMuted flex items-center justify-center mx-auto mb-4">
            <Inbox className="w-8 h-8 text-indusia-textMuted" />
          </div>
          <h4 className="text-lg font-semibold text-indusia-text mb-2">No records ready to sync</h4>
          <p className="text-sm text-indusia-textMuted max-w-md mx-auto">
            Approved overrides will appear here after manager approval.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card title="Sync Queue" subtitle={`${items.length} records queued for upload`}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-indusia-border">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">
                Customer
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">
                Section
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">
                Board
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">
                Type
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">
                Records
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className="border-b border-indusia-border hover:bg-indusia-surfaceMuted transition-colors"
              >
                <td className="px-4 py-3 text-sm text-indusia-text">{item.customerName}</td>
                <td className="px-4 py-3 text-sm text-indusia-textMuted">{item.sectionName}</td>
                <td className="px-4 py-3 text-sm text-indusia-text font-mono">{item.boardId}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indusia-textMuted" />
                    <span className="text-sm text-indusia-text">{item.type}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-indusia-textMuted">{item.defectsCount}</td>
                <td className="px-4 py-3">{getStatusBadge(item.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
