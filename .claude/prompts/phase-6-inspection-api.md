# Phase 6: Inspection Action API

## Objective
Create backend API endpoints untuk record operator decisions (approve/reject/false call) dan inspection statistics.

---

## Context

Components ready:
- `HMIOperatorView.jsx` — calls action handlers
- `HMIActionPanel.jsx` — triggers onApprove/onReject/onFalseCall
- `useLiveInspection.js` — manages real-time state

Database tables needed:
- `inspection_results` — individual inspection decisions
- `inspection_stats` — aggregated statistics per shift/line
- `auto_actions` — log of auto-approved items

---

## Database Schema

### Task 0: Create/Update Tables

```sql
-- =============================================
-- Table: inspection_results
-- Records each operator decision
-- =============================================
CREATE TABLE IF NOT EXISTS inspection_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Context
  board_id UUID REFERENCES boards(id),
  line_id UUID REFERENCES lines(id),
  section_id UUID REFERENCES sections(id),
  customer_id UUID REFERENCES customers(id),
  
  -- Frame reference
  frame_id UUID REFERENCES inspection_frames(id),
  image_url TEXT,
  
  -- AI Detection
  ai_result VARCHAR(20), -- 'pass', 'fail', 'review'
  ai_confidence DECIMAL(5,4),
  ai_defect_type VARCHAR(100),
  ai_detections JSONB, -- Full detection array
  
  -- Operator Decision
  operator_action VARCHAR(20) NOT NULL, -- 'approve', 'reject', 'false_call', 'auto_approve'
  operator_id UUID REFERENCES users(id),
  operator_notes TEXT,
  
  -- Timing
  decision_time_ms INTEGER, -- Time from display to decision
  auto_approved BOOLEAN DEFAULT FALSE,
  
  -- Override reference (if false_call)
  override_id UUID REFERENCES overrides(id),
  
  -- Timestamps
  inspected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_inspection_results_line ON inspection_results(line_id, inspected_at DESC);
CREATE INDEX idx_inspection_results_board ON inspection_results(board_id, inspected_at DESC);
CREATE INDEX idx_inspection_results_operator ON inspection_results(operator_id, inspected_at DESC);
CREATE INDEX idx_inspection_results_action ON inspection_results(operator_action, inspected_at DESC);

-- =============================================
-- Table: inspection_sessions
-- Tracks operator inspection sessions
-- =============================================
CREATE TABLE IF NOT EXISTS inspection_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Context
  operator_id UUID REFERENCES users(id) NOT NULL,
  line_id UUID REFERENCES lines(id) NOT NULL,
  board_id UUID REFERENCES boards(id),
  
  -- Session info
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'paused', 'completed', 'abandoned'
  
  -- Stats
  total_inspected INTEGER DEFAULT 0,
  total_approved INTEGER DEFAULT 0,
  total_rejected INTEGER DEFAULT 0,
  total_false_calls INTEGER DEFAULT 0,
  total_auto_approved INTEGER DEFAULT 0,
  
  -- Timing
  total_pause_time_ms INTEGER DEFAULT 0,
  avg_decision_time_ms INTEGER,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inspection_sessions_operator ON inspection_sessions(operator_id, started_at DESC);
CREATE INDEX idx_inspection_sessions_line ON inspection_sessions(line_id, started_at DESC);

-- =============================================
-- Function: Update session stats
-- =============================================
CREATE OR REPLACE FUNCTION update_session_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE inspection_sessions
  SET 
    total_inspected = total_inspected + 1,
    total_approved = total_approved + CASE WHEN NEW.operator_action = 'approve' THEN 1 ELSE 0 END,
    total_rejected = total_rejected + CASE WHEN NEW.operator_action = 'reject' THEN 1 ELSE 0 END,
    total_false_calls = total_false_calls + CASE WHEN NEW.operator_action = 'false_call' THEN 1 ELSE 0 END,
    total_auto_approved = total_auto_approved + CASE WHEN NEW.auto_approved THEN 1 ELSE 0 END,
    updated_at = NOW()
  WHERE id = NEW.session_id AND status = 'active';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add session_id to inspection_results if not exists
ALTER TABLE inspection_results 
ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES inspection_sessions(id);

-- Create trigger
DROP TRIGGER IF EXISTS trg_update_session_stats ON inspection_results;
CREATE TRIGGER trg_update_session_stats
AFTER INSERT ON inspection_results
FOR EACH ROW
WHEN (NEW.session_id IS NOT NULL)
EXECUTE FUNCTION update_session_stats();
```

