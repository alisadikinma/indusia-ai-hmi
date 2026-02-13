/**
 * Test Fixtures for INDUSIA AI HMI
 * Centralized test data for use across all test files
 */

// ============================================
// User Fixtures
// ============================================

export const users = {
  operator: {
    id: 'user-operator-1',
    name: 'John Operator',
    email: 'operator@indusia.ai',
    role_id: 'operator',
    sections: ['section-a', 'section-b'],
    status: 'active',
    created_at: '2024-01-15T08:00:00Z'
  },

  manager: {
    id: 'user-manager-1',
    name: 'Jane Manager',
    email: 'manager@indusia.ai',
    role_id: 'manager',
    sections: ['section-a', 'section-b', 'section-c'],
    status: 'active',
    created_at: '2024-01-10T08:00:00Z'
  },

  engineer: {
    id: 'user-engineer-1',
    name: 'Bob Engineer',
    email: 'engineer@indusia.ai',
    role_id: 'engineer',
    sections: [],
    status: 'active',
    created_at: '2024-01-05T08:00:00Z'
  },

  superadmin: {
    id: 'user-admin-1',
    name: 'Alice Admin',
    email: 'admin@indusia.ai',
    role_id: 'superadmin',
    sections: [],
    status: 'active',
    created_at: '2024-01-01T08:00:00Z'
  },

  inactive: {
    id: 'user-inactive-1',
    name: 'Inactive User',
    email: 'inactive@indusia.ai',
    role_id: 'operator',
    sections: ['section-a'],
    status: 'inactive',
    created_at: '2024-01-20T08:00:00Z'
  }
}

// ============================================
// Role Fixtures
// ============================================

export const roles = {
  operator: {
    id: 'operator',
    name: 'Operator',
    description: 'Production line operator'
  },
  manager: {
    id: 'manager',
    name: 'Manager',
    description: 'Production manager with override review access'
  },
  engineer: {
    id: 'engineer',
    name: 'Engineer',
    description: 'Engineering staff with model management access'
  },
  superadmin: {
    id: 'superadmin',
    name: 'Super Admin',
    description: 'Full system access'
  }
}

// ============================================
// Master Data Fixtures
// ============================================

export const customers = [
  { id: 'customer-1', name: 'ACME Electronics', code: 'ACME', status: 'active' },
  { id: 'customer-2', name: 'TechCorp Industries', code: 'TECH', status: 'active' },
  { id: 'customer-3', name: 'GlobalPCB Inc', code: 'GPCB', status: 'inactive' }
]

export const sections = [
  { id: 'section-a', name: 'Section A', customer_id: 'customer-1', status: 'active' },
  { id: 'section-b', name: 'Section B', customer_id: 'customer-1', status: 'active' },
  { id: 'section-c', name: 'Section C', customer_id: 'customer-2', status: 'active' },
  { id: 'section-d', name: 'Section D', customer_id: 'customer-2', status: 'inactive' }
]

export const lines = [
  { id: 'line-1', name: 'Line 1', section_id: 'section-a', status: 'active' },
  { id: 'line-2', name: 'Line 2', section_id: 'section-a', status: 'active' },
  { id: 'line-3', name: 'Line 3', section_id: 'section-b', status: 'active' },
  { id: 'line-4', name: 'Line 4', section_id: 'section-c', status: 'inactive' }
]

export const boards = [
  {
    id: 'board-1',
    name: 'Main Controller Board',
    code: 'MCB-001',
    line_id: 'line-1',
    section_id: 'section-a',
    customer_id: 'customer-1',
    status: 'active'
  },
  {
    id: 'board-2',
    name: 'Power Supply Board',
    code: 'PSB-001',
    line_id: 'line-2',
    section_id: 'section-a',
    customer_id: 'customer-1',
    status: 'active'
  },
  {
    id: 'board-3',
    name: 'Communication Board',
    code: 'CMB-001',
    line_id: 'line-3',
    section_id: 'section-b',
    customer_id: 'customer-1',
    status: 'active'
  }
]

// ============================================
// Override Fixtures
// ============================================

