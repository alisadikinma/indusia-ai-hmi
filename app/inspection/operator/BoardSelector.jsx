'use client';

/**
 * Board Selector for Operator
 * Cascading selection: Section → Customer → Line → Board
 * Shows recent boards for quick access
 */

import { useState, useEffect, useMemo } from 'react';
import { useMasterData } from '@/hooks/useMasterData';
import { ChevronRight, ChevronLeft, Clock, Cpu, Factory, Users, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BoardSelector({ user, onSelect }) {
  const {
    sections,
    customers,
    lines,
    boards,
    loading,
  } = useMasterData();

  const [step, setStep] = useState(1); // 1: Section, 2: Customer, 3: Line, 4: Board
  const [selected, setSelected] = useState({
    sectionId: null,
    sectionName: null,
    customerId: null,
    customerName: null,
    lineId: null,
    lineName: null,
  });

  // Recent boards (from localStorage)
  const [recentBoards, setRecentBoards] = useState([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('indusia_recent_boards');
      if (stored) setRecentBoards(JSON.parse(stored));
    } catch (e) {
      console.warn('Failed to load recent boards:', e);
    }
  }, []);

  // Filter sections by user's assigned sections
  const availableSections = useMemo(() => {
    if (!sections?.length) return [];
    // Superadmin sees all sections
    if (user?.role === 'superadmin') return sections;
    // Other users see only their assigned sections
    const userSections = user?.sections || [];
    return sections.filter(s =>
      userSections.some(us => us === s.id || us === s.name || s.id?.includes(us) || s.name?.toLowerCase().includes(us?.toLowerCase()))
    );
  }, [sections, user]);

  // Get unique customers that have lines in the selected section
  const availableCustomers = useMemo(() => {
    if (!selected.sectionId || !lines?.length || !customers?.length) return [];

    // Get customer IDs that have lines in this section
    const customerIds = [...new Set(
      lines
        .filter(l => l.sectionId === selected.sectionId)
        .map(l => l.customerId)
    )];

    return customers.filter(c => customerIds.includes(c.id));
  }, [selected.sectionId, lines, customers]);

  // Filter lines by section and customer
  const availableLines = useMemo(() => {
    if (!selected.sectionId || !lines?.length) return [];

    return lines.filter(l => {
      const matchesSection = l.sectionId === selected.sectionId;
      const matchesCustomer = !selected.customerId || l.customerId === selected.customerId;
      return matchesSection && matchesCustomer;
    });
  }, [selected.sectionId, selected.customerId, lines]);

  // Filter boards by customer (and line if available in the data)
  const availableBoards = useMemo(() => {
    if (!selected.customerId || !boards?.length) return [];

    return boards.filter(b => {
      const matchesCustomer = b.customerId === selected.customerId;
      // If board has lineId, filter by line as well
      const matchesLine = !b.lineId || !selected.lineId || b.lineId === selected.lineId;
      // Only show active boards if status is available
      const isActive = !b.status || b.status === 'active';
      return matchesCustomer && matchesLine && isActive;
    });
  }, [selected.customerId, selected.lineId, boards]);

  const handleSelect = (type, value, extra = {}) => {
    switch (type) {
      case 'section':
        setSelected({
          sectionId: value,
          sectionName: extra.name,
          customerId: null,
          customerName: null,
          lineId: null,
          lineName: null,
        });
        setStep(2);
        break;
      case 'customer':
        setSelected(prev => ({
          ...prev,
          customerId: value,
          customerName: extra.name,
          lineId: null,
          lineName: null,
        }));
        setStep(3);
        break;
      case 'line':
        setSelected(prev => ({
          ...prev,
          lineId: value,
          lineName: extra.name,
        }));
        setStep(4);
        break;
      case 'board':
        // Save to recent boards
        const newRecent = [
          {
            boardId: value,
            boardName: extra.name,
            lineId: selected.lineId,
            lineName: selected.lineName,
            sectionId: selected.sectionId,
            sectionName: selected.sectionName,
            customerId: selected.customerId,
            customerName: selected.customerName,
            timestamp: Date.now(),
          },
          ...recentBoards.filter(r => r.boardId !== value),
        ].slice(0, 5);

        localStorage.setItem('indusia_recent_boards', JSON.stringify(newRecent));
        setRecentBoards(newRecent);

        // Callback to parent
        onSelect({
          boardId: value,
          lineId: selected.lineId,
          sectionId: selected.sectionId,
          customerId: selected.customerId,
          lineName: selected.lineName,
        });
        break;
    }
  };

  const handleQuickSelect = (recent) => {
    onSelect({
      boardId: recent.boardId,
      lineId: recent.lineId,
      sectionId: recent.sectionId,
      customerId: recent.customerId,
      lineName: recent.lineName,
    });
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  if (loading) {
    return <LoadingState />;
  }

  return (
    <div className="min-h-screen bg-indusia-bg p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-indusia-text mb-2">
            Select Board for Inspection
          </h1>
          <p className="text-indusia-textMuted">
            Choose a board to begin visual inspection
          </p>
        </div>

        {/* Recent Boards - Quick Access */}
        {recentBoards.length > 0 && step === 1 && (
          <div className="mb-8">
            <h2 className="text-sm font-medium text-indusia-textMuted mb-3 flex items-center gap-2">
              <Clock size={16} />
              RECENT BOARDS
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {recentBoards.map((recent, i) => (
                <button
                  key={`${recent.boardId}-${i}`}
                  onClick={() => handleQuickSelect(recent)}
                  className="p-4 bg-indusia-surface border border-indusia-border rounded-xl text-left hover:border-indusia-primary transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indusia-primary/20 flex items-center justify-center group-hover:bg-indusia-primary/30 transition-colors">
                      <Cpu size={20} className="text-indusia-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-indusia-text truncate">
                        {recent.boardName || recent.boardId}
                      </div>
                      <div className="text-xs text-indusia-textMuted truncate">
                        {recent.lineName || recent.lineId} • {recent.sectionName || recent.sectionId}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 mb-6 text-sm flex-wrap">
          <BreadcrumbItem
            label="Section"
            value={selected.sectionName}
            active={step >= 1}
            clickable={step > 1}
            onClick={() => setStep(1)}
          />
          <ChevronRight size={14} className="text-indusia-textMuted" />
          <BreadcrumbItem
            label="Customer"
            value={selected.customerName}
            active={step >= 2}
            clickable={step > 2}
            onClick={() => step > 1 && setStep(2)}
          />
          <ChevronRight size={14} className="text-indusia-textMuted" />
          <BreadcrumbItem
            label="Line"
            value={selected.lineName}
            active={step >= 3}
            clickable={step > 3}
            onClick={() => step > 2 && setStep(3)}
          />
          <ChevronRight size={14} className="text-indusia-textMuted" />
          <BreadcrumbItem
            label="Board"
            active={step >= 4}
            clickable={false}
          />
        </div>

        {/* Selection Grid */}
        <div className="bg-indusia-surface border border-indusia-border rounded-xl p-6">
          {/* Back Button */}
          {step > 1 && (
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-sm text-indusia-textMuted hover:text-indusia-text mb-4 transition-colors"
            >
              <ChevronLeft size={16} />
              Back
            </button>
          )}

          {step === 1 && (
            <SelectionGrid
              title="Select Section"
              icon={<Layers size={20} className="text-indusia-primary" />}
              items={availableSections}
              onSelect={(item) => handleSelect('section', item.id, { name: item.name })}
              renderItem={(item) => (
                <div>
                  <div className="font-semibold">{item.name}</div>
                  {item.code && (
                    <div className="text-xs text-indusia-textMuted">{item.code}</div>
                  )}
                </div>
              )}
              emptyMessage="No sections available for your account"
            />
          )}

          {step === 2 && (
            <SelectionGrid
              title="Select Customer"
              icon={<Users size={20} className="text-indusia-primary" />}
              items={availableCustomers}
              onSelect={(item) => handleSelect('customer', item.id, { name: item.name })}
              renderItem={(item) => (
                <div>
                  <div className="font-semibold">{item.name}</div>
                  {item.code && (
                    <div className="text-xs text-indusia-textMuted">{item.code}</div>
                  )}
                </div>
              )}
              emptyMessage="No customers found for this section"
            />
          )}

          {step === 3 && (
            <SelectionGrid
              title="Select Production Line"
              icon={<Factory size={20} className="text-indusia-primary" />}
              items={availableLines}
              onSelect={(item) => handleSelect('line', item.id, { name: item.name })}
              renderItem={(item) => (
                <div>
                  <div className="font-semibold">{item.name}</div>
                  <div className="text-xs text-indusia-textMuted">
                    {item.status && (
                      <>
                        Status:{' '}
                        <span className={cn(
                          item.status === 'running' ? 'text-emerald-400' :
                          item.status === 'idle' ? 'text-yellow-400' : 'text-red-400'
                        )}>
                          {item.status}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}
              emptyMessage="No lines found for this customer"
            />
          )}

          {step === 4 && (
            <SelectionGrid
              title="Select Board"
              icon={<Cpu size={20} className="text-indusia-primary" />}
              items={availableBoards}
              onSelect={(item) => handleSelect('board', item.id, { name: item.name })}
              renderItem={(item) => (
                <div>
                  <div className="font-semibold">{item.name}</div>
                  <div className="text-xs text-indusia-textMuted">
                    {item.code && `${item.code} • `}
                    Rev {item.revision || '1.0'}
                  </div>
                </div>
              )}
              emptyMessage="No active boards found for this line"
            />
          )}
        </div>

        {/* Keyboard Shortcuts Hint */}
        <div className="mt-6 text-center text-xs text-indusia-textMuted">
          <span className="px-2 py-1 bg-indusia-surface rounded border border-indusia-border mr-1">ESC</span>
          to go back
        </div>
      </div>
    </div>
  );
}

// Breadcrumb item component
function BreadcrumbItem({ label, value, active, clickable, onClick }) {
  return (
    <button
      onClick={clickable ? onClick : undefined}
      disabled={!clickable}
      className={cn(
        'transition-colors',
        active ? 'text-indusia-primary' : 'text-indusia-textMuted',
        clickable && 'hover:text-indusia-text cursor-pointer',
        !clickable && 'cursor-default'
      )}
    >
      {value || label}
    </button>
  );
}

// Selection grid component
function SelectionGrid({ title, icon, items, onSelect, renderItem, emptyMessage }) {
  if (!items || items.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-full bg-indusia-bg flex items-center justify-center mx-auto mb-4">
          {icon}
        </div>
        <p className="text-indusia-textMuted">
          {emptyMessage || 'No items available'}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3 className="text-lg font-semibold text-indusia-text">{title}</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item)}
            className={cn(
              'p-4 bg-indusia-bg border border-indusia-border rounded-lg text-left',
              'hover:border-indusia-primary hover:bg-indusia-primary/5',
              'active:bg-indusia-primary/10',
              'transition-all duration-150',
              'focus:outline-none focus:ring-2 focus:ring-indusia-primary/50'
            )}
          >
            {renderItem(item)}
          </button>
        ))}
      </div>
    </div>
  );
}

// Loading state component
function LoadingState() {
  return (
    <div className="min-h-screen bg-indusia-bg flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-3 border-indusia-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-indusia-textMuted">Loading master data...</p>
      </div>
    </div>
  );
}

export default BoardSelector;
