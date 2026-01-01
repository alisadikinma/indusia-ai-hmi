# FASE 11: Testing

## Role
You are a senior QA engineer implementing comprehensive testing for INDUSIA AI HMI - ensuring reliability and preventing regressions in production environment.

## Context
INDUSIA AI HMI is a production-floor system with:
- Next.js 14+ (App Router, JavaScript only)
- Supabase backend
- Critical manufacturing operations - bugs can cause production issues
- Multiple user roles and workflows

Working directory: `C:\xampp\htdocs\indusia-ai-hmi`

## Objective
Implement unit tests, integration tests, and E2E tests for critical functionality.

---

## Tasks

### 11.1 Install Testing Dependencies
```bash
npm install -D jest @testing-library/react @testing-library/jest-dom jest-environment-jsdom
npm install -D @playwright/test
npm install -D msw
npx playwright install
```

### 11.2 Jest Configuration
Create `jest.config.js`:
```js
const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testPathIgnorePatterns: ['<rootDir>/e2e/'],
  collectCoverageFrom: [
    'lib/**/*.js',
    'hooks/**/*.js',
    'components/**/*.jsx',
    '!**/*.test.js',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
}

module.exports = createJestConfig(customJestConfig)
```

Create `jest.setup.js`:
```js
import '@testing-library/jest-dom'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

// Mock Supabase client
jest.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn(),
    })),
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(),
        getPublicUrl: jest.fn(),
        createSignedUrl: jest.fn(),
      })),
    },
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
    })),
    removeChannel: jest.fn(),
  },
}))
```

### 11.3 Add Test Scripts
Update `package.json`:
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

---

### 11.4 Unit Tests - Validation Schemas
Create `lib/validations/__tests__/schemas.test.js`:
```js
import {
  createUserSchema,
  updateUserSchema,
  createOverrideSchema,
  reviewOverrideSchema,
  loginSchema,
  changePasswordSchema,
  deployModelSchema
} from '../schemas'

describe('Validation Schemas', () => {
  
  describe('createUserSchema', () => {
    const validUser = {
      name: 'John Doe',
      email: 'john@example.com',
      role_id: 'operator',
      sections: ['section-a']
    }
    
    it('should validate valid user data', () => {
      expect(() => createUserSchema.parse(validUser)).not.toThrow()
    })
    
    it('should reject invalid email', () => {
      const invalid = { ...validUser, email: 'invalid-email' }
      expect(() => createUserSchema.parse(invalid)).toThrow()
    })
    
    it('should reject empty name', () => {
      const invalid = { ...validUser, name: '' }
      expect(() => createUserSchema.parse(invalid)).toThrow()
    })
    
    it('should reject name too short', () => {
      const invalid = { ...validUser, name: 'A' }
      expect(() => createUserSchema.parse(invalid)).toThrow()
    })
    
    it('should accept optional whatsapp', () => {
      const withWhatsapp = { ...validUser, whatsapp: '+628123456789' }
      expect(() => createUserSchema.parse(withWhatsapp)).not.toThrow()
    })
    
    it('should default sections to empty array', () => {
      const noSections = { name: 'John', email: 'john@test.com', role_id: 'op' }
      const result = createUserSchema.parse(noSections)
      expect(result.sections).toEqual([])
    })
  })
  
  describe('createOverrideSchema', () => {
    const validOverride = {
      board_id: 'board-001',
      defect_type: 'solder_bridge',
      reason: 'False detection by AI',
      operator_id: 'user-001',
      operator_name: 'John',
      section_id: 'section-a',
      customer_id: 'cust-001'
    }
    
    it('should validate valid override data', () => {
      expect(() => createOverrideSchema.parse(validOverride)).not.toThrow()
    })
    
    it('should reject missing board_id', () => {
      const { board_id, ...invalid } = validOverride
      expect(() => createOverrideSchema.parse(invalid)).toThrow()
    })
    
    it('should reject missing reason', () => {
      const { reason, ...invalid } = validOverride
      expect(() => createOverrideSchema.parse(invalid)).toThrow()
    })
    
    it('should accept optional confidence', () => {
      const withConfidence = { ...validOverride, confidence: 85.5 }
      expect(() => createOverrideSchema.parse(withConfidence)).not.toThrow()
    })
    
    it('should reject confidence > 100', () => {
      const invalid = { ...validOverride, confidence: 150 }
      expect(() => createOverrideSchema.parse(invalid)).toThrow()
    })
    
    it('should reject confidence < 0', () => {
      const invalid = { ...validOverride, confidence: -10 }
      expect(() => createOverrideSchema.parse(invalid)).toThrow()
    })
  })
  
  describe('reviewOverrideSchema', () => {
    it('should validate approve action', () => {
      const valid = {
        action: 'approve',
        reviewer_id: 'mgr-001',
        reviewer_name: 'Manager'
      }
      expect(() => reviewOverrideSchema.parse(valid)).not.toThrow()
    })
    
    it('should validate reject action', () => {
      const valid = {
        action: 'reject',
        reviewer_id: 'mgr-001',
        reviewer_name: 'Manager',
        reviewer_notes: 'Not a valid false call'
      }
      expect(() => reviewOverrideSchema.parse(valid)).not.toThrow()
    })
    
    it('should reject invalid action', () => {
      const invalid = {
        action: 'pending',
        reviewer_id: 'mgr-001',
        reviewer_name: 'Manager'
      }
      expect(() => reviewOverrideSchema.parse(invalid)).toThrow()
    })
  })
  
  describe('loginSchema', () => {
    it('should validate valid login', () => {
      const valid = { email: 'user@test.com', password: 'password123' }
      expect(() => loginSchema.parse(valid)).not.toThrow()
    })
    
    it('should reject invalid email', () => {
      const invalid = { email: 'notanemail', password: 'password' }
      expect(() => loginSchema.parse(invalid)).toThrow()
    })
    
    it('should reject empty password', () => {
      const invalid = { email: 'user@test.com', password: '' }
      expect(() => loginSchema.parse(invalid)).toThrow()
    })
  })
  
  describe('changePasswordSchema', () => {
    it('should validate matching passwords', () => {
      const valid = {
        current_password: 'oldpass',
        new_password: 'newpass123',
        confirm_password: 'newpass123'
      }
      expect(() => changePasswordSchema.parse(valid)).not.toThrow()
    })
    
    it('should reject mismatched passwords', () => {
      const invalid = {
        current_password: 'oldpass',
        new_password: 'newpass123',
        confirm_password: 'different'
      }
      expect(() => changePasswordSchema.parse(invalid)).toThrow()
    })
    
    it('should reject short new password', () => {
      const invalid = {
        current_password: 'oldpass',
        new_password: '123',
        confirm_password: '123'
      }
      expect(() => changePasswordSchema.parse(invalid)).toThrow()
    })
  })
  
  describe('deployModelSchema', () => {
    it('should validate valid deploy request', () => {
      const valid = { user_id: 'eng-001' }
      expect(() => deployModelSchema.parse(valid)).not.toThrow()
    })
    
    it('should reject missing user_id', () => {
      expect(() => deployModelSchema.parse({})).toThrow()
    })
  })
})
```