---

## API Endpoints

### Task 1: Create Repository

#### 1.1 `lib/repos/inspectionRepo.js`

```javascript
/**
 * Inspection Repository
 * Database operations for inspection results and sessions
 */

import { supabase } from '@/lib/supabaseClient';

export const inspectionRepo = {
  // =============================================
  // Sessions
  // =============================================
  
  /**
   * Start new inspection session
   */
  async startSession({ operatorId, lineId, boardId }) {
    try {
      const { data, error } = await supabase
        .from('inspection_sessions')
        .insert({
          operator_id: operatorId,
          line_id: lineId,
          board_id: boardId,
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('startSession error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * End inspection session
   */
  async endSession(sessionId) {
    try {
      const { data, error } = await supabase
        .from('inspection_sessions')
        .update({
          status: 'completed',
          ended_at: new Date().toISOString(),
        })
        .eq('id', sessionId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('endSession error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Pause/Resume session
   */
  async updateSessionStatus(sessionId, status, pauseTimeMs = 0) {
    try {
      const updateData = { status, updated_at: new Date().toISOString() };
      
      if (pauseTimeMs > 0) {
        // Add to total pause time
        const { data: current } = await supabase
          .from('inspection_sessions')
          .select('total_pause_time_ms')
          .eq('id', sessionId)
          .single();
          
        updateData.total_pause_time_ms = (current?.total_pause_time_ms || 0) + pauseTimeMs;
      }

      const { data, error } = await supabase
        .from('inspection_sessions')
        .update(updateData)
        .eq('id', sessionId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('updateSessionStatus error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get active session for operator
   */
  async getActiveSession(operatorId) {
    try {
      const { data, error } = await supabase
        .from('inspection_sessions')
        .select('*')
        .eq('operator_id', operatorId)
        .eq('status', 'active')
        .order('started_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return { success: true, data: data || null };
    } catch (error) {
      console.error('getActiveSession error:', error);
      return { success: false, error: error.message };
    }
  },

  // =============================================
  // Results
  // =============================================

  /**
   * Record inspection result
   */
  async recordResult({
    sessionId,
    boardId,
    lineId,
    sectionId,
    customerId,
    frameId,
    imageUrl,
    aiResult,
    aiConfidence,
    aiDefectType,
    aiDetections,
    operatorAction,
    operatorId,
    operatorNotes,
    decisionTimeMs,
    autoApproved = false,
  }) {
    try {
      const { data, error } = await supabase
        .from('inspection_results')
        .insert({
          session_id: sessionId,
          board_id: boardId,
          line_id: lineId,
          section_id: sectionId,
          customer_id: customerId,
          frame_id: frameId,
          image_url: imageUrl,
          ai_result: aiResult,
          ai_confidence: aiConfidence,
          ai_defect_type: aiDefectType,
          ai_detections: aiDetections,
          operator_action: operatorAction,
          operator_id: operatorId,
          operator_notes: operatorNotes,
          decision_time_ms: decisionTimeMs,
          auto_approved: autoApproved,
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('recordResult error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Link false call to override
   */
  async linkOverride(resultId, overrideId) {
    try {
      const { data, error } = await supabase
        .from('inspection_results')
        .update({ override_id: overrideId })
        .eq('id', resultId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('linkOverride error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get results for session
   */
  async getSessionResults(sessionId, limit = 50) {
    try {
      const { data, error } = await supabase
        .from('inspection_results')
        .select('*')
        .eq('session_id', sessionId)
        .order('inspected_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('getSessionResults error:', error);
      return { success: false, error: error.message };
    }
  },

  // =============================================
  // Statistics
  // =============================================

  /**
   * Get stats for line (today)
   */
  async getLineStats(lineId) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('inspection_results')
        .select('operator_action, auto_approved')
        .eq('line_id', lineId)
        .gte('inspected_at', today.toISOString());

      if (error) throw error;

      const stats = {
        total: data.length,
        approved: data.filter(r => r.operator_action === 'approve').length,
        rejected: data.filter(r => r.operator_action === 'reject').length,
        falseCalls: data.filter(r => r.operator_action === 'false_call').length,
        autoApproved: data.filter(r => r.auto_approved).length,
      };
      
      stats.yieldRate = stats.total > 0 
        ? ((stats.approved + stats.autoApproved) / stats.total * 100).toFixed(1)
        : 0;

      return { success: true, data: stats };
    } catch (error) {
      console.error('getLineStats error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get operator performance stats
   */
  async getOperatorStats(operatorId, days = 7) {
    try {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - days);

      const { data, error } = await supabase
        .from('inspection_results')
        .select('operator_action, decision_time_ms, auto_approved, inspected_at')
        .eq('operator_id', operatorId)
        .gte('inspected_at', fromDate.toISOString());

      if (error) throw error;

      const avgDecisionTime = data.length > 0
        ? Math.round(data.reduce((sum, r) => sum + (r.decision_time_ms || 0), 0) / data.length)
        : 0;

      return {
        success: true,
        data: {
          totalInspected: data.length,
          avgDecisionTimeMs: avgDecisionTime,
          autoApproveRate: data.length > 0 
            ? (data.filter(r => r.auto_approved).length / data.length * 100).toFixed(1)
            : 0,
        },
      };
    } catch (error) {
      console.error('getOperatorStats error:', error);
      return { success: false, error: error.message };
    }
  },
};

export default inspectionRepo;
```

