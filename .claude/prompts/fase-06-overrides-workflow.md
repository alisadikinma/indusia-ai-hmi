# FASE 6: Overrides Workflow

## Role
You are a senior React developer implementing the complete override workflow for INDUSIA AI HMI - connecting operator false-call submissions to manager approval queue via real API.

## Context
INDUSIA AI HMI is a production-floor system with:
- Next.js 14+ (App Router, JavaScript only)
- Override workflow: Operator submits → Manager reviews → Approve/Reject
- API routes ready: `/api/overrides/*`
- Hook ready: `useOverrides`

Project files for reference:
- `app/inspection/overrides/page.js` - Manager override queue
- `components/inspection/OverrideReviewModal.jsx` - Review modal
- `components/inspection/FalseCallOverrideModal.jsx` - Operator submit modal
- `hooks/useOverrides.js` - Override hook

Working directory: `C:\xampp\htdocs\indusia-ai-hmi`

## Objective
Connect override UI components ke real API, implementing full workflow dari submit sampai approve/reject dengan event logging dan notifications.

## Tasks

### 6.1 Update FalseCallOverrideModal
Modify `components/inspection/FalseCallOverrideModal.jsx`:

```js
// On submit:
// 1. Call createOverride from useOverrides
// 2. Log event: OVERRIDE_SUBMIT
// 3. Create notification for managers
// 4. Show success/error feedback
// 5. Close modal and refresh list

const handleSubmit = async (formData) => {
  setLoading(true)
  try {
    const override = await createOverride({
      board_id: formData.boardId,
      defect_type: formData.defectType,
      location: formData.location,
      confidence: formData.confidence,
      reason: formData.reason,
      operator_notes: formData.notes,
      operator_id: currentUser.id,
      operator_name: currentUser.name,
      section_id: currentSection,
      customer_id: currentCustomer
    })
    
    // Log event
    await logEvent({
      type: 'OVERRIDE_SUBMIT',
      source: 'HMI',
      user_id: currentUser.id,
      details: { override_id: override.id, board_id: formData.boardId }
    })
    
    onSuccess()
    onClose()
  } catch (error) {
    setError(error.message)
  } finally {
    setLoading(false)
  }
}
```

### 6.2 Update Override Queue Page
Modify `app/inspection/overrides/page.js`:

```js
// Use real hook instead of mock data
const { 
  overrides, 
  loading, 
  filters, 
  setFilters, 
  stats,
  refreshOverrides 
} = useOverrides()

// Implement filters:
// - Status dropdown (all, pending, approved, rejected)
// - Section filter
// - Customer filter
// - Date range picker

// Display stats cards:
// - Pending count
// - Approved count
// - Rejected count
```

### 6.3 Update OverrideReviewModal
Modify `components/inspection/OverrideReviewModal.jsx`:

```js
// On approve:
const handleApprove = async () => {
  setLoading(true)
  try {
    await approveOverride(override.id, reviewerNotes)
    
    // Log event
    await logEvent({
      type: 'OVERRIDE_APPROVED',
      source: 'ADMIN_CONSOLE',
      user_id: currentUser.id,
      details: { override_id: override.id, notes: reviewerNotes }
    })
    
    // Notify operator
    await createNotification({
      type: 'WORKFLOW',
      category: 'OVERRIDE_APPROVED',
      title: 'Override Approved',
      message: `Your override for ${override.board_id} was approved`,
      user_id: override.operator_id,
      severity: 'INFO'
    })
    
    onSuccess()
    onClose()
  } catch (error) {
    setError(error.message)
  } finally {
    setLoading(false)
  }
}

// On reject - similar pattern with OVERRIDE_REJECTED
```

### 6.4 Add Event Logging Integration
Create helper `lib/eventLogger.js`:

```js
export async function logOverrideEvent(type, userId, details) {
  try {
    await fetch('/api/event-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        source: 'HMI',
        user_id: userId,
        timestamp: new Date().toISOString(),
        details
      })
    })
  } catch (error) {
    console.error('Failed to log event:', error)
    // Non-blocking - don't throw
  }
}
```

### 6.5 Add Notification Integration
Create helper `lib/notificationHelper.js`:

```js
export async function notifyUser(notification) {
  try {
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...notification,
        created_at: new Date().toISOString(),
        read: false
      })
    })
  } catch (error) {
    console.error('Failed to create notification:', error)
    // Non-blocking
  }
}

export async function notifyManagers(notification) {
  // Get all managers and notify each
  // Or create single notification with user_id: null (broadcast)
}
```

## Override Status Flow
```
┌─────────┐     Submit      ┌─────────┐
│ (none)  │ ───────────────>│ pending │
└─────────┘                 └────┬────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
                    ▼ Approve                 ▼ Reject
              ┌──────────┐             ┌──────────┐
              │ approved │             │ rejected │
              └──────────┘             └──────────┘
```

## Event Types
- `OVERRIDE_SUBMIT` - Operator submits override
- `OVERRIDE_APPROVED` - Manager approves
- `OVERRIDE_REJECTED` - Manager rejects

## Constraints
- Use existing UI components - only modify data fetching
- Maintain current UX flow
- Event logging is non-blocking (fire and forget)
- Notifications are non-blocking
- Add loading states to buttons
- Show toast/alert for success/error

## Output Files
```
components/inspection/
├── FalseCallOverrideModal.jsx (modify)
└── OverrideReviewModal.jsx (modify)

app/inspection/overrides/
└── page.js (modify)

lib/
├── eventLogger.js (create)
└── notificationHelper.js (create)
```

## Validation Checklist
- [ ] Operator can submit new override
- [ ] Override appears in manager queue as "pending"
- [ ] Manager can approve override
- [ ] Manager can reject override
- [ ] Status updates correctly after action
- [ ] Event log records all actions
- [ ] Notifications created for relevant users
- [ ] Filters work on override list

## Estimated Time
2-3 hours