---

### 11.5 Unit Tests - RBAC
Create `lib/auth/__tests__/rbac.test.js`:
```js
import { hasPermission, PERMISSIONS } from '../rbac'

describe('RBAC', () => {
  
  describe('PERMISSIONS constant', () => {
    it('should have all required permission keys', () => {
      const requiredKeys = [
        'users:read', 'users:create', 'users:update', 'users:delete',
        'roles:read', 'roles:create', 'roles:update', 'roles:delete',
        'overrides:read', 'overrides:create', 'overrides:review',
        'models:read', 'models:deploy',
        'system:read', 'admin:access'
      ]
      
      requiredKeys.forEach(key => {
        expect(PERMISSIONS).toHaveProperty(key)
      })
    })
  })
  
  describe('hasPermission', () => {
    // Superadmin tests
    describe('superadmin role', () => {
      it('should have admin access', () => {
        expect(hasPermission('superadmin', 'admin:access')).toBe(true)
      })
      
      it('should manage users', () => {
        expect(hasPermission('superadmin', 'users:create')).toBe(true)
        expect(hasPermission('superadmin', 'users:delete')).toBe(true)
      })
      
      it('should review overrides', () => {
        expect(hasPermission('superadmin', 'overrides:review')).toBe(true)
      })
    })
    
    // Manager tests
    describe('manager role', () => {
      it('should read users', () => {
        expect(hasPermission('manager', 'users:read')).toBe(true)
      })
      
      it('should NOT create users', () => {
        expect(hasPermission('manager', 'users:create')).toBe(false)
      })
      
      it('should review overrides', () => {
        expect(hasPermission('manager', 'overrides:review')).toBe(true)
      })
      
      it('should NOT have admin access', () => {
        expect(hasPermission('manager', 'admin:access')).toBe(false)
      })
      
      it('should read system health', () => {
        expect(hasPermission('manager', 'system:read')).toBe(true)
      })
    })
    
    // Operator tests
    describe('operator role', () => {
      it('should create overrides', () => {
        expect(hasPermission('operator', 'overrides:create')).toBe(true)
      })
      
      it('should read overrides', () => {
        expect(hasPermission('operator', 'overrides:read')).toBe(true)
      })
      
      it('should NOT review overrides', () => {
        expect(hasPermission('operator', 'overrides:review')).toBe(false)
      })
      
      it('should NOT manage users', () => {
        expect(hasPermission('operator', 'users:read')).toBe(false)
        expect(hasPermission('operator', 'users:create')).toBe(false)
      })
      
      it('should NOT have admin access', () => {
        expect(hasPermission('operator', 'admin:access')).toBe(false)
      })
    })
    
    // Engineer tests
    describe('engineer role', () => {
      it('should read models', () => {
        expect(hasPermission('engineer', 'models:read')).toBe(true)
      })
      
      it('should deploy models', () => {
        expect(hasPermission('engineer', 'models:deploy')).toBe(true)
      })
      
      it('should read system health', () => {
        expect(hasPermission('engineer', 'system:read')).toBe(true)
      })
      
      it('should NOT review overrides', () => {
        expect(hasPermission('engineer', 'overrides:review')).toBe(false)
      })
    })
    
    // Edge cases
    describe('edge cases', () => {
      it('should return false for unknown permission', () => {
        expect(hasPermission('superadmin', 'unknown:permission')).toBe(false)
      })
      
      it('should return false for unknown role', () => {
        expect(hasPermission('unknown_role', 'users:read')).toBe(false)
      })
      
      it('should return false for null role', () => {
        expect(hasPermission(null, 'users:read')).toBe(false)
      })
      
      it('should return false for undefined permission', () => {
        expect(hasPermission('superadmin', undefined)).toBe(false)
      })
    })
  })
})
```

