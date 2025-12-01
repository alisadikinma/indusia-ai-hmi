'use client';

import { useEffect } from 'react';

export function useInspectionKeyboardShortcuts({
  selectedDefectIndex,
  setSelectedDefectIndex,
  defects,
  modalOpen,
  openModal,
  closeModal,
  confirmOverride,
}) {
  useEffect(() => {
    function handleKeyDown(e) {
      const isTyping = e.target.tagName === 'INPUT' ||
                       e.target.tagName === 'TEXTAREA' ||
                       e.target.isContentEditable;

      if (isTyping) return;

      const key = e.key.toLowerCase();

      switch (key) {
        case 'o':
          e.preventDefault();
          if (!modalOpen && defects[selectedDefectIndex]) {
            openModal(defects[selectedDefectIndex]);
          }
          break;

        case 'enter':
          if (modalOpen) {
            e.preventDefault();
            confirmOverride();
          }
          break;

        case 'escape':
          if (modalOpen) {
            e.preventDefault();
            closeModal();
          }
          break;

        case 'arrowright':
          e.preventDefault();
          if (selectedDefectIndex < defects.length - 1) {
            setSelectedDefectIndex(selectedDefectIndex + 1);
          }
          break;

        case 'arrowleft':
          e.preventDefault();
          if (selectedDefectIndex > 0) {
            setSelectedDefectIndex(selectedDefectIndex - 1);
          }
          break;

        default:
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    selectedDefectIndex,
    setSelectedDefectIndex,
    defects,
    modalOpen,
    openModal,
    closeModal,
    confirmOverride,
  ]);
}