---

### Task 2: Create API Routes

#### 2.1 `app/api/inspection/session/route.js`

```javascript
/**
 * Inspection Session API
 * POST: Start new session
 * GET: Get active session
 */

import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/apiAuth';
import { validate } from '@/lib/validations/validate';
import { sanitizeRequestBody } from '@/lib/utils/sanitize';
import { inspectionRepo } from '@/lib/repos/inspectionRepo';
import { z } from 'zod';

const startSessionSchema = z.object({
  lineId: z.string().uuid(),
  boardId: z.string().uuid().optional(),
});

async function handlePOST(request) {
  const body = sanitizeRequestBody(await request.json());
  const validation = validate(startSessionSchema, body);
  
  if (!validation.success) {
    return NextResponse.json({ success: false, errors: validation.errors }, { status: 400 });
  }

  const operatorId = request.user.id;
  
  // Check for existing active session
  const existing = await inspectionRepo.getActiveSession(operatorId);
  if (existing.data) {
    // End previous session first
    await inspectionRepo.endSession(existing.data.id);
  }

  const result = await inspectionRepo.startSession({
    operatorId,
    lineId: validation.data.lineId,
    boardId: validation.data.boardId,
  });

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: result.data }, { status: 201 });
}

async function handleGET(request) {
  const operatorId = request.user.id;
  
  const result = await inspectionRepo.getActiveSession(operatorId);
  
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: result.data });
}

export const POST = withAuth('inspection:create')(handlePOST);
export const GET = withAuth('inspection:read')(handleGET);
```

#### 2.2 `app/api/inspection/session/[id]/route.js`