---

### 11.6 Unit Tests - Section Access
Create `lib/auth/__tests__/sectionAccess.test.js`:
```js
import { canAccessSection, filterBySection } from '../sectionAccess'

describe('Section Access Control', () => {
  
  describe('canAccessSection', () => {
    it('should allow superadmin to access any section', () => {
      const user = { role_id: 'superadmin', sections: [] }
      expect(canAccessSection(user, 'section-a')).toBe(true)
      expect(canAccessSection(user, 'section-z')).toBe(true)
    })
    
    it('should allow user to access assigned section', () => {
      const user = { role_id: 'operator', sections: ['section-a', 'section-b'] }
      expect(canAccessSection(user, 'section-a')).toBe(true)
      expect(canAccessSection(user, 'section-b')).toBe(true)
    })
    
    it('should deny user access to unassigned section', () => {
      const user = { role_id: 'operator', sections: ['section-a'] }
      expect(canAccessSection(user, 'section-b')).toBe(false)
    })
    
    it('should handle empty sections array', () => {
      const user = { role_id: 'operator', sections: [] }
      expect(canAccessSection(user, 'section-a')).toBe(false)
    })
    
    it('should handle undefined sections', () => {
      const user = { role_id: 'operator' }
      expect(canAccessSection(user, 'section-a')).toBe(false)
    })
  })
  
  describe('filterBySection', () => {
    const testData = [
      { id: 1, section_id: 'section-a' },
      { id: 2, section_id: 'section-b' },
      { id: 3, section_id: 'section-a' },
      { id: 4, section_id: 'section-c' },
    ]
    
    it('should return all data for superadmin', () => {
      const user = { role_id: 'superadmin', sections: [] }
      const result = filterBySection(user, testData)
      expect(result).toHaveLength(4)
    })
    
    it('should filter data by user sections', () => {
      const user = { role_id: 'operator', sections: ['section-a'] }
      const result = filterBySection(user, testData)
      expect(result).toHaveLength(2)
      expect(result.every(item => item.section_id === 'section-a')).toBe(true)
    })
    
    it('should handle multiple sections', () => {
      const user = { role_id: 'manager', sections: ['section-a', 'section-b'] }
      const result = filterBySection(user, testData)
      expect(result).toHaveLength(3)
    })
    
    it('should return empty array if no matching sections', () => {
      const user = { role_id: 'operator', sections: ['section-z'] }
      const result = filterBySection(user, testData)
      expect(result).toHaveLength(0)
    })
    
    it('should use custom section field', () => {
      const customData = [
        { id: 1, area: 'section-a' },
        { id: 2, area: 'section-b' },
      ]
      const user = { role_id: 'operator', sections: ['section-a'] }
      const result = filterBySection(user, customData, 'area')
      expect(result).toHaveLength(1)
    })
  })
})
```

---