export const overrides = {
  pending: {
    id: 'override-1',
    board_id: 'board-1',
    defect_type: 'solder_bridge',
    location: 'U1-pin3',
    confidence: 85,
    reason: 'Component shadow causing false detection',
    operator_notes: 'Verified visually - no actual defect',
    operator_id: 'user-operator-1',
    operator_name: 'John Operator',
    section_id: 'section-a',
    customer_id: 'customer-1',
    status: 'pending',
    created_at: '2024-03-15T10:30:00Z',
    image_url: 'https://storage.example.com/override-1.jpg'
  },

  approved: {
    id: 'override-2',
    board_id: 'board-2',
    defect_type: 'missing_component',
    location: 'R15',
    confidence: 92,
    reason: 'Component is present but orientation confused AI',
    operator_notes: 'Standard placement variation',
    operator_id: 'user-operator-1',
    operator_name: 'John Operator',
    section_id: 'section-a',
    customer_id: 'customer-1',
    status: 'approved',
    created_at: '2024-03-14T09:00:00Z',
    reviewed_at: '2024-03-14T11:30:00Z',
    reviewer_id: 'user-manager-1',
    reviewer_name: 'Jane Manager',
    reviewer_notes: 'Confirmed with engineering spec'
  },

  rejected: {
    id: 'override-3',
    board_id: 'board-1',
    defect_type: 'tombstone',
    location: 'C22',
    confidence: 78,
    reason: 'Lighting reflection',
    operator_id: 'user-operator-1',
    operator_name: 'John Operator',
    section_id: 'section-a',
    customer_id: 'customer-1',
    status: 'rejected',
    created_at: '2024-03-13T14:00:00Z',
    reviewed_at: '2024-03-13T16:00:00Z',
    reviewer_id: 'user-manager-1',
    reviewer_name: 'Jane Manager',
    reviewer_notes: 'Actual defect confirmed - board returned for rework'
  }
}

// ============================================
// Notification Fixtures
// ============================================

export const notifications = [
  {
    id: 'notif-1',
    type: 'WORKFLOW',
    category: 'override',
    title: 'Override Submitted',
    message: 'New false call override submitted for review',
    severity: 'INFO',
    read: false,
    user_id: 'user-manager-1',
    section_id: 'section-a',
    created_at: '2024-03-15T10:31:00Z'
  },
  {
    id: 'notif-2',
    type: 'SYSTEM',
    category: 'sync',
    title: 'Sync Complete',
    message: 'Data synchronization completed successfully',
    severity: 'INFO',
    read: true,
    created_at: '2024-03-15T06:00:00Z'
  },
  {
    id: 'notif-3',
    type: 'SYSTEM',
    category: 'model',
    title: 'Model Training Failed',
    message: 'Training job xyz-123 failed due to insufficient data',
    severity: 'CRITICAL',
    read: false,
    user_id: 'user-engineer-1',
    created_at: '2024-03-14T23:00:00Z'
  },
  {
    id: 'notif-4',
    type: 'WORKFLOW',
    category: 'override',
    title: 'Override Approved',
    message: 'Your override submission has been approved',
    severity: 'INFO',
    read: false,
    user_id: 'user-operator-1',
    section_id: 'section-a',
    created_at: '2024-03-14T11:31:00Z'
  }
]

// ============================================
// Event Log Fixtures
// ============================================

export const events = [
  {
    id: 'event-1',
    type: 'login',
    source: 'auth',
    user_id: 'user-operator-1',
    user_name: 'John Operator',
    role_id: 'operator',
    details: { ip: '192.168.1.100', device: 'HMI-Station-1' },
    created_at: '2024-03-15T08:00:00Z'
  },
  {
    id: 'event-2',
    type: 'override_submit',
    source: 'inspection',
    user_id: 'user-operator-1',
    user_name: 'John Operator',
    role_id: 'operator',
    section_id: 'section-a',
    details: { override_id: 'override-1', board_id: 'board-1' },
    created_at: '2024-03-15T10:30:00Z'
  },
  {
    id: 'event-3',
    type: 'override_review',
    source: 'inspection',
    user_id: 'user-manager-1',
    user_name: 'Jane Manager',
    role_id: 'manager',
    section_id: 'section-a',
    details: { override_id: 'override-2', action: 'approved' },
    created_at: '2024-03-14T11:30:00Z'
  }
]

// ============================================
// Model Fixtures
// ============================================