```javascript
/**
 * Inspection Session by ID
 * PUT: Update session (pause/resume/end)
 * GET: Get session details
 */

import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/apiAuth';
import { validate } from '@/lib/validations/validate';
import { sanitizeRequestBody } from '@/lib/utils/sanitize';
import { inspectionRepo } from '@/lib/repos/inspectionRepo';
import { z } from 'zod';

const updateSessionSchema = z.object({
  status: z.enum(['active', 'paused', 'completed', 'abandoned']),
  pauseTimeMs: z.number().optional(),
});

async function handlePUT(request, { params }) {
  const { id } = params;
  const body = sanitizeRequestBody(await request.json());
  const validation = validate(updateSessionSchema, body);
  
  if (!validation.success) {
    return NextResponse.json({ success: false, errors: validation.errors }, { status: 400 });
  }

  const result = validation.data.status === 'completed'
    ? await inspectionRepo.endSession(id)
    : await inspectionRepo.updateSessionStatus(id, validation.data.status, validation.data.pauseTimeMs);

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: result.data });
}

export const PUT = withAuth('inspection:update')(handlePUT);
```

#### 2.3 `app/api/inspection/action/route.js`

```javascript
/**
 * Inspection Action API
 * POST: Record operator decision (approve/reject/false_call/auto_approve)
 */

import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/apiAuth';
import { validate } from '@/lib/validations/validate';
import { sanitizeRequestBody } from '@/lib/utils/sanitize';
import { inspectionRepo } from '@/lib/repos/inspectionRepo';
import { z } from 'zod';

const actionSchema = z.object({
  sessionId: z.string().uuid(),
  boardId: z.string().uuid(),
  lineId: z.string().uuid(),
  sectionId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  
  // Frame data
  frameId: z.string().uuid().optional(),
  imageUrl: z.string().url().optional(),
  
  // AI detection
  aiResult: z.enum(['pass', 'fail', 'review']).optional(),
  aiConfidence: z.number().min(0).max(1).optional(),
  aiDefectType: z.string().optional(),
  aiDetections: z.array(z.any()).optional(),
  
  // Operator action
  action: z.enum(['approve', 'reject', 'false_call', 'auto_approve']),
  notes: z.string().optional(),
  
  // Timing
  decisionTimeMs: z.number().optional(),
});

async function handlePOST(request) {
  const body = sanitizeRequestBody(await request.json());
  const validation = validate(actionSchema, body);
  
  if (!validation.success) {
    return NextResponse.json({ success: false, errors: validation.errors }, { status: 400 });
  }

  const data = validation.data;
  const operatorId = request.user.id;

  const result = await inspectionRepo.recordResult({
    sessionId: data.sessionId,
    boardId: data.boardId,
    lineId: data.lineId,
    sectionId: data.sectionId,
    customerId: data.customerId,
    frameId: data.frameId,
    imageUrl: data.imageUrl,
    aiResult: data.aiResult,
    aiConfidence: data.aiConfidence,
    aiDefectType: data.aiDefectType,
    aiDetections: data.aiDetections,
    operatorAction: data.action,
    operatorId,
    operatorNotes: data.notes,
    decisionTimeMs: data.decisionTimeMs,
    autoApproved: data.action === 'auto_approve',
  });

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: result.data }, { status: 201 });
}

export const POST = withAuth('inspection:create')(handlePOST);
```

#### 2.4 `app/api/inspection/stats/route.js`

```javascript
/**
 * Inspection Stats API
 * GET: Get statistics for line or operator
 */

import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/apiAuth';
import { inspectionRepo } from '@/lib/repos/inspectionRepo';

async function handleGET(request) {
  const { searchParams } = new URL(request.url);
  const lineId = searchParams.get('lineId');
  const operatorId = searchParams.get('operatorId');
  const days = parseInt(searchParams.get('days') || '7');

  let result;

  if (lineId) {
    result = await inspectionRepo.getLineStats(lineId);
  } else if (operatorId) {
    result = await inspectionRepo.getOperatorStats(operatorId, days);
  } else {
    // Default: current user stats
    result = await inspectionRepo.getOperatorStats(request.user.id, days);
  }

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: result.data });
}

export const GET = withAuth('inspection:read')(handleGET);
```

---

### Task 3: Add Zod Schema