### 11.7 Unit Tests - Repository Layer
Create `lib/repos/__tests__/usersRepo.test.js`:
```js
import * as usersRepo from '../usersRepo'
import { supabase } from '@/lib/supabaseClient'

describe('usersRepo', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })
  
  const mockUsers = [
    { id: 'user-1', name: 'John', email: 'john@test.com', role_id: 'operator' },
    { id: 'user-2', name: 'Jane', email: 'jane@test.com', role_id: 'manager' }
  ]
  
  describe('list', () => {
    it('should return all users', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: mockUsers, error: null })
        })
      })
      
      const users = await usersRepo.list()
      
      expect(users).toEqual(mockUsers)
      expect(supabase.from).toHaveBeenCalledWith('users')
    })
    
    it('should throw on database error', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ 
            data: null, 
            error: new Error('Connection failed') 
          })
        })
      })
      
      await expect(usersRepo.list()).rejects.toThrow('Connection failed')
    })
  })
  
  describe('getById', () => {
    it('should return user by id', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ 
              data: mockUsers[0], 
              error: null 
            })
          })
        })
      })
      
      const user = await usersRepo.getById('user-1')
      
      expect(user).toEqual(mockUsers[0])
    })
    
    it('should return null for non-existent user', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ 
              data: null, 
              error: { code: 'PGRST116' } 
            })
          })
        })
      })
      
      const user = await usersRepo.getById('non-existent')
      
      expect(user).toBeNull()
    })
  })
  
  describe('create', () => {
    it('should create and return new user', async () => {
      const newUser = { name: 'New User', email: 'new@test.com', role_id: 'operator' }
      const createdUser = { id: 'user-3', ...newUser }
      
      supabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ 
              data: createdUser, 
              error: null 
            })
          })
        })
      })
      
      const result = await usersRepo.create(newUser)
      
      expect(result).toEqual(createdUser)
    })
    
    it('should throw on duplicate email', async () => {
      supabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ 
              data: null, 
              error: { code: '23505', message: 'Duplicate key' } 
            })
          })
        })
      })
      
      await expect(usersRepo.create({ email: 'exists@test.com' }))
        .rejects.toThrow()
    })
  })
  
  describe('update', () => {
    it('should update and return user', async () => {
      const updates = { name: 'Updated Name' }
      const updatedUser = { ...mockUsers[0], ...updates }
      
      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ 
                data: updatedUser, 
                error: null 
              })
            })
          })
        })
      })
      
      const result = await usersRepo.update('user-1', updates)
      
      expect(result.name).toBe('Updated Name')
    })
  })
  
  describe('delete', () => {
    it('should delete user and return true', async () => {
      supabase.from.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        })
      })
      
      const result = await usersRepo.delete('user-1')
      
      expect(result).toBe(true)
    })
  })
})
```

---

### 11.8 Unit Tests - Models Repository
Create `lib/repos/__tests__/modelsRepo.test.js`:
```js
import * as modelsRepo from '../modelsRepo'
import { supabase } from '@/lib/supabaseClient'

describe('modelsRepo', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })
  
  const mockModels = [
    { id: 'model-1', name: 'PCB Detector', version: '1.0.0', is_active: true, status: 'deployed' },
    { id: 'model-2', name: 'PCB Detector', version: '1.1.0', is_active: false, status: 'ready' }
  ]
  
  describe('listModels', () => {
    it('should return all models', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: mockModels, error: null })
        })
      })
      
      const models = await modelsRepo.listModels()
      
      expect(models).toEqual(mockModels)
    })
    
    it('should filter by status', async () => {
      const readyModels = mockModels.filter(m => m.status === 'ready')
      
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: readyModels, error: null })
          })
        })
      })
      
      const models = await modelsRepo.listModels({ status: 'ready' })
      
      expect(models).toHaveLength(1)
      expect(models[0].status).toBe('ready')
    })
  })
  
  describe('getActiveModel', () => {
    it('should return active model', async () => {
      const activeModel = mockModels[0]
      
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: activeModel, error: null })
          })
        })
      })
      
      const model = await modelsRepo.getActiveModel()
      
      expect(model.is_active).toBe(true)
    })
    
    it('should return null if no active model', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ 
              data: null, 
              error: { code: 'PGRST116' } 
            })
          })
        })
      })
      
      const model = await modelsRepo.getActiveModel()
      
      expect(model).toBeNull()
    })
  })
  
  describe('deployModel', () => {
    it('should deactivate other models and activate selected', async () => {
      // Mock deactivate all
      const deactivateMock = jest.fn().mockResolvedValue({ error: null })
      // Mock activate selected
      const activateMock = jest.fn().mockResolvedValue({ 
        data: { ...mockModels[1], is_active: true, status: 'deployed' }, 
        error: null 
      })
      
      supabase.from
        .mockReturnValueOnce({
          update: jest.fn().mockReturnValue({
            neq: deactivateMock
          })
        })
        .mockReturnValueOnce({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: activateMock
              })
            })
          })
        })
      
      const result = await modelsRepo.deployModel('model-2', 'user-eng')
      
      expect(result.is_active).toBe(true)
      expect(result.status).toBe('deployed')
    })
  })
  
  describe('getModelDownloadUrl', () => {
    it('should return signed URL', async () => {
      const signedUrl = 'https://storage.example.com/signed-url'
      
      supabase.storage.from.mockReturnValue({
        createSignedUrl: jest.fn().mockResolvedValue({ 
          data: { signedUrl }, 
          error: null 
        })
      })
      
      const url = await modelsRepo.getModelDownloadUrl('models/best.pt')
      
      expect(url).toBe(signedUrl)
    })
  })
})
```

---

