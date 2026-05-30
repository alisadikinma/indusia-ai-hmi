# Phase 5: HMI Operator Page Route

## Objective
Create dedicated page route untuk HMI Operator fullscreen view dengan role-based access dan board selection.

---

## Context

Components ready:
- `components/inspection/HMIOperatorView.jsx` — main operator interface
- `components/inspection/HMIActionPanel.jsx` — action buttons + timer
- `components/inspection/HMITimer.jsx` — auto-approve countdown
- `hooks/useHMILayout.js` — role-based layout management

Dependencies:
- `AuthContext` untuk user role detection
- `useLiveInspection` hook untuk real-time data
- Master data (sections, lines, boards)

---

## Architecture

```
/inspection/operator
├── Board selection (if not pre-selected)
│   └── Cascading: Section → Customer → Line → Board
├── HMIOperatorView (fullscreen)
│   ├── Compact header
│   ├── Action panel (left)
│   ├── Camera view (right)
│   └── Footer controls
└── Exit → back to selection or dashboard
```

---

## Task 1: Create Page Route

### 1.1 `app/inspection/operator/page.jsx`

```javascript
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { HMIOperatorView } from '@/components/inspection';
import { BoardSelector } from './BoardSelector';

export default function OperatorInspectionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, isLoading } = useAuth();
  
  // Get params from URL or user context
  const [selectedBoard, setSelectedBoard] = useState(null);
  const [selectedLine, setSelectedLine] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Initialize from URL params
  useEffect(() => {
    const boardId = searchParams.get('boardId');
    const lineId = searchParams.get('lineId');
    const sectionId = searchParams.get('sectionId');
    const customerId = searchParams.get('customerId');
    
    if (boardId) setSelectedBoard(boardId);
    if (lineId) setSelectedLine(lineId);
    if (sectionId) setSelectedSection(sectionId);
    if (customerId) setSelectedCustomer(customerId);
  }, [searchParams]);

  // Or from user context (operator pre-selection)
  useEffect(() => {
    if (user?.selectedBoardId && !selectedBoard) {
      setSelectedBoard(user.selectedBoardId);
      setSelectedLine(user.selectedLineId);
      setSelectedSection(user.selectedSectionId);
      setSelectedCustomer(user.selectedCustomerId);
    }
  }, [user]);

  // Auth guard
  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    router.push('/login');
    return null;
  }

  // Handle exit from inspection
  const handleExit = () => {
    setSelectedBoard(null);
    // Or redirect: router.push('/dashboard');
  };

  // Board selection flow
  if (!selectedBoard || !selectedLine) {
    return (
      <BoardSelector
        user={user}
        onSelect={({ boardId, lineId, sectionId, customerId, lineName }) => {
          setSelectedBoard(boardId);
          setSelectedLine(lineId);
          setSelectedSection(sectionId);
          setSelectedCustomer(customerId);
          
          // Update URL
          const params = new URLSearchParams({
            boardId,
            lineId,
            sectionId,
            customerId,
          });
          router.replace(`/inspection/operator?${params.toString()}`);
        }}
      />
    );
  }

  // Main inspection view
  return (
    <HMIOperatorView
      lineId={selectedLine}
      boardId={selectedBoard}
      sectionId={selectedSection}
      customerId={selectedCustomer}
      user={user}
      onExit={handleExit}
    />
  );
}

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
```

---

## Task 2: Board Selector Component

### 2.1 `app/inspection/operator/BoardSelector.jsx`