export const models = [
  {
    id: 'model-1',
    name: 'Solder Bridge Detector v2.1',
    version: '2.1.0',
    description: 'Improved detection for solder bridge defects',
    status: 'deployed',
    accuracy: 94.5,
    customer_id: 'customer-1',
    section_id: 'section-a',
    board_id: 'board-1',
    model_path: '/models/solder-bridge-v2.1.onnx',
    created_at: '2024-03-01T00:00:00Z',
    deployed_at: '2024-03-10T00:00:00Z'
  },
  {
    id: 'model-2',
    name: 'Component Presence Checker v1.5',
    version: '1.5.0',
    description: 'Verifies component presence on PCB',
    status: 'training',
    accuracy: null,
    customer_id: 'customer-1',
    board_id: 'board-2',
    model_path: null,
    created_at: '2024-03-12T00:00:00Z'
  },
  {
    id: 'model-3',
    name: 'General Defect Detector v3.0',
    version: '3.0.0',
    description: 'Multi-class defect detection model',
    status: 'ready',
    accuracy: 91.2,
    model_path: '/models/general-defect-v3.0.onnx',
    created_at: '2024-02-20T00:00:00Z'
  }
]

// ============================================
// Form Input Fixtures (for validation tests)
// ============================================

export const validInputs = {
  createUser: {
    name: 'New User',
    email: 'newuser@example.com',
    role_id: 'operator',
    sections: ['section-a'],
    password: 'securePass123',
    status: 'active'
  },

  createOverride: {
    board_id: 'board-1',
    defect_type: 'solder_bridge',
    reason: 'False positive due to lighting',
    operator_id: 'user-operator-1',
    operator_name: 'John Operator',
    section_id: 'section-a',
    customer_id: 'customer-1'
  },

  reviewOverride: {
    action: 'approve',
    reviewer_id: 'user-manager-1',
    reviewer_name: 'Jane Manager',
    reviewer_notes: 'Verified with engineering'
  },

  login: {
    email: 'operator@indusia.ai',
    password: 'password123'
  },

  changePassword: {
    current_password: 'oldPassword',
    new_password: 'newPassword123',
    confirm_password: 'newPassword123'
  }
}

export const invalidInputs = {
  createUser: {
    shortName: { name: 'A', email: 'test@example.com', role_id: 'operator' },
    invalidEmail: { name: 'Test User', email: 'not-an-email', role_id: 'operator' },
    missingRole: { name: 'Test User', email: 'test@example.com' },
    shortPassword: { name: 'Test', email: 'test@example.com', role_id: 'operator', password: '123' }
  },

  createOverride: {
    missingBoard: { defect_type: 'solder', reason: 'test', operator_id: '1', operator_name: 'Test', section_id: 's1', customer_id: 'c1' },
    missingReason: { board_id: 'b1', defect_type: 'solder', operator_id: '1', operator_name: 'Test', section_id: 's1', customer_id: 'c1' }
  },

  login: {
    invalidEmail: { email: 'not-email', password: 'pass123' },
    emptyPassword: { email: 'user@example.com', password: '' }
  }
}

// ============================================
// API Response Fixtures
// ============================================

export const apiResponses = {
  success: {
    getUsers: {
      success: true,
      data: Object.values(users).slice(0, 3),
      total: 3
    },
    getOverrides: {
      success: true,
      data: Object.values(overrides),
      total: 3,
      page: 1,
      limit: 20
    },
    createOverride: {
      success: true,
      data: overrides.pending
    }
  },

  error: {
    unauthorized: {
      success: false,
      error: 'Unauthorized',
      code: 'UNAUTHORIZED'
    },
    forbidden: {
      success: false,
      error: 'Forbidden',
      code: 'FORBIDDEN'
    },
    notFound: {
      success: false,
      error: 'Resource not found'
    },
    validationError: {
      success: false,
      error: 'Validation failed',
      errors: [
        { field: 'email', message: 'Invalid email address' }
      ]
    },
    serverError: {
      success: false,
      error: 'Internal server error'
    }
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Create a mock request object
 */
export function createMockRequest(options = {}) {
  const {
    method = 'GET',
    url = 'http://localhost:3000/api/test',
    body = null,
    headers = {},
    user = null
  } = options

  return {
    method,
    url,
    json: jest.fn().mockResolvedValue(body),
    headers: {
      get: (name) => headers[name.toLowerCase()] || null
    },
    user,
    nextUrl: new URL(url)
  }
}

/**
 * Create a mock Supabase query builder
 */
export function createMockSupabaseQuery(data = [], error = null) {
  const mock = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: data[0] || null, error }),
    maybeSingle: jest.fn().mockResolvedValue({ data: data[0] || null, error }),
    then: jest.fn((cb) => cb({ data, error }))
  }

  return mock
}

/**
 * Wait for async updates in tests
 */
export function waitForAsync(ms = 0) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Create a test wrapper for context providers
 */
export function createTestWrapper(providers = []) {
  return ({ children }) => {
    return providers.reduce(
      (acc, Provider) => <Provider>{acc}</Provider>,
      children
    )
  }
}
