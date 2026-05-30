import {
  PERMISSIONS,
  ROLE_HIERARCHY,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  getPermissionsForRole,
  isRoleHigherOrEqual,
  canManageUser,
  requirePermission,
  requireAnyPermission,
  unauthorizedResponse,
  forbiddenResponse
} from '../rbac'

describe('RBAC Module', () => {
  // ============================================
  // PERMISSIONS constant tests
  // ============================================
  describe('PERMISSIONS', () => {
    it('should define user management permissions', () => {
      expect(PERMISSIONS['users:read']).toContain('superadmin')
      expect(PERMISSIONS['users:create']).toContain('superadmin')
      expect(PERMISSIONS['users:update']).toContain('superadmin')
      expect(PERMISSIONS['users:delete']).toContain('superadmin')
    })

    it('should define override permissions for operators', () => {
      expect(PERMISSIONS['overrides:create']).toContain('operator')
      expect(PERMISSIONS['overrides:read']).toContain('operator')
    })

    it('should define review permissions for managers', () => {
      expect(PERMISSIONS['overrides:review']).toContain('manager')
      expect(PERMISSIONS['overrides:review']).not.toContain('operator')
    })

    it('should define model permissions for engineers', () => {
      expect(PERMISSIONS['models:read']).toContain('engineer')
      expect(PERMISSIONS['models:create']).toContain('engineer')
      expect(PERMISSIONS['models:deploy']).toContain('engineer')
    })

    it('should give superadmin access to admin panel', () => {
      expect(PERMISSIONS['admin:access']).toContain('superadmin')
      expect(PERMISSIONS['admin:access']).not.toContain('operator')
      expect(PERMISSIONS['admin:access']).not.toContain('manager')
      expect(PERMISSIONS['admin:access']).not.toContain('engineer')
    })
  })

  // ============================================
  // ROLE_HIERARCHY constant tests
  // ============================================
  describe('ROLE_HIERARCHY', () => {
    it('should define hierarchy with superadmin highest', () => {
      expect(ROLE_HIERARCHY.superadmin).toBeGreaterThan(ROLE_HIERARCHY.engineer)
      expect(ROLE_HIERARCHY.engineer).toBeGreaterThan(ROLE_HIERARCHY.manager)
      expect(ROLE_HIERARCHY.manager).toBeGreaterThan(ROLE_HIERARCHY.operator)
    })

    it('should have operator at level 0', () => {
      expect(ROLE_HIERARCHY.operator).toBe(0)
    })

    it('should have superadmin at level 3', () => {
      expect(ROLE_HIERARCHY.superadmin).toBe(3)
    })
  })

  // ============================================
  // hasPermission tests
  // ============================================
  describe('hasPermission', () => {
    it('should return true for valid role-permission combo', () => {
      expect(hasPermission('superadmin', 'users:create')).toBe(true)
      expect(hasPermission('operator', 'overrides:create')).toBe(true)
      expect(hasPermission('manager', 'overrides:review')).toBe(true)
    })

    it('should return false for invalid role-permission combo', () => {
      expect(hasPermission('operator', 'users:create')).toBe(false)
      expect(hasPermission('operator', 'overrides:review')).toBe(false)
      expect(hasPermission('manager', 'admin:access')).toBe(false)
    })

    it('should return false for null role', () => {
      expect(hasPermission(null, 'users:read')).toBe(false)
    })

    it('should return false for undefined role', () => {
      expect(hasPermission(undefined, 'users:read')).toBe(false)
    })

    it('should return false for null permission', () => {
      expect(hasPermission('superadmin', null)).toBe(false)
    })

    it('should return false for unknown permission', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
      expect(hasPermission('superadmin', 'unknown:permission')).toBe(false)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown permission')
      )
      consoleSpy.mockRestore()
    })

    it('should return false for unknown role', () => {
      expect(hasPermission('unknown_role', 'users:read')).toBe(false)
    })
  })

  // ============================================
  // hasAnyPermission tests
  // ============================================
  describe('hasAnyPermission', () => {
    it('should return true if role has any of the permissions', () => {
      expect(hasAnyPermission('operator', ['overrides:create', 'users:create'])).toBe(true)
      expect(hasAnyPermission('manager', ['users:read', 'admin:access'])).toBe(true)
    })

    it('should return false if role has none of the permissions', () => {
      expect(hasAnyPermission('operator', ['users:create', 'admin:access'])).toBe(false)
    })

    it('should return true if all permissions are allowed', () => {
      expect(hasAnyPermission('superadmin', ['users:create', 'admin:access'])).toBe(true)
    })

    it('should return false for empty permissions array', () => {
      expect(hasAnyPermission('superadmin', [])).toBe(false)
    })
  })

  // ============================================
  // hasAllPermissions tests
  // ============================================
  describe('hasAllPermissions', () => {
    it('should return true if role has all permissions', () => {
      expect(hasAllPermissions('superadmin', ['users:create', 'users:delete'])).toBe(true)
      expect(hasAllPermissions('operator', ['overrides:read', 'overrides:create'])).toBe(true)
    })

    it('should return false if role is missing any permission', () => {
      expect(hasAllPermissions('operator', ['overrides:create', 'overrides:review'])).toBe(false)
    })

    it('should return true for empty permissions array', () => {
      expect(hasAllPermissions('operator', [])).toBe(true)
    })
  })

  // ============================================
  // getPermissionsForRole tests
  // ============================================
  describe('getPermissionsForRole', () => {
    it('should return all permissions for superadmin', () => {
      const permissions = getPermissionsForRole('superadmin')
      expect(permissions).toContain('users:create')
      expect(permissions).toContain('admin:access')
      expect(permissions).toContain('overrides:delete')
    })

    it('should return limited permissions for operator', () => {
      const permissions = getPermissionsForRole('operator')
      expect(permissions).toContain('overrides:create')
      expect(permissions).toContain('overrides:read')
      expect(permissions).not.toContain('users:create')
      expect(permissions).not.toContain('admin:access')
    })

    it('should return empty array for null role', () => {
      expect(getPermissionsForRole(null)).toEqual([])
    })

    it('should return empty array for undefined role', () => {
      expect(getPermissionsForRole(undefined)).toEqual([])
    })

    it('should return empty array for unknown role', () => {
      expect(getPermissionsForRole('unknown')).toEqual([])
    })

    it('should return permissions for manager', () => {
      const permissions = getPermissionsForRole('manager')
      expect(permissions).toContain('overrides:review')
      expect(permissions).toContain('users:read')
      expect(permissions).not.toContain('users:create')
    })
  })

  // ============================================
  // isRoleHigherOrEqual tests
  // ============================================
  describe('isRoleHigherOrEqual', () => {
    it('should return true for same role', () => {
      expect(isRoleHigherOrEqual('operator', 'operator')).toBe(true)
      expect(isRoleHigherOrEqual('superadmin', 'superadmin')).toBe(true)
    })

    it('should return true for higher role', () => {
      expect(isRoleHigherOrEqual('superadmin', 'operator')).toBe(true)
      expect(isRoleHigherOrEqual('manager', 'operator')).toBe(true)
      expect(isRoleHigherOrEqual('engineer', 'manager')).toBe(true)
    })

    it('should return false for lower role', () => {
      expect(isRoleHigherOrEqual('operator', 'manager')).toBe(false)
      expect(isRoleHigherOrEqual('manager', 'superadmin')).toBe(false)
    })

    it('should return false for unknown roleA', () => {
      expect(isRoleHigherOrEqual('unknown', 'operator')).toBe(false)
    })

    it('should return true if roleB is unknown (level -1)', () => {
      expect(isRoleHigherOrEqual('operator', 'unknown')).toBe(true)
    })
  })

  // ============================================
  // canManageUser tests
  // ============================================
  describe('canManageUser', () => {
    it('should allow superadmin to manage all other roles', () => {
      expect(canManageUser('superadmin', 'engineer')).toBe(true)
      expect(canManageUser('superadmin', 'manager')).toBe(true)
      expect(canManageUser('superadmin', 'operator')).toBe(true)
    })

    it('should not allow superadmin to manage superadmin', () => {
      expect(canManageUser('superadmin', 'superadmin')).toBe(false)
    })

    it('should allow engineer to manage manager and operator', () => {
      expect(canManageUser('engineer', 'manager')).toBe(true)
      expect(canManageUser('engineer', 'operator')).toBe(true)
    })

    it('should not allow engineer to manage engineer or superadmin', () => {
      expect(canManageUser('engineer', 'engineer')).toBe(false)
      expect(canManageUser('engineer', 'superadmin')).toBe(false)
    })

    it('should allow manager to manage operator only', () => {
      expect(canManageUser('manager', 'operator')).toBe(true)
      expect(canManageUser('manager', 'manager')).toBe(false)
      expect(canManageUser('manager', 'engineer')).toBe(false)
    })

    it('should not allow operator to manage anyone', () => {
      expect(canManageUser('operator', 'operator')).toBe(false)
      expect(canManageUser('operator', 'manager')).toBe(false)
    })

    it('should return false for unknown manager role', () => {
      expect(canManageUser('unknown', 'operator')).toBe(false)
    })
  })

  // ============================================
  // requirePermission tests
  // ============================================
  describe('requirePermission', () => {
    it('should return true for user with permission', async () => {
      const checker = requirePermission('users:create')
      const user = { role_id: 'superadmin' }
      const result = await checker({}, user)
      expect(result).toBe(true)
    })

    it('should throw UNAUTHORIZED for null user', async () => {
      const checker = requirePermission('users:create')
      await expect(checker({}, null)).rejects.toMatchObject({
        message: 'Unauthorized',
        statusCode: 401,
        code: 'UNAUTHORIZED'
      })
    })

    it('should throw FORBIDDEN for user without permission', async () => {
      const checker = requirePermission('users:create')
      const user = { role_id: 'operator' }
      await expect(checker({}, user)).rejects.toMatchObject({
        message: expect.stringContaining('Forbidden'),
        statusCode: 403,
        code: 'FORBIDDEN',
        details: {
          required: 'users:create',
          userRole: 'operator'
        }
      })
    })
  })

  // ============================================
  // requireAnyPermission tests
  // ============================================
  describe('requireAnyPermission', () => {
    it('should return true for user with any permission', async () => {
      const checker = requireAnyPermission(['users:create', 'overrides:read'])
      const user = { role_id: 'operator' }
      const result = await checker({}, user)
      expect(result).toBe(true)
    })

    it('should throw UNAUTHORIZED for null user', async () => {
      const checker = requireAnyPermission(['users:create'])
      await expect(checker({}, null)).rejects.toMatchObject({
        statusCode: 401,
        code: 'UNAUTHORIZED'
      })
    })

    it('should throw FORBIDDEN for user without any permission', async () => {
      const checker = requireAnyPermission(['users:create', 'admin:access'])
      const user = { role_id: 'operator' }
      await expect(checker({}, user)).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN',
        details: {
          required: ['users:create', 'admin:access'],
          userRole: 'operator'
        }
      })
    })
  })

  // ============================================
  // Response Helper tests
  // ============================================
  describe('Response Helpers', () => {
    describe('unauthorizedResponse', () => {
      it('should return 401 response with default message', async () => {
        const response = unauthorizedResponse()
        expect(response.status).toBe(401)
        const body = await response.json()
        expect(body).toEqual({
          success: false,
          error: 'Unauthorized',
          code: 'UNAUTHORIZED'
        })
      })

      it('should return 401 response with custom message', async () => {
        const response = unauthorizedResponse('Token expired')
        const body = await response.json()
        expect(body.error).toBe('Token expired')
      })
    })

    describe('forbiddenResponse', () => {
      it('should return 403 response with default message', async () => {
        const response = forbiddenResponse()
        expect(response.status).toBe(403)
        const body = await response.json()
        expect(body).toEqual({
          success: false,
          error: 'Forbidden',
          code: 'FORBIDDEN'
        })
      })

      it('should return 403 response with custom message', async () => {
        const response = forbiddenResponse('Access denied to section')
        const body = await response.json()
        expect(body.error).toBe('Access denied to section')
      })
    })
  })
})