```javascript
'use client';

/**
 * Board Selector for Operator
 * Cascading selection: Section → Customer → Line → Board
 * Shows recent boards for quick access
 */

import { useState, useEffect } from 'react';
import { useMasterData } from '@/hooks/useMasterData';
import { ChevronRight, Clock, Cpu } from 'lucide-react';

export function BoardSelector({ user, onSelect }) {
  const { 
    sections, 
    customers, 
    lines, 
    boards,
    loading 
  } = useMasterData();

  const [step, setStep] = useState(1); // 1: Section, 2: Customer, 3: Line, 4: Board
  const [selected, setSelected] = useState({
    sectionId: null,
    customerId: null,
    lineId: null,
    lineName: null,
  });

  // Filter data based on selections
  const availableSections = sections.filter(s => 
    user?.sections?.includes(s.id) || user?.role === 'superadmin'
  );

  const availableCustomers = selected.sectionId 
    ? customers.filter(c => c.section_id === selected.sectionId)
    : [];

  const availableLines = selected.customerId
    ? lines.filter(l => l.customer_id === selected.customerId)
    : [];

  const availableBoards = selected.lineId
    ? boards.filter(b => b.line_id === selected.lineId && b.status === 'active')
    : [];

  // Recent boards (from localStorage or API)
  const [recentBoards, setRecentBoards] = useState([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('indusia_recent_boards');
      if (stored) setRecentBoards(JSON.parse(stored));
    } catch (e) {}
  }, []);

  const handleSelect = (type, value, extra = {}) => {
    switch (type) {
      case 'section':
        setSelected({ sectionId: value, customerId: null, lineId: null, lineName: null });
        setStep(2);
        break;
      case 'customer':
        setSelected(prev => ({ ...prev, customerId: value, lineId: null, lineName: null }));
        setStep(3);
        break;
      case 'line':
        setSelected(prev => ({ ...prev, lineId: value, lineName: extra.name }));
        setStep(4);
        break;
      case 'board':
        // Save to recent
        const newRecent = [
          { boardId: value, lineId: selected.lineId, ...selected, ...extra },
          ...recentBoards.filter(r => r.boardId !== value)
        ].slice(0, 5);
        localStorage.setItem('indusia_recent_boards', JSON.stringify(newRecent));
        
        // Callback
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
        {recentBoards.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-medium text-indusia-textMuted mb-3 flex items-center gap-2">
              <Clock size={16} />
              RECENT BOARDS
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {recentBoards.map((recent, i) => (
                <button
                  key={i}
                  onClick={() => handleQuickSelect(recent)}
                  className="p-4 bg-indusia-surface border border-indusia-border rounded-xl text-left hover:border-indusia-primary transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Cpu size={20} className="text-indusia-primary" />
                    <div>
                      <div className="font-semibold text-indusia-text">{recent.boardId}</div>
                      <div className="text-xs text-indusia-textMuted">{recent.lineName}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6 text-sm">
          <button 
            onClick={() => setStep(1)} 
            className={step >= 1 ? 'text-indusia-primary' : 'text-indusia-textMuted'}
          >
            Section
          </button>
          <ChevronRight size={14} className="text-indusia-textMuted" />
          <button 
            onClick={() => step > 1 && setStep(2)}
            className={step >= 2 ? 'text-indusia-primary' : 'text-indusia-textMuted'}
          >
            Customer
          </button>
          <ChevronRight size={14} className="text-indusia-textMuted" />
          <button 
            onClick={() => step > 2 && setStep(3)}
            className={step >= 3 ? 'text-indusia-primary' : 'text-indusia-textMuted'}
          >
            Line
          </button>
          <ChevronRight size={14} className="text-indusia-textMuted" />
          <span className={step >= 4 ? 'text-indusia-primary' : 'text-indusia-textMuted'}>
            Board
          </span>
        </div>

        {/* Selection Grid */}
        <div className="bg-indusia-surface border border-indusia-border rounded-xl p-6">
          {step === 1 && (
            <SelectionGrid
              title="Select Section"
              items={availableSections}
              onSelect={(item) => handleSelect('section', item.id)}
              renderItem={(item) => (
                <div>
                  <div className="font-semibold">{item.name}</div>
                  <div className="text-xs text-indusia-textMuted">{item.code}</div>
                </div>
              )}
            />
          )}

          {step === 2 && (
            <SelectionGrid
              title="Select Customer"
              items={availableCustomers}
              onSelect={(item) => handleSelect('customer', item.id)}
              renderItem={(item) => (
                <div>
                  <div className="font-semibold">{item.name}</div>
                  <div className="text-xs text-indusia-textMuted">{item.code}</div>
                </div>
              )}
              emptyMessage="No customers found for this section"
            />
          )}

          {step === 3 && (
            <SelectionGrid
              title="Select Production Line"
              items={availableLines}
              onSelect={(item) => handleSelect('line', item.id, { name: item.name })}
              renderItem={(item) => (
                <div>
                  <div className="font-semibold">{item.name}</div>
                  <div className="text-xs text-indusia-textMuted">
                    Status: <span className={item.status === 'running' ? 'text-emerald-400' : 'text-yellow-400'}>
                      {item.status}
                    </span>
                  </div>
                </div>
              )}
              emptyMessage="No lines found for this customer"
            />
          )}

          {step === 4 && (
            <SelectionGrid
              title="Select Board"
              items={availableBoards}
              onSelect={(item) => handleSelect('board', item.id, { name: item.name })}
              renderItem={(item) => (
                <div>
                  <div className="font-semibold">{item.name}</div>
                  <div className="text-xs text-indusia-textMuted">
                    {item.code} • Rev {item.revision || '1.0'}
                  </div>
                </div>
              )}
              emptyMessage="No active boards found for this line"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function SelectionGrid({ title, items, onSelect, renderItem, emptyMessage }) {
  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-indusia-textMuted">
        {emptyMessage || 'No items available'}
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-indusia-text mb-4">{title}</h3>
      <div className="grid grid-cols-3 gap-3">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item)}
            className="p-4 bg-indusia-bg border border-indusia-border rounded-lg text-left hover:border-indusia-primary hover:bg-indusia-primary/5 transition-colors"
          >
            {renderItem(item)}
          </button>
        ))}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="min-h-screen bg-indusia-bg flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-indusia-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default BoardSelector;
```