### 11.9 Integration Tests - API Routes
Create `app/api/__tests__/users.test.js`:
```js
/**
 * @jest-environment node
 */
import { GET, POST } from '../users/route'

jest.mock('@/lib/repos/usersRepo', () => ({
  list: jest.fn(),
  create: jest.fn(),
}))

jest.mock('@/lib/auth/apiAuth', () => ({
  withAuth: (permission) => (handler) => handler,
  getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', role_id: 'superadmin' })
}))

import * as usersRepo from '@/lib/repos/usersRepo'

describe('Users API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })
  
  describe('GET /api/users', () => {
    it('should return users list with 200', async () => {
      const mockUsers = [{ id: '1', name: 'Test', email: 'test@test.com' }]
      usersRepo.list.mockResolvedValue(mockUsers)
      
      const request = new Request('http://localhost/api/users')
      const response = await GET(request)
      const json = await response.json()
      
      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data).toEqual(mockUsers)
    })
    
    it('should return 500 on error', async () => {
      usersRepo.list.mockRejectedValue(new Error('DB error'))
      
      const request = new Request('http://localhost/api/users')
      const response = await GET(request)
      const json = await response.json()
      
      expect(response.status).toBe(500)
      expect(json.success).toBe(false)
      expect(json.error).toBeDefined()
    })
  })
  
  describe('POST /api/users', () => {
    it('should create user with valid data', async () => {
      const newUser = { name: 'John Doe', email: 'john@test.com', role_id: 'operator' }
      const created = { id: 'new-1', ...newUser }
      usersRepo.create.mockResolvedValue(created)
      
      const request = new Request('http://localhost/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      })
      
      const response = await POST(request)
      const json = await response.json()
      
      expect(response.status).toBe(201)
      expect(json.success).toBe(true)
      expect(json.data.id).toBe('new-1')
    })
    
    it('should return 400 for invalid data', async () => {
      const invalidUser = { name: '', email: 'invalid' }
      
      const request = new Request('http://localhost/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidUser),
      })
      
      const response = await POST(request)
      const json = await response.json()
      
      expect(response.status).toBe(400)
      expect(json.success).toBe(false)
      expect(json.errors).toBeDefined()
    })
  })
})
```

Create `app/api/__tests__/overrides.test.js`:
```js
/**
 * @jest-environment node
 */
import { GET, POST } from '../overrides/route'

jest.mock('@/lib/repos/overridesRepo')
jest.mock('@/lib/auth/apiAuth', () => ({
  withAuth: (permission) => (handler) => handler,
}))

import * as overridesRepo from '@/lib/repos/overridesRepo'

describe('Overrides API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })
  
  describe('GET /api/overrides', () => {
    it('should return overrides list', async () => {
      const mockOverrides = [
        { id: 'ov-1', defect_type: 'solder_bridge', status: 'pending' }
      ]
      overridesRepo.list.mockResolvedValue(mockOverrides)
      
      const request = new Request('http://localhost/api/overrides')
      const response = await GET(request)
      const json = await response.json()
      
      expect(json.success).toBe(true)
      expect(json.data).toEqual(mockOverrides)
    })
    
    it('should filter by status', async () => {
      overridesRepo.list.mockResolvedValue([])
      
      const request = new Request('http://localhost/api/overrides?status=approved')
      await GET(request)
      
      expect(overridesRepo.list).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'approved' })
      )
    })
  })
  
  describe('POST /api/overrides', () => {
    it('should create override with valid data', async () => {
      const newOverride = {
        board_id: 'board-001',
        defect_type: 'solder_bridge',
        reason: 'False detection',
        operator_id: 'op-001',
        operator_name: 'Operator',
        section_id: 'section-a',
        customer_id: 'cust-001'
      }
      
      overridesRepo.create.mockResolvedValue({ 
        id: 'ov-new', 
        ...newOverride, 
        status: 'pending' 
      })
      
      const request = new Request('http://localhost/api/overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOverride),
      })
      
      const response = await POST(request)
      const json = await response.json()
      
      expect(response.status).toBe(201)
      expect(json.data.status).toBe('pending')
    })
  })
})
```

---

### 11.10 Component Tests
Create `components/__tests__/ErrorBoundary.test.jsx`:
```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorBoundary } from '../ErrorBoundary'

// Component that throws error
const ThrowError = ({ shouldThrow }) => {
  if (shouldThrow) throw new Error('Test error')
  return <div>Normal content</div>
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })
  
  afterEach(() => {
    console.error.mockRestore()
  })
  
  it('should render children when no error', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    )
    
    expect(screen.getByText('Normal content')).toBeInTheDocument()
  })
  
  it('should render error UI when error occurs', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )
    
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })
  
  it('should recover when Try Again is clicked', () => {
    const { rerender } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )
    
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    
    rerender(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    )
    
    expect(screen.getByText('Normal content')).toBeInTheDocument()
  })
})
```

