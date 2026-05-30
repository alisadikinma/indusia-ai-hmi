'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ZoomIn, ZoomOut, AlertCircle, Info } from 'lucide-react';
import Card from '@/components/common/Card';
import SectionHeader from '@/components/common/SectionHeader';
import StatusBadge from '@/components/common/StatusBadge';
import StatsGrid from '@/components/common/StatsGrid';
import FalseCallOverrideModal from '@/components/inspection/FalseCallOverrideModal';
import { useInspectionKeyboardShortcuts } from '@/hooks/useInspectionKeyboardShortcuts';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/context/AuthContext';
import { customers, sections, lines, boards } from '@/data/masterData';

export default function InspectionResultDetail({ params }) {
  const router = useRouter();
  const { showToast } = useToast();
  const { user, updateSelections, hasMenuAccess } = useAuth();
  const boardId = params.id || user?.selectedBoardId || 'current';
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });

  if (!user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="bg-indusia-surface rounded-xl shadow-xl border border-indusia-border p-8 max-w-md text-center">
          <h2 className="text-xl font-bold text-indusia-text mb-3">Not Logged In</h2>
          <p className="text-sm text-indusia-textMuted mb-6">Please login to access inspection results.</p>
          <button onClick={() => router.push('/login')} className="px-6 py-3 bg-indusia-primary text-white rounded-lg font-medium hover:opacity-90 transition-opacity">
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // Check access via database permissions
  if (!hasMenuAccess('menu_inspection')) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="bg-indusia-surface rounded-xl shadow-xl border border-indusia-border p-8 max-w-md text-center">
          <h2 className="text-xl font-bold text-indusia-text mb-3">Access Denied</h2>
          <p className="text-sm text-indusia-textMuted mb-6">You do not have permission to view inspection results.</p>
          <button onClick={() => router.back()} className="px-6 py-3 bg-indusia-primary text-white rounded-lg font-medium hover:opacity-90 transition-opacity">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const customer = useMemo(() => {
    if (!user?.selectedCustomerId) return null;
    return customers.find((c) => c.id === user.selectedCustomerId);
  }, [user?.selectedCustomerId]);

  const section = useMemo(() => {
    if (!user?.selectedSectionId) return null;
    return sections.find((s) => s.id === user.selectedSectionId);
  }, [user?.selectedSectionId]);

  const line = useMemo(() => {
    if (!user?.selectedLineId) return null;
    return lines.find((l) => l.id === user.selectedLineId);
  }, [user?.selectedLineId]);

  const currentBoard = useMemo(() => {
    if (!user?.selectedBoardId) return null;
    return boards.find((b) => b.id === user.selectedBoardId);
  }, [user?.selectedBoardId]);

  const availableBoards = useMemo(() => {
    if (!user?.selectedCustomerId) return [];
    return boards.filter((b) => b.customerId === user.selectedCustomerId);
  }, [user?.selectedCustomerId]);

  const handleBoardChange = (newBoardId) => {
    updateSelections({ selectedBoardId: newBoardId });
  };

  const [defects, setDefects] = useState([
    {
      id: 1,
      type: 'Solder Bridge',
      location: 'R12',
      confidence: 94,
      status: 'NG',
      x: 120,
      y: 450,
    },
    {
      id: 2,
      type: 'Missing Component',
      location: 'C45',
      confidence: 92,
      status: 'NG',
      x: 340,
      y: 280,
    },
    {
      id: 3,
      type: 'Insufficient Solder',
      location: 'U7',
      confidence: 89,
      status: 'NG',
      x: 580,
      y: 190,
    },
    {
      id: 4,
      type: 'Component Misalignment',
      location: 'IC3',
      confidence: 87,
      status: 'NG',
      x: 220,
      y: 350,
    },
  ]);

  const [selectedDefectIndex, setSelectedDefectIndex] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDefect, setModalDefect] = useState(null);
  const [zoom, setZoom] = useState(1);

  const openModal = (defect) => {
    setModalDefect(defect);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalDefect(null);
  };

  const confirmOverride = (overrideData) => {
    setDefects((prev) =>
      prev.map((d) =>
        d.id === overrideData.defectId
          ? { ...d, status: 'WAITING_MANAGER' }
          : d
      )
    );

    showToast({
      title: 'Override Submitted',
      description: 'Waiting for leader/manager approval.',
      variant: 'success',
    });

    closeModal();

    if (selectedDefectIndex < defects.length - 1) {
      setSelectedDefectIndex(selectedDefectIndex + 1);
    }
  };

  useInspectionKeyboardShortcuts({
    selectedDefectIndex,
    setSelectedDefectIndex,
    defects,
    modalOpen,
    openModal,
    closeModal,
    confirmOverride,
  });

  const selectedDefect = defects[selectedDefectIndex];
  const boardStatus = defects.some((d) => d.status === 'NG') ? 'fail' : 'pass';
  const overridesPending = defects.filter((d) => d.status === 'WAITING_MANAGER').length;

  const activityLog = [
    { time: '14:26:12', message: 'Operator submitted override for defect R12' },
    { time: '14:25:47', message: 'AI detected 4 defects' },
    { time: '14:25:12', message: 'Board scanned' },
  ];

  const dummyStats = [
    { label: 'Board ID', value: boardId.toUpperCase(), hint: 'Current inspection' },
    { label: 'Defects Found', value: defects.length.toString(), hint: 'Total detections' },
    { label: 'Overrides Pending', value: overridesPending.toString(), hint: 'Awaiting approval' },
    { label: 'Confidence Avg', value: '91%', hint: 'AI model score' },
  ];

  return (
    <div>
      <SectionHeader
        title="Inspection Result Detail"
        description="Review AI detections, override false calls, and manage board status"
      />

      <div className="bg-indusia-surface rounded-lg border border-indusia-border p-6 mb-6">
        <h3 className="text-sm font-semibold text-indusia-text mb-4 uppercase tracking-wide">
          Current Context
        </h3>
        <div className="grid grid-cols-5 gap-6">
          <div>
            <label className="text-xs font-semibold text-indusia-textMuted uppercase tracking-wide block mb-2">
              Section
            </label>
            <p className="text-sm font-medium text-indusia-text">
              {section?.name || 'Not set'}
            </p>
          </div>
          <div>
            <label className="text-xs font-semibold text-indusia-textMuted uppercase tracking-wide block mb-2">
              Customer
            </label>
            <p className="text-sm font-medium text-indusia-text">
              {customer?.name || 'Not set'}
            </p>
          </div>
          <div>
            <label className="text-xs font-semibold text-indusia-textMuted uppercase tracking-wide block mb-2">
              Production Line
            </label>
            <p className="text-sm font-medium text-indusia-text">
              {line?.name || 'Not set'}
            </p>
          </div>
          <div className="col-span-2">
            <label className="text-xs font-semibold text-indusia-textMuted uppercase tracking-wide block mb-2">
              Board
            </label>
            <select
              value={user?.selectedBoardId || ''}
              onChange={(e) => handleBoardChange(e.target.value)}
              className="w-full px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-sm text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary focus:border-transparent"
            >
              <option value="">Select board...</option>
              {availableBoards.map((board) => (
                <option key={board.id} value={board.id}>
                  {board.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {!user?.selectedBoardId ? (
        <div className="bg-indusia-surfaceMuted rounded-lg border border-indusia-border p-8 text-center">
          <Info className="w-12 h-12 text-indusia-primary mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-indusia-text mb-2">
            Please select a board to begin inspection
          </h3>
          <p className="text-sm text-indusia-textMuted">
            Choose a board from the dropdown above to view inspection results
          </p>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <StatsGrid items={dummyStats} />
          </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-4">
          <Card
            title="Detected Defects"
            subtitle={`${boardId.toUpperCase()} • ${timestamp}`}
          >
            <div className="space-y-2 max-h-[600px] overflow-y-auto scrollbar-thin pr-2">
              {defects.map((defect, index) => (
                <div
                  key={defect.id}
                  onClick={() => setSelectedDefectIndex(index)}
                  className={`
                    rounded-lg p-4 cursor-pointer transition-all border-l-4
                    ${
                      selectedDefectIndex === index
                        ? 'border-indusia-primary bg-indusia-surfaceMuted'
                        : 'border-transparent bg-indusia-bg hover:bg-indusia-surfaceMuted/50'
                    }
                  `}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-indusia-fail flex-shrink-0" />
                      <p className="text-sm font-semibold text-indusia-text">
                        {defect.type}
                      </p>
                    </div>
                    <StatusBadge
                      status={defect.status === 'WAITING_MANAGER' ? 'warning' : 'fail'}
                      label={defect.status === 'WAITING_MANAGER' ? 'Pending' : 'NG'}
                    />
                  </div>

                  <div className="space-y-1 mb-3">
                    <p className="text-xs text-indusia-textMuted">
                      <span className="font-medium">Component:</span> {defect.location}
                    </p>
                    <p className="text-xs text-indusia-textMuted">
                      <span className="font-medium">Confidence:</span> {defect.confidence}%
                    </p>
                    {defect.status === 'WAITING_MANAGER' && (
                      <p className="text-xs text-indusia-warning font-medium mt-2">
                        Waiting Manager Approval
                      </p>
                    )}
                  </div>

                  {defect.status !== 'WAITING_MANAGER' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openModal(defect);
                      }}
                      className="w-full px-3 py-2 bg-indusia-primary text-white text-xs font-medium rounded-lg hover:opacity-90 transition-opacity"
                    >
                      Override as False Call
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-indusia-border">
              <p className="text-xs text-indusia-textMuted text-center">
                Press <kbd className="px-2 py-1 bg-indusia-surfaceMuted rounded text-indusia-text font-mono">O</kbd> to override selected defect
              </p>
            </div>
          </Card>
        </div>

        <div className="col-span-5">
          <Card
            title="AI Detection View"
            actions={
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
                  className="p-2 bg-indusia-surfaceMuted rounded-lg hover:bg-indusia-border transition-colors"
                >
                  <ZoomOut className="w-4 h-4 text-indusia-text" />
                </button>
                <button
                  onClick={() => setZoom(Math.min(3, zoom + 0.25))}
                  className="p-2 bg-indusia-surfaceMuted rounded-lg hover:bg-indusia-border transition-colors"
                >
                  <ZoomIn className="w-4 h-4 text-indusia-text" />
                </button>
              </div>
            }
          >
            <div className="bg-indusia-bg rounded-lg border-2 border-indusia-border p-6 flex items-center justify-center relative overflow-hidden min-h-[500px]">
              <div
                style={{
                  transform: `scale(${zoom})`,
                  transition: 'transform 0.2s ease',
                }}
                className="relative"
              >
                <div className="w-96 h-80 bg-indusia-surfaceMuted rounded border border-indusia-border flex items-center justify-center relative">
                  <p className="text-indusia-textMuted text-sm">
                    [PCB Image]
                  </p>

                  {selectedDefect && (
                    <div
                      className="absolute border-2 border-indusia-fail"
                      style={{
                        left: `${(selectedDefect.x / 600) * 100}%`,
                        top: `${(selectedDefect.y / 500) * 100}%`,
                        width: '80px',
                        height: '60px',
                        transform: 'translate(-50%, -50%)',
                      }}
                    />
                  )}
                </div>
              </div>
            </div>

            {selectedDefect && (
              <div className="mt-4 pt-4 border-t border-indusia-border">
                <p className="text-sm font-semibold text-indusia-text">
                  {selectedDefect.type}
                </p>
                <p className="text-xs text-indusia-textMuted mt-1">
                  Confidence: {selectedDefect.confidence}% • Location: {selectedDefect.location}
                </p>
              </div>
            )}
          </Card>
        </div>

        <div className="col-span-3">
          <div className="space-y-6">
            <Card title="Board Status">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-indusia-textMuted">Status</span>
                  <StatusBadge
                    status={boardStatus}
                    label={boardStatus === 'fail' ? 'FAIL' : 'PASS'}
                  />
                </div>

                <div className="space-y-3 pt-4 border-t border-indusia-border">
                  <div className="flex justify-between text-sm">
                    <span className="text-indusia-textMuted">Board ID</span>
                    <span className="text-indusia-text font-mono">{boardId.toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-indusia-textMuted">Batch</span>
                    <span className="text-indusia-text">B-2024-47</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-indusia-textMuted">Line</span>
                    <span className="text-indusia-text">SMT-LINE-03</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-indusia-textMuted">Timestamp</span>
                    <span className="text-indusia-text font-mono">{timestamp}</span>
                  </div>
                </div>
              </div>
            </Card>

            <Card title="Summary">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-indusia-textMuted">Total Defects</span>
                  <span className="text-2xl font-bold text-indusia-text">{defects.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-indusia-textMuted">Overrides Pending</span>
                  <span className="text-2xl font-bold text-indusia-warning">{overridesPending}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-indusia-textMuted">Overrides Approved</span>
                  <span className="text-2xl font-bold text-indusia-pass">0</span>
                </div>
              </div>
            </Card>

            <Card title="Activity Log">
              <div className="space-y-3">
                {activityLog.map((log, index) => (
                  <div key={index} className="flex gap-3">
                    <span className="text-xs text-indusia-textMuted font-mono flex-shrink-0">
                      {log.time}
                    </span>
                    <p className="text-xs text-indusia-text">
                      {log.message}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>

          <FalseCallOverrideModal
            isOpen={modalOpen}
            onClose={closeModal}
            onConfirm={confirmOverride}
            defect={modalDefect}
            boardId={boardId.toUpperCase()}
            timestamp={timestamp}
          />
        </>
      )}
    </div>
  );
}
