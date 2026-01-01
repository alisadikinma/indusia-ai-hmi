'use client';

/**
 * Operator Inspection Page
 * Entry point for HMI Operator fullscreen inspection view
 * Handles board selection and renders HMIOperatorView
 */

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { HMIOperatorView } from '@/components/inspection';
import BoardSelector from './BoardSelector';

function OperatorPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, isLoading } = useAuth();

  // Selection state
  const [selectedBoard, setSelectedBoard] = useState(null);
  const [selectedLine, setSelectedLine] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [lineName, setLineName] = useState(null);

  // Initialize from URL params
  useEffect(() => {
    const boardId = searchParams.get('boardId');
    const lineId = searchParams.get('lineId');
    const sectionId = searchParams.get('sectionId');
    const customerId = searchParams.get('customerId');
    const lineNameParam = searchParams.get('lineName');

    if (boardId) setSelectedBoard(boardId);
    if (lineId) setSelectedLine(lineId);
    if (sectionId) setSelectedSection(sectionId);
    if (customerId) setSelectedCustomer(customerId);
    if (lineNameParam) setLineName(lineNameParam);
  }, [searchParams]);

  // Initialize from user context (operator pre-selection)
  useEffect(() => {
    if (user?.selectedBoardId && !selectedBoard) {
      setSelectedBoard(user.selectedBoardId);
      setSelectedLine(user.selectedLineId);
      setSelectedSection(user.selectedSectionId);
      setSelectedCustomer(user.selectedCustomerId);
    }
  }, [user, selectedBoard]);

  // Auth guard - show loading screen while checking auth
  if (isLoading) {
    return <LoadingScreen />;
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    router.push('/login');
    return null;
  }

  // Handle exit from inspection view
  const handleExit = () => {
    setSelectedBoard(null);
    setSelectedLine(null);
    setLineName(null);
    // Clear URL params
    router.replace('/inspection/operator');
  };

  // Handle board selection
  const handleBoardSelect = ({ boardId, lineId, sectionId, customerId, lineName: selectedLineName }) => {
    setSelectedBoard(boardId);
    setSelectedLine(lineId);
    setSelectedSection(sectionId);
    setSelectedCustomer(customerId);
    setLineName(selectedLineName);

    // Update URL with selection params
    const params = new URLSearchParams({
      boardId,
      lineId,
      sectionId,
      customerId,
      ...(selectedLineName && { lineName: selectedLineName }),
    });
    router.replace(`/inspection/operator?${params.toString()}`);
  };

  // Show board selector if no board/line selected
  if (!selectedBoard || !selectedLine) {
    return (
      <BoardSelector
        user={user}
        onSelect={handleBoardSelect}
      />
    );
  }

  // Main inspection view
  return (
    <HMIOperatorView
      lineId={selectedLine}
      lineName={lineName}
      boardId={selectedBoard}
      sectionId={selectedSection}
      customerId={selectedCustomer}
      user={user}
      onExit={handleExit}
    />
  );
}

// Loading screen component
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-indusia-bg flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-indusia-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-indusia-textMuted">Loading...</p>
      </div>
    </div>
  );
}

// Main export with Suspense boundary for useSearchParams
export default function OperatorInspectionPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <OperatorPageContent />
    </Suspense>
  );
}