Create `components/__tests__/OfflineBanner.test.jsx`:
```jsx
import { render, screen } from '@testing-library/react'
import { OfflineBanner } from '../OfflineBanner'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'

jest.mock('@/hooks/useNetworkStatus')

describe('OfflineBanner', () => {
  it('should not render when online', () => {
    useNetworkStatus.mockReturnValue({ isOnline: true })
    
    const { container } = render(<OfflineBanner />)
    
    expect(container).toBeEmptyDOMElement()
  })
  
  it('should render warning when offline', () => {
    useNetworkStatus.mockReturnValue({ isOnline: false })
    
    render(<OfflineBanner />)
    
    expect(screen.getByText(/offline/i)).toBeInTheDocument()
  })
})
```

---

### 11.11 Hook Tests
Create `hooks/__tests__/useNetworkStatus.test.js`:
```js
import { renderHook, act } from '@testing-library/react'
import { useNetworkStatus } from '../useNetworkStatus'

describe('useNetworkStatus', () => {
  it('should return online status initially', () => {
    const { result } = renderHook(() => useNetworkStatus())
    
    expect(result.current.isOnline).toBe(true)
  })
  
  it('should update when going offline', () => {
    const { result } = renderHook(() => useNetworkStatus())
    
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    
    expect(result.current.isOnline).toBe(false)
    expect(result.current.wasOffline).toBe(true)
  })
  
  it('should update when coming back online', () => {
    const { result } = renderHook(() => useNetworkStatus())
    
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    
    expect(result.current.isOnline).toBe(false)
    
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    
    expect(result.current.isOnline).toBe(true)
  })
  
  it('should dispatch network-restored event when coming back online', () => {
    const handler = jest.fn()
    window.addEventListener('network-restored', handler)
    
    const { result } = renderHook(() => useNetworkStatus())
    
    act(() => {
      window.dispatchEvent(new Event('offline'))
      window.dispatchEvent(new Event('online'))
    })
    
    expect(handler).toHaveBeenCalled()
    
    window.removeEventListener('network-restored', handler)
  })
})
```

Create `hooks/__tests__/useModels.test.js`:
```js
import { renderHook, waitFor, act } from '@testing-library/react'
import { useModels, useDeploymentHistory } from '../useModels'

global.fetch = jest.fn()

describe('useModels', () => {
  beforeEach(() => {
    fetch.mockClear()
  })
  
  const mockModels = [
    { id: 'model-1', name: 'Model A', is_active: true },
    { id: 'model-2', name: 'Model B', is_active: false }
  ]
  
  it('should fetch models on mount', async () => {
    fetch
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockModels })
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockModels[0] })
      })
    
    const { result } = renderHook(() => useModels())
    
    expect(result.current.loading).toBe(true)
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    
    expect(result.current.models).toEqual(mockModels)
    expect(result.current.activeModel).toEqual(mockModels[0])
  })
  
  it('should handle fetch error', async () => {
    fetch.mockRejectedValue(new Error('Network error'))
    
    const { result } = renderHook(() => useModels())
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    
    expect(result.current.error).toBe('Network error')
  })
  
  it('should deploy model', async () => {
    fetch
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockModels })
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockModels[0] })
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: { deployed: true } })
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockModels })
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockModels[1] })
      })
    
    const { result } = renderHook(() => useModels())
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    
    await act(async () => {
      await result.current.deployModel('model-2')
    })
    
    expect(fetch).toHaveBeenCalledWith(
      '/api/models/model-2/deploy',
      expect.objectContaining({ method: 'POST' })
    )
  })
})

describe('useDeploymentHistory', () => {
  it('should fetch deployment history', async () => {
    const mockHistory = [
      { id: 'model-1', deployed_at: '2024-01-01' }
    ]
    
    fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, data: mockHistory })
    })
    
    const { result } = renderHook(() => useDeploymentHistory())
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    
    expect(result.current.history).toEqual(mockHistory)
  })
})
```

---

### 11.12 E2E Tests - Playwright
Create `playwright.config.js`:
```js
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html'], ['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
})
```

Create `e2e/auth.spec.js`:
```js
import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('should show login page', async ({ page }) => {
    await page.goto('/login')
    
    await expect(page.getByRole('heading', { name: /login/i })).toBeVisible()
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /login|masuk/i })).toBeVisible()
  })
  
  test('should show validation error on empty submit', async ({ page }) => {
    await page.goto('/login')
    
    await page.getByRole('button', { name: /login|masuk/i }).click()
    
    // Should show some error
    await expect(page.getByText(/required|wajib|email/i)).toBeVisible()
  })
  
  test('should show error on invalid credentials', async ({ page }) => {
    await page.goto('/login')
    
    await page.getByLabel(/email/i).fill('invalid@test.com')
    await page.getByLabel(/password/i).fill('wrongpassword')
    await page.getByRole('button', { name: /login|masuk/i }).click()
    
    await expect(page.getByText(/invalid|salah|gagal/i)).toBeVisible()
  })
  
  test('should redirect to dashboard on successful login', async ({ page }) => {
    await page.goto('/login')
    
    await page.getByLabel(/email/i).fill('operator@test.com')
    await page.getByLabel(/password/i).fill('password123')
    await page.getByRole('button', { name: /login|masuk/i }).click()
    
    await expect(page).toHaveURL(/dashboard/)
  })
  
  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard')
    
    await expect(page).toHaveURL(/login/)
  })
})
```