---

## Task 3: Update Layout (Optional)

### 3.1 `app/inspection/operator/layout.jsx`

```javascript
/**
 * Operator Inspection Layout
 * Minimal layout - no sidebar, no header (handled by HMIOperatorView)
 */

export const metadata = {
  title: 'Inspection - INDUSIA AI HMI',
  description: 'PCB Visual Inspection Interface',
};

export default function OperatorInspectionLayout({ children }) {
  return (
    <div className="min-h-screen bg-indusia-bg">
      {children}
    </div>
  );
}
```

---

## Task 4: Add Navigation Entry

### 4.1 Update sidebar menu (untuk Manager/Admin view)

Add entry di `data/masterData.js` atau menu config:

```javascript
{
  id: 'inspection_operator',
  label: 'Operator View',
  icon: 'Monitor',
  path: '/inspection/operator',
  roles: ['operator', 'manager', 'engineer', 'superadmin'],
}
```

---

## Verification Checklist

- [ ] Page loads without errors
- [ ] Auth redirect works for unauthenticated users
- [ ] Board selection flow complete (Section → Customer → Line → Board)
- [ ] Recent boards quick-select works
- [ ] URL params persist selection
- [ ] HMIOperatorView renders correctly
- [ ] Exit button returns to selection
- [ ] Keyboard shortcuts work (A/R/F/Space/Esc)

---

## Test Scenarios

| Scenario | Expected |
|----------|----------|
| Direct access `/inspection/operator` | Show board selector |
| Access with params `?boardId=...` | Skip to inspection view |
| Operator with pre-selected line | Auto-fill selections |
| Press ESC in fullscreen | Exit fullscreen mode |
| Click STOP | Return to board selector |

---

## Notes

- Operator mode designed untuk touchscreen (30mm+ buttons)
- Minimal navigation — focus pada inspection task
- Recent boards untuk quick access (stored in localStorage)
- URL params untuk bookmarking/sharing specific board
