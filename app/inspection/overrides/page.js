'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Calendar } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import SectionHeader from '@/components/common/SectionHeader';
import Card from '@/components/common/Card';
import StatusBadge from '@/components/common/StatusBadge';
import OverrideReviewModal from '@/components/inspection/OverrideReviewModal';
import { useToast } from '@/hooks/useToast';

export default function OverrideApprovalsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [overrides, setOverrides] = useState([
    {
      id: 1,
      boardId: 'EVS-23A-001293',
      defectType: 'Solder Bridge',
      location: 'R12',
      confidence: 94,
      reason: 'Acceptable solder joint (AI over-sensitive)',
      operatorNotes: 'This joint is within spec according to IPC-A-610 Class 2 standards. The bridge detected by AI is actually acceptable fillet wetting.',
      operator: 'Operator 1',
      timestamp: '2024-11-30 14:26:12',
      status: 'pending',
      reviewerNotes: '',
      sectionId: 'sec-smt',
      customerId: 'cust-A',
    },
    {
      id: 2,
      boardId: 'EVS-23A-001294',
      defectType: 'Missing Component',
      location: 'C45',
      confidence: 92,
      reason: 'Component variation (within tolerance)',
      operatorNotes: 'Component is present but appears different due to alternate supplier part. Verified against BOM.',
      operator: 'Operator 2',
      timestamp: '2024-11-30 14:28:45',
      status: 'pending',
      reviewerNotes: '',
      sectionId: 'sec-testing',
      customerId: 'cust-B',
    },
    {
      id: 3,
      boardId: 'EVS-23A-001295',
      defectType: 'Insufficient Solder',
      location: 'U7',
      confidence: 89,
      reason: 'Lighting artifact (reflection/shadow)',
      operatorNotes: '',
      operator: 'Operator 1',
      timestamp: '2024-11-30 14:31:20',
      status: 'approved',
      reviewerNotes: 'Verified. Lighting conditions caused false detection.',
      sectionId: 'sec-mi',
      customerId: 'cust-A',
    },
    {
      id: 4,
      boardId: 'EVS-23A-001296',
      defectType: 'Component Misalignment',
      location: 'IC3',
      confidence: 87,
      reason: 'Label alignment within spec',
      operatorNotes: 'Component alignment is within tolerance per assembly drawing.',
      operator: 'Operator 3',
      timestamp: '2024-11-30 14:35:18',
      status: 'rejected',
      reviewerNotes: 'Alignment appears out of spec. Rejecting override.',
      sectionId: 'sec-fatp',
      customerId: 'cust-B',
    },
    {
      id: 5,
      boardId: 'EVS-23A-001297',
      defectType: 'Solder Bridge',
      location: 'R24',
      confidence: 91,
      reason: 'Acceptable solder joint (AI over-sensitive)',
      operatorNotes: '',
      operator: 'Operator 1',
      timestamp: '2024-11-30 14:38:52',
      status: 'pending',
      reviewerNotes: '',
      sectionId: 'sec-smt',
      customerId: 'cust-A',
    },
  ]);

  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedOverride, setSelectedOverride] = useState(null);

  if (!user || !['manager', 'superadmin'].includes(user.role)) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="bg-indusia-surface rounded-xl shadow-xl border border-indusia-border p-8 max-w-md text-center">
          <h2 className="text-xl font-bold text-indusia-text mb-3">
            Access Denied
          </h2>
          <p className="text-sm text-indusia-textMuted mb-6">
            You do not have permission to access the Override Approval Queue.
          </p>
          <button
            onClick={() => router.back()}
            className="px-6 py-3 bg-indusia-primary text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const allowedSectionIds = user?.sections || [];

  const filteredOverrides = overrides
    .filter((override) => {
      if (user.role === 'manager') {
        return allowedSectionIds.includes(override.sectionId);
      }
      return true;
    })
    .filter((override) => {
      if (statusFilter === 'all') return true;
      return override.status === statusFilter;
    })
    .filter((override) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        override.boardId.toLowerCase().includes(query) ||
        override.operator.toLowerCase().includes(query)
      );
    });

  const handleReview = (override) => {
    setSelectedOverride(override);
    setReviewModalOpen(true);
  };

  const handleApprove = (id, reviewerNotes) => {
    setOverrides((prev) =>
      prev.map((o) =>
        o.id === id
          ? { ...o, status: 'approved', reviewerNotes }
          : o
      )
    );

    showToast({
      title: 'Override approved',
      description: 'Added to cloud sync queue.',
      variant: 'success',
    });

    setReviewModalOpen(false);
    setSelectedOverride(null);
  };

  const handleReject = (id, reviewerNotes) => {
    setOverrides((prev) =>
      prev.map((o) =>
        o.id === id
          ? { ...o, status: 'rejected', reviewerNotes }
          : o
      )
    );

    showToast({
      title: 'Override rejected',
      variant: 'error',
    });

    setReviewModalOpen(false);
    setSelectedOverride(null);
  };

  const statusCounts = {
    all: overrides.length,
    pending: overrides.filter((o) => o.status === 'pending').length,
    approved: overrides.filter((o) => o.status === 'approved').length,
    rejected: overrides.filter((o) => o.status === 'rejected').length,
  };

  return (
    <div>
      <SectionHeader
        title="Override Approval Queue"
        description="Review operator-submitted false call reports before sending them to the cloud training pipeline."
      />

      <div className="bg-indusia-surface rounded-lg border border-indusia-border p-6 mb-6">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            {['all', 'pending', 'approved', 'rejected'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`
                  px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize
                  ${
                    statusFilter === status
                      ? 'bg-indusia-primary text-white'
                      : 'bg-indusia-bg text-indusia-textMuted hover:text-indusia-text hover:bg-indusia-surfaceMuted'
                  }
                `}
              >
                {status} ({statusCounts[status]})
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indusia-textMuted" />
              <input
                type="text"
                placeholder="Search Board ID / Operator"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-sm text-indusia-text placeholder-indusia-textMuted focus:outline-none focus:ring-2 focus:ring-indusia-primary focus:border-transparent w-64"
              />
            </div>

            <button className="px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-sm text-indusia-textMuted hover:text-indusia-text transition-colors flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Date Range
            </button>
          </div>
        </div>
      </div>

      <Card
        title={`${statusFilter === 'all' ? 'All' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} Overrides`}
        subtitle={`${filteredOverrides.length} ${filteredOverrides.length === 1 ? 'item' : 'items'}`}
      >
        {filteredOverrides.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-indusia-textMuted">No overrides found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-indusia-border">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase tracking-wide">
                    Board
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase tracking-wide">
                    Defect
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase tracking-wide">
                    Reason
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase tracking-wide">
                    Operator
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase tracking-wide">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredOverrides.map((override) => (
                  <tr
                    key={override.id}
                    className="border-b border-indusia-border hover:bg-indusia-surfaceMuted transition-colors"
                  >
                    <td className="px-4 py-4">
                      <div>
                        <p className="text-sm font-semibold text-indusia-text">
                          {override.boardId}
                        </p>
                        <p className="text-xs text-indusia-textMuted mt-1">
                          {override.timestamp}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div>
                        <p className="text-sm text-indusia-text">
                          {override.defectType}
                        </p>
                        <p className="text-xs text-indusia-textMuted mt-1">
                          {override.location} • {override.confidence}%
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm text-indusia-text max-w-xs truncate">
                        {override.reason}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm text-indusia-text">
                        {override.operator}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge
                        status={override.status}
                        label={override.status.toUpperCase()}
                      />
                    </td>
                    <td className="px-4 py-4">
                      {override.status === 'pending' ? (
                        <button
                          onClick={() => handleReview(override)}
                          className="px-4 py-2 bg-indusia-primary text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
                        >
                          Review
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReview(override)}
                          className="px-4 py-2 bg-indusia-surfaceMuted text-indusia-text text-sm font-medium rounded-lg hover:bg-indusia-border transition-colors"
                        >
                          View
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <OverrideReviewModal
        isOpen={reviewModalOpen}
        onClose={() => {
          setReviewModalOpen(false);
          setSelectedOverride(null);
        }}
        onApprove={handleApprove}
        onReject={handleReject}
        override={selectedOverride}
      />
    </div>
  );
}