Create `e2e/overrides.spec.js`:
```js
import { test, expect } from '@playwright/test'

test.describe('Override Workflow - Operator', () => {
  test.beforeEach(async ({ page }) => {
    // Login as operator
    await page.goto('/login')
    await page.getByLabel(/email/i).fill('operator@test.com')
    await page.getByLabel(/password/i).fill('password123')
    await page.getByRole('button', { name: /login|masuk/i }).click()
    await page.waitForURL(/dashboard/)
  })
  
  test('should navigate to inspection page', async ({ page }) => {
    await page.goto('/inspection')
    
    await expect(page).toHaveURL(/inspection/)
  })
  
  test('should open false call override modal', async ({ page }) => {
    await page.goto('/inspection')
    
    await page.getByRole('button', { name: /false call|override/i }).click()
    
    await expect(page.getByRole('dialog')).toBeVisible()
  })
  
  test('should submit false call override', async ({ page }) => {
    await page.goto('/inspection')
    
    await page.getByRole('button', { name: /false call|override/i }).click()
    
    // Fill form
    await page.getByLabel(/board/i).selectOption({ index: 1 })
    await page.getByLabel(/defect/i).selectOption({ index: 1 })
    await page.getByLabel(/reason|alasan/i).fill('AI false detection - component is correct')
    
    // Submit
    await page.getByRole('button', { name: /submit|kirim/i }).click()
    
    // Should show success
    await expect(page.getByText(/success|berhasil|submitted/i)).toBeVisible()
  })
})

test.describe('Override Review - Manager', () => {
  test.beforeEach(async ({ page }) => {
    // Login as manager
    await page.goto('/login')
    await page.getByLabel(/email/i).fill('manager@test.com')
    await page.getByLabel(/password/i).fill('password123')
    await page.getByRole('button', { name: /login|masuk/i }).click()
    await page.waitForURL(/dashboard/)
  })
  
  test('should view override queue', async ({ page }) => {
    await page.goto('/inspection/overrides')
    
    await expect(page.getByText(/pending|queue|antrian/i)).toBeVisible()
  })
  
  test('should approve override', async ({ page }) => {
    await page.goto('/inspection/overrides')
    
    // Click on first pending override
    const firstPending = page.locator('[data-status="pending"]').first()
    if (await firstPending.isVisible()) {
      await firstPending.click()
      
      await page.getByRole('button', { name: /approve|setuju/i }).click()
      
      await expect(page.getByText(/approved|disetujui/i)).toBeVisible()
    }
  })
  
  test('should reject override with notes', async ({ page }) => {
    await page.goto('/inspection/overrides')
    
    const firstPending = page.locator('[data-status="pending"]').first()
    if (await firstPending.isVisible()) {
      await firstPending.click()
      
      await page.getByLabel(/notes|catatan/i).fill('Not a valid false call')
      await page.getByRole('button', { name: /reject|tolak/i }).click()
      
      await expect(page.getByText(/rejected|ditolak/i)).toBeVisible()
    }
  })
})
```

Create `e2e/models.spec.js`:
```js
import { test, expect } from '@playwright/test'

test.describe('Model Management - Engineer', () => {
  test.beforeEach(async ({ page }) => {
    // Login as engineer
    await page.goto('/login')
    await page.getByLabel(/email/i).fill('engineer@test.com')
    await page.getByLabel(/password/i).fill('password123')
    await page.getByRole('button', { name: /login|masuk/i }).click()
    await page.waitForURL(/dashboard/)
  })
  
  test('should navigate to models page', async ({ page }) => {
    await page.goto('/engineering/models')
    
    await expect(page.getByRole('heading', { name: /model/i })).toBeVisible()
  })
  
  test('should show active model', async ({ page }) => {
    await page.goto('/engineering/models')
    
    await expect(page.getByText(/active|aktif/i)).toBeVisible()
  })
  
  test('should show available models list', async ({ page }) => {
    await page.goto('/engineering/models')
    
    // Should have at least one model card
    const modelCards = page.locator('[data-testid="model-card"]')
    await expect(modelCards.first()).toBeVisible()
  })
  
  test('should deploy model', async ({ page }) => {
    await page.goto('/engineering/models')
    
    // Find a non-active model and deploy
    const deployButton = page.getByRole('button', { name: /deploy/i }).first()
    
    if (await deployButton.isVisible()) {
      await deployButton.click()
      
      // Confirm dialog
      await page.getByRole('button', { name: /confirm|ya/i }).click()
      
      await expect(page.getByText(/deployed|success|berhasil/i)).toBeVisible()
    }
  })
  
  test('should show deployment history', async ({ page }) => {
    await page.goto('/engineering/models')
    
    await expect(page.getByText(/history|riwayat/i)).toBeVisible()
  })
})
```

