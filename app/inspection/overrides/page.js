'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Calendar, RefreshCw, Loader2, AlertCircle, Inbox, ChevronLeft, ChevronRight, CheckCircle, XCircle } from 'lucide-react';
import PageLoading from '@/components/common/PageLoading';
import { useAuth } from '@/context/AuthContext';
import { useOverrides } from '@/hooks/useOverrides';
import { useI18nContext } from '@/context/I18nContext';
import SectionHeader from '@/components/common/SectionHeader';
import Card from '@/components/common/Card';
import StatusBadge from '@/components/common/StatusBadge';
import OverrideReviewModal from '@/components/inspection/OverrideReviewModal';
import { useToast } from '@/hooks/useToast';

const PAGE_SIZE = 10;

export default function OverrideApprovalsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, hasMenuAccess } = useAuth();
  const { showToast } = useToast();
  const { t } = useI18nContext();

  const {
    overrides,
    loading,
    error,
    stats,
    filters,
    setFilters,
    approveOverride,
    rejectOverride,
    reviewOverride,
    refreshOverrides,
    isStale,
    lastUpdated,
  } = useOverrides();

  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedOverride, setSelectedOverride] = useState(null);
  const [loadingReview, setLoadingReview] = useState(false);

  // Handle ?review=overrideId query param from notification
  useEffect(() => {
    const reviewId = searchParams.get('review');
    if (reviewId && overrides.length > 0 && !loadingReview) {
      // Find override in loaded data first
      const found = overrides.find(o => o.id === reviewId);
      if (found) {
        setSelectedOverride(found);
        setReviewModalOpen(true);
        // Clear query param
        router.replace('/inspection/overrides', { scroll: false });
      } else if (!loading) {
        // If not found in current data, fetch it
        setLoadingReview(true);
        import('@/lib/utils/authFetch').then(({ authFetch }) => {
          authFetch(`/api/overrides/${reviewId}`)
            .then(res => res.json())
            .then(json => {
              if (json.success && json.data) {
                setSelectedOverride(json.data);
                setReviewModalOpen(true);
              }
              router.replace('/inspection/overrides', { scroll: false });
            })
            .catch(err => {
              console.error('Failed to fetch override for review:', err);
              router.replace('/inspection/overrides', { scroll: false });
            })
            .finally(() => setLoadingReview(false));
        });
      }
    }
  }, [searchParams, overrides, loading, loadingReview, router]);

  // Check access
  if (!user || !hasMenuAccess('menu_overrides')) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="bg-indusia-surface rounded-xl shadow-xl border border-indusia-border p-8 max-w-md text-center">
          <h2 className="text-xl font-bold text-indusia-text mb-3">
            {t('status.error')}
          </h2>
          <p className="text-sm text-indusia-textMuted mb-6">
            {t('states.noResults')}
          </p>
          <button
            onClick={() => router.back()}
            className="px-6 py-3 bg-indusia-primary text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            {t('buttons.cancel')}
          </button>
        </div>
      </div>
    );
  }

  // Filter overrides (client-side status + search only)
  // Section-based access control is already enforced server-side via getSectionFilter()
  // in the API route, so we don't duplicate that filtering here.
  const filteredOverrides = useMemo(() => {
    return overrides
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
  }, [overrides, statusFilter, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredOverrides.length / PAGE_SIZE);
  const paginatedOverrides = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredOverrides.slice(start, start + PAGE_SIZE);
  }, [filteredOverrides, currentPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchQuery]);

  const handleStatusFilterChange = (status) => {
    setStatusFilter(status);
    setCurrentPage(1);
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
      showToast({
        title: t('manager.approved'),
        description: t('sync.syncComplete'),
        variant: 'success',
      });
      setReviewModalOpen(false);
      setSelectedOverride(null);
    } catch (err) {
      console.error('Failed to approve:', err);
      showToast({
        title: t('status.failed'),
        description: err.message,
        variant: 'error',
      });
    }
  };

  const handleReject = async (id, reviewerNotes) => {
    try {
      await rejectOverride(id, user?.id, user?.name, reviewerNotes);
      showToast({
        title: t('manager.rejected'),
        variant: 'error',
      });
      setReviewModalOpen(false);
      setSelectedOverride(null);
    } catch (err) {
      console.error('Failed to reject:', err);
      showToast({
        title: t('status.failed'),
        description: err.message,
        variant: 'error',
      });
    }
  };

  const handleReviewFrames = async (id, objectDecisions, reviewerNotes) => {
    try {
      await reviewOverride(id, user?.id, user?.name, objectDecisions, reviewerNotes);
      showToast({
        title: 'Review Submitted',
        description: `${Object.values(objectDecisions).filter(d => d === 'approved').length} approved, ${Object.values(objectDecisions).filter(d => d === 'rejected').length} rejected`,
        variant: 'success',
      });
      setReviewModalOpen(false);
      setSelectedOverride(null);
    } catch (err) {
      console.error('Failed to review:', err);
      showToast({
        title: t('status.failed'),
        description: err.message,
        variant: 'error',
      });
    }
  };

  const handleRefresh = async () => {
    await refreshOverrides();
    showToast({
      title: t('buttons.refresh'),
      description: t('sync.syncComplete'),
      variant: 'success',
    });
  };

  // Status counts
  const statusCounts = {
    all: overrides.length,
    pending: stats?.pending ?? overrides.filter((o) => o.status === 'pending').length,
    approved: stats?.approved ?? overrides.filter((o) => o.status === 'approved').length,
    rejected: stats?.rejected ?? overrides.filter((o) => o.status === 'rejected').length,
    reviewed: stats?.reviewed ?? overrides.filter((o) => o.status === 'reviewed').length,
    appealed: stats?.appealed ?? overrides.filter((o) => o.status === 'appealed').length,
  };

  const statusLabels = {
    all: t('notifications.all'),
    pending: t('manager.pending'),
    approved: t('manager.approved'),
    rejected: t('manager.rejected'),
    reviewed: 'Reviewed',
    appealed: 'Appealed',
  };

  return (
    <div>
      <SectionHeader
        title={t('manager.overrideQueue')}
        description={t('manager.pendingReview')}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-6 gap-4 mb-6">
        <div className="bg-indusia-surface rounded-lg border border-indusia-border p-4">
          <p className="text-xs text-indusia-textMuted uppercase tracking-wide mb-1">{t('common.total')}</p>
          <p className="text-2xl font-bold text-indusia-text">{statusCounts.all}</p>
        </div>
        <div className="bg-indusia-surface rounded-lg border border-indusia-border p-4">
          <p className="text-xs text-indusia-textMuted uppercase tracking-wide mb-1">{t('manager.pending')}</p>
          <p className="text-2xl font-bold text-indusia-warning">{statusCounts.pending}</p>
        </div>
        <div className="bg-indusia-surface rounded-lg border border-indusia-border p-4">
          <p className="text-xs text-indusia-textMuted uppercase tracking-wide mb-1">Reviewed</p>
          <p className="text-2xl font-bold text-phosphor-cyan">{statusCounts.reviewed}</p>
        </div>
        <div className="bg-indusia-surface rounded-lg border border-indusia-border p-4">
          <p className="text-xs text-indusia-textMuted uppercase tracking-wide mb-1">Appealed</p>
          <p className="text-2xl font-bold text-yellow-400">{statusCounts.appealed}</p>
        </div>
        <div className="bg-indusia-surface rounded-lg border border-indusia-border p-4">
          <p className="text-xs text-indusia-textMuted uppercase tracking-wide mb-1">{t('manager.approved')}</p>
          <p className="text-2xl font-bold text-indusia-pass">{statusCounts.approved}</p>
        </div>
        <div className="bg-indusia-surface rounded-lg border border-indusia-border p-4">
          <p className="text-xs text-indusia-textMuted uppercase tracking-wide mb-1">{t('manager.rejected')}</p>
          <p className="text-2xl font-bold text-indusia-fail">{statusCounts.rejected}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-indusia-surface rounded-lg border border-indusia-border p-6 mb-6">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            {['all', 'pending', 'reviewed', 'appealed', 'approved', 'rejected'].map((status) => (
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
                {statusLabels[status]} ({statusCounts[status]})
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indusia-textMuted" />
              <input
                type="text"
                placeholder={t('buttons.search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-sm text-indusia-text placeholder-indusia-textMuted focus:outline-none focus:ring-2 focus:ring-indusia-primary focus:border-transparent w-64"
              />
            </div>

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
              {t('buttons.refresh')}
            </button>
            
            {/* Last updated indicator */}
            {lastUpdated && (
              <div className="text-xs text-indusia-textMuted flex items-center gap-1">
                {isStale && (
                  <span className="text-indusia-warning">●</span>
                )}
                <span>
                  Updated: {lastUpdated.toLocaleTimeString()}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 mb-6 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <p className="text-sm text-red-400">{t('status.error')}: {error}</p>
          <button
            onClick={handleRefresh}
            className="ml-auto text-sm text-red-400 hover:text-red-300 underline"
          >
            {t('buttons.retry')}
          </button>
        </div>
      )}

      {/* Override List */}
      <Card
        title={`${statusLabels[statusFilter]} Overrides`}
        subtitle={`${filteredOverrides.length} ${filteredOverrides.length === 1 ? 'item' : 'items'}`}
      >
        {loading && filteredOverrides.length === 0 ? (
          <PageLoading message={t('states.loadingDefault')} compact />
        ) : filteredOverrides.length === 0 ? (
          <div className="text-center py-12">
            <Inbox className="w-12 h-12 text-indusia-textMuted mx-auto mb-3" />
            <p className="text-indusia-textMuted font-medium">{t('states.noOverrides')}</p>
            <p className="text-sm text-indusia-textMuted mt-1">
              {t('states.checkBackLater')}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-indusia-border">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase tracking-wide">
                      {t('hmi.board')}
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase tracking-wide">
                      {t('hmi.defectType')}
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase tracking-wide">
                      {t('hmi.reason')}
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase tracking-wide">
                      Operator
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase tracking-wide">
                      Status
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase tracking-wide">
                      {t('common.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOverrides.map((override) => (
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
                        <p className="text-sm text-indusia-text">
                          {override.defectType || 'FALSE_POSITIVE'}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <div className="max-w-xs">
                          <p className="text-sm text-indusia-text">
                            {override.reason}
                          </p>
                          {override.reason === 'OTHER' && override.operatorNotes && (
                            <p className="text-xs text-indusia-textMuted mt-1 italic truncate" title={override.operatorNotes}>
                              &quot;{override.operatorNotes}&quot;
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm text-indusia-text">
                          {override.operator || override.operatorName}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        {override.status === 'reviewed' && (override.frameDecisions || override.objectDecisions) ? (
                          <FrameStatusSummary frameDecisions={override.frameDecisions || override.objectDecisions} />
                        ) : (
                          <StatusBadge
                            status={override.status}
                            label={statusLabels[override.status] || override.status.toUpperCase()}
                          />
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {override.status === 'pending' ? (
                          <button
                            onClick={() => handleReview(override)}
                            className="px-4 py-2 bg-indusia-primary text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
                          >
                            {t('manager.reviewOverride')}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReview(override)}
                            className="px-4 py-2 bg-indusia-surfaceMuted text-indusia-text text-sm font-medium rounded-lg hover:bg-indusia-border transition-colors"
                          >
                            {t('buttons.view')}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-4 border-t border-indusia-border">
                <p className="text-sm text-indusia-textMuted">
                  {t('common.showing')} {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, filteredOverrides.length)} {t('common.of')} {filteredOverrides.length}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 bg-indusia-bg rounded text-sm text-indusia-text disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indusia-border transition-colors flex items-center gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-indusia-text px-2">
                    {t('common.page')} {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 bg-indusia-bg rounded text-sm text-indusia-text disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indusia-border transition-colors flex items-center gap-1"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
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
        onReview={handleReviewFrames}
        override={selectedOverride}
      />
    </div>
  );
}

function FrameStatusSummary({ frameDecisions }) {
  const decisions = typeof frameDecisions === 'string' ? JSON.parse(frameDecisions) : frameDecisions;
  const values = Object.values(decisions || {});
  const approved = values.filter(d => d === 'approved').length;
  const rejected = values.filter(d => d === 'rejected').length;

  return (
    <div className="flex items-center gap-2">
      {approved > 0 && (
        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-phosphor-green/15 text-phosphor-green text-xs font-mono">
          <CheckCircle className="w-3 h-3" />
          {approved}
        </span>
      )}
      {rejected > 0 && (
        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-phosphor-red/15 text-phosphor-red text-xs font-mono">
          <XCircle className="w-3 h-3" />
          {rejected}
        </span>
      )}
    </div>
  );
}