#### 3.1 `lib/validations/inspectionSchema.js`

```javascript
/**
 * Inspection Validation Schemas
 */

import { z } from 'zod';

export const startSessionSchema = z.object({
  lineId: z.string().uuid('Invalid line ID'),
  boardId: z.string().uuid('Invalid board ID').optional(),
});

export const updateSessionSchema = z.object({
  status: z.enum(['active', 'paused', 'completed', 'abandoned'], {
    errorMap: () => ({ message: 'Invalid status' }),
  }),
  pauseTimeMs: z.number().min(0).optional(),
});

export const inspectionActionSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
  boardId: z.string().uuid('Invalid board ID'),
  lineId: z.string().uuid('Invalid line ID'),
  sectionId: z.string().uuid('Invalid section ID').optional(),
  customerId: z.string().uuid('Invalid customer ID').optional(),
  
  frameId: z.string().uuid('Invalid frame ID').optional(),
  imageUrl: z.string().url('Invalid image URL').optional(),
  
  aiResult: z.enum(['pass', 'fail', 'review']).optional(),
  aiConfidence: z.number().min(0).max(1).optional(),
  aiDefectType: z.string().max(100).optional(),
  aiDetections: z.array(z.any()).optional(),
  
  action: z.enum(['approve', 'reject', 'false_call', 'auto_approve'], {
    errorMap: () => ({ message: 'Invalid action type' }),
  }),
  notes: z.string().max(500).optional(),
  
  decisionTimeMs: z.number().min(0).optional(),
});
```

---

### Task 4: Add Permissions

#### 4.1 Update `data/masterData.js`

```javascript
// Add to menuItems array
{
  id: 'menu_inspection_operator',
  label: 'Operator Inspection',
  icon: 'Monitor',
  path: '/inspection/operator',
  parent: null,
},

// Add permissions
export const defaultPermissions = {
  // ... existing permissions
  'inspection:read': ['operator', 'manager', 'engineer', 'superadmin'],
  'inspection:create': ['operator', 'manager', 'engineer', 'superadmin'],
  'inspection:update': ['operator', 'manager', 'engineer', 'superadmin'],
};
```

---

## Verification Checklist

### Database
- [ ] `inspection_results` table created
- [ ] `inspection_sessions` table created
- [ ] Indexes created
- [ ] Trigger function works

### API Routes
- [ ] `POST /api/inspection/session` — start session
- [ ] `GET /api/inspection/session` — get active session
- [ ] `PUT /api/inspection/session/[id]` — update session
- [ ] `POST /api/inspection/action` — record decision
- [ ] `GET /api/inspection/stats` — get statistics

### Integration
- [ ] withAuth wrapper on all routes
- [ ] Zod validation on all inputs
- [ ] Error handling returns proper status codes
- [ ] Permissions added to role config

---

## API Usage Examples

### Start Session
```javascript
const response = await fetch('/api/inspection/session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    lineId: 'uuid-line-id',
    boardId: 'uuid-board-id',
  }),
});
const { data: session } = await response.json();
```

### Record Action
```javascript
await fetch('/api/inspection/action', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: session.id,
    boardId: 'uuid-board-id',
    lineId: 'uuid-line-id',
    action: 'approve', // or 'reject', 'false_call', 'auto_approve'
    aiResult: 'fail',
    aiConfidence: 0.92,
    aiDefectType: 'SOLDER_BRIDGE',
    decisionTimeMs: 3500,
  }),
});
```

### Get Stats
```javascript
const response = await fetch('/api/inspection/stats?lineId=uuid-line-id');
const { data: stats } = await response.json();
// stats = { total, approved, rejected, falseCalls, autoApproved, yieldRate }
```

---

## Notes

- Session auto-ends previous active session when starting new one
- Auto-approve tracked separately untuk analytics
- Decision time recorded untuk operator performance metrics
- False calls linked to overrides table untuk training pipeline
- Stats aggregated daily, dapat di-extend untuk shift-based