---

### 11.13 Test Fixtures
Create `__fixtures__/testData.js`:
```js
export const mockUsers = [
  {
    id: 'user-operator',
    name: 'Test Operator',
    email: 'operator@test.com',
    role_id: 'operator',
    sections: ['section-a'],
    status: 'active'
  },
  {
    id: 'user-manager',
    name: 'Test Manager',
    email: 'manager@test.com',
    role_id: 'manager',
    sections: ['section-a', 'section-b'],
    status: 'active'
  },
  {
    id: 'user-engineer',
    name: 'Test Engineer',
    email: 'engineer@test.com',
    role_id: 'engineer',
    sections: [],
    status: 'active'
  },
  {
    id: 'user-admin',
    name: 'Super Admin',
    email: 'admin@test.com',
    role_id: 'superadmin',
    sections: [],
    status: 'active'
  }
]

export const mockRoles = [
  { id: 'operator', name: 'Operator', description: 'Production operator' },
  { id: 'manager', name: 'Manager', description: 'Section manager' },
  { id: 'engineer', name: 'Engineer', description: 'ML Engineer' },
  { id: 'superadmin', name: 'Super Admin', description: 'Full access' }
]

export const mockOverrides = [
  {
    id: 'override-1',
    board_id: 'board-001',
    defect_type: 'solder_bridge',
    reason: 'False detection - component placement correct',
    status: 'pending',
    operator_id: 'user-operator',
    operator_name: 'Test Operator',
    section_id: 'section-a',
    customer_id: 'cust-001',
    created_at: '2024-01-15T10:00:00Z'
  },
  {
    id: 'override-2',
    board_id: 'board-002',
    defect_type: 'missing_component',
    reason: 'Component present but not detected',
    status: 'approved',
    operator_id: 'user-operator',
    section_id: 'section-a',
    customer_id: 'cust-001',
    reviewer_id: 'user-manager',
    reviewed_at: '2024-01-15T11:00:00Z',
    created_at: '2024-01-15T09:00:00Z'
  }
]

export const mockModels = [
  {
    id: 'model-1',
    name: 'PCB Detector',
    version: '1.0.0',
    map50: 0.95,
    map50_95: 0.87,
    precision_val: 0.94,
    recall: 0.92,
    status: 'deployed',
    is_active: true,
    framework: 'yolov10',
    deployed_at: '2024-01-10T00:00:00Z'
  },
  {
    id: 'model-2',
    name: 'PCB Detector',
    version: '1.1.0',
    map50: 0.97,
    map50_95: 0.89,
    precision_val: 0.96,
    recall: 0.94,
    status: 'ready',
    is_active: false,
    framework: 'yolov10'
  }
]

export const mockNotifications = [
  {
    id: 'notif-1',
    type: 'WORKFLOW',
    category: 'OVERRIDE_SUBMITTED',
    title: 'New Override',
    message: 'New false call override submitted',
    severity: 'INFO',
    read: false,
    created_at: '2024-01-15T10:00:00Z'
  }
]
```

---

## Test Coverage Goals

| Area | Target | Priority |
|------|--------|----------|
| Validation schemas | 90%+ | 🔴 Critical |
| RBAC logic | 90%+ | 🔴 Critical |
| Repository layer | 80%+ | 🔴 Critical |
| API routes | 80%+ | 🟡 High |
| Hooks | 70%+ | 🟡 High |
| Components | 70%+ | 🟢 Medium |
| E2E critical paths | 100% | 🔴 Critical |

---

## Output Files
```
jest.config.js
jest.setup.js
playwright.config.js

lib/validations/__tests__/
└── schemas.test.js

lib/auth/__tests__/
├── rbac.test.js
└── sectionAccess.test.js

lib/repos/__tests__/
├── usersRepo.test.js
└── modelsRepo.test.js

app/api/__tests__/
├── users.test.js
└── overrides.test.js

components/__tests__/
├── ErrorBoundary.test.jsx
└── OfflineBanner.test.jsx

hooks/__tests__/
├── useModels.test.js
└── useNetworkStatus.test.js

e2e/
├── auth.spec.js
├── overrides.spec.js
└── models.spec.js

__fixtures__/
└── testData.js
```

---

## Validation Checklist
- [ ] `npm test` runs without errors
- [ ] `npm run test:coverage` meets 70%+ threshold
- [ ] All validation schema tests pass
- [ ] All RBAC tests pass
- [ ] Repository tests mock Supabase correctly
- [ ] API route tests cover success and error cases
- [ ] Component tests render correctly
- [ ] Hook tests handle state changes
- [ ] E2E tests pass for auth flow
- [ ] E2E tests pass for override workflow
- [ ] E2E tests pass for model management

---

## Estimated Time
4-5 hours
