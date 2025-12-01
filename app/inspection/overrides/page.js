'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Calendar, RefreshCw, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useOverrides } from '@/hooks/useOverrides';
import SectionHeader from '@/components/common/SectionHeader';
import Card from '@/components/common/Card';
import StatusBadge from '@/components/common/StatusBadge';
import OverrideReviewModal from '@/components/inspection/OverrideReviewModal';
import { useToast } from '@/hooks/useToast';

// Mock data for fallback when API has no data
const mockOverrides = [
  {
    id: 1,
    boardId: 'EVS-23A-001293',
    defectType: 'Solder Bridge',
    location: 'R12',
    confidence: 94,
    reason: 'Acceptable solder joint (AI over-sensitive)',
    operatorNotes: 'This joint is within spec according to IPC-A-610 Class 2 standards.',
    operator: 'Operator 1',
    operatorId: 'u3',
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
    operatorNotes: 'Component is present but appears different due to alternate supplier part.',
    operator: 'Operator 2',
    operatorId: 'u3',
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
    operatorId: 'u3',
    timestamp: '2024-11-30 14:31:20',
    status: 'approved',
    reviewerNotes: 'Verified. Lighting conditions caused false detection.',
    sectionId: 'sec-mi',
    customerId: 'cust-A',
  },
];

export default function OverrideApprovalsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();

  // Use the useOverrides hook
  const {
    overrides: apiOverrides,
    loading,
    error,
    stats,
    filters,
    setFilters,
    approveOverride,
    rejectOverride,
    refreshOverrides,
  } = useOverrides();

  // Use API data if available, otherwise fall back to mock
  const [overrides, setOverrides] = useState(mockOverrides);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedOverride, setSelectedOverride] = useState(null);

  // Update local overrides when API data changes
  useEffect(() => {
    if (apiOverrides && apiOverrides.length > 0) {
      setOverrides(apiOverrides);
    } else if (!loading && apiOverrides?.length === 0) {
      // If API returns empty, use mock data for demo
      setOverrides(mockOverrides);
    }
  }, [apiOverrides, loading]);

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
        (override.boardId || '').toLowerCase().includes(query) ||
        (override.operator || override.operatorName || '').toLowerCase().includes(query)
      );
    });

  const handleStatusFilterChange = (status) => {
    setStatusFilter(status);
    // Also update API filter
    if (status === 'all') {
      setFilters({ status: null });
    } else {
      setFilters({ status });
    }
  };

  const handleReview = (override) => {
    setSelectedOverride(override);
    setReviewModalOpen(true);
  };

  const handleApprove = async (id, reviewerNotes) => {
    try {
      await approveOverride(id, user?.id, user?.name, reviewerNotes);

      // Update local state
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
    } catch (err) {
      console.error('Failed to approve:', err);
      showToast({
        title: 'Failed to approve',
        description: err.message,
        variant: 'error',
      });
    }
  };

  const handleReject = async (id, reviewerNotes) => {
    try {
      await rejectOverride(id, user?.id, user?.name, reviewerNotes);

      // Update local state
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
    } catch (err) {
      console.error('Failed to reject:', err);
      showToast({
        title: 'Failed to reject',
        description: err.message,
        variant: 'error',
      });
    }
  };

  const handleRefresh = async () => {
    await refreshOverrides();
    showToast({
      title: 'Refreshed',
      description: 'Override list updated.',
      variant: 'success',
    });
  };

  // Calculate status counts from current overrides
  const statusCounts = {
    all: overrides.length,
    pending: stats?.pending ?? overrides.filter((o) => o.status === 'pending').length,
    approved: stats?.approved ?? overrides.filter((o) => o.status === 'approved').length,
    rejected: stats?.rejected ?? overrides.filter((o) => o.status === 'rejected').length,
  };

  return (
    <div>
      <SectionHeader
        title="Override Approval Queue"
        description="Review operator-submitted false call reports before sending them to the cloud training pipeline."
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-indusia-surface rounded-lg border border-indusia-border p-4">
          <p className="text-xs text-indusia-textMuted uppercase tracking-wide mb-1">Total</p>
          <p className="text-2xl font-bold text-indusia-text">{statusCounts.all}</p>
        </div>
        <div className="bg-indusia-surface rounded-lg border border-indusia-border p-4">
          <p className="text-xs text-indusia-textMuted uppercase tracking-wide mb-1">Pending</p>
          <p className="text-2xl font-bold text-indusia-warning">{statusCounts.pending}</p>
        </div>
        <div className="bg-indusia-surface rounded-lg border border-indusia-border p-4">
          <p className="text-xs text-indusia-textMuted uppercase tracking-wide mb-1">Approved</p>
          <p className="text-2xl font-bold text-indusia-pass">{statusCounts.approved}</p>
        </div>
        <div className="bg-indusia-surface rounded-lg border border-indusia-border p-4">
          <p className="text-xs text-indusia-textMuted uppercase tracking-wide mb-1">Rejected</p>
          <p className="text-2xl font-bold text-indusia-fail">{statusCounts.rejected}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-indusia-surface rounded-lg border border-indusia-border p-6 mb-6">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            {['all', 'pending', 'approved', 'rejected'].map((status) => (
              <button
                key={status}
                onClick={() => handleStatusFilterChange(status)}
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

            <button
              onClick={handleRefresh}
              disabled={loading}
              className="px-4 py-2 bg-indusia-primary text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 mb-6">
          <p className="text-sm text-red-400">Error loading overrides: {error}</p>
        </div>
      )}

      {/* Override List */}
      <Card
        title={`${statusFilter === 'all' ? 'All' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} Overrides`}
        subtitle={`${filteredOverrides.length} ${filteredOverrides.length === 1 ? 'item' : 'items'}`}
      >
        {loading && filteredOverrides.length === 0 ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-indusia-primary mb-3" />
            <p className="text-indusia-textMuted">Loading overrides...</p>
          </div>
        ) : filteredOverrides.length === 0 ? (
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
                          {override.timestamp || override.createdAt}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div>
                        <p className="text-sm text-indusia-text">
                          {override.defectType}
                        </p>
                        <p className="text-xs text-indusia-textMuted mt-1">
                          {override.location} - {override.confidence}%
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
                        {override.operator || override.operatorName}
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
