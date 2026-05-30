import {
  createUserSchema,
  updateUserSchema,
  createOverrideSchema,
  reviewOverrideSchema,
  loginSchema,
  changePasswordSchema,
  deployModelSchema,
  createNotificationSchema,
  paginationSchema,
  createRoleSchema,
  imageUploadSchema,
  errorLogSchema
} from '../schemas'

describe('Validation Schemas', () => {
  // ============================================
  // createUserSchema Tests
  // ============================================
  describe('createUserSchema', () => {
    const validUser = {
      name: 'John Doe',
      email: 'john@example.com',
      role_id: 'operator',
      sections: ['section-1'],
      status: 'active'
    }

    it('should validate a valid user', () => {
      const result = createUserSchema.safeParse(validUser)
      expect(result.success).toBe(true)
      expect(result.data).toEqual(validUser)
    })

    it('should reject name shorter than 2 characters', () => {
      const result = createUserSchema.safeParse({ ...validUser, name: 'J' })
      expect(result.success).toBe(false)
      expect(result.error.errors[0].message).toContain('at least 2 characters')
    })

    it('should reject invalid email', () => {
      const result = createUserSchema.safeParse({ ...validUser, email: 'not-an-email' })
      expect(result.success).toBe(false)
      expect(result.error.errors[0].message).toContain('Invalid email')
    })

    it('should reject missing role_id', () => {
      const { role_id, ...userWithoutRole } = validUser
      const result = createUserSchema.safeParse(userWithoutRole)
      expect(result.success).toBe(false)
    })

    it('should accept optional whatsapp field', () => {
      const result = createUserSchema.safeParse({ ...validUser, whatsapp: '+62812345678' })
      expect(result.success).toBe(true)
      expect(result.data.whatsapp).toBe('+62812345678')
    })

    it('should default sections to empty array', () => {
      const { sections, ...userWithoutSections } = validUser
      const result = createUserSchema.safeParse(userWithoutSections)
      expect(result.success).toBe(true)
      expect(result.data.sections).toEqual([])
    })

    it('should default status to active', () => {
      const { status, ...userWithoutStatus } = validUser
      const result = createUserSchema.safeParse(userWithoutStatus)
      expect(result.success).toBe(true)
      expect(result.data.status).toBe('active')
    })

    it('should reject invalid status', () => {
      const result = createUserSchema.safeParse({ ...validUser, status: 'banned' })
      expect(result.success).toBe(false)
    })

    it('should validate password minimum length', () => {
      const result = createUserSchema.safeParse({ ...validUser, password: '123' })
      expect(result.success).toBe(false)
      expect(result.error.errors[0].message).toContain('at least 6 characters')
    })

    it('should accept valid password', () => {
      const result = createUserSchema.safeParse({ ...validUser, password: 'securepass123' })
      expect(result.success).toBe(true)
    })
  })

  // ============================================
  // createOverrideSchema Tests
  // ============================================
  describe('createOverrideSchema', () => {
    const validOverride = {
      board_id: 'board-123',
      defect_type: 'solder_bridge',
      reason: 'False positive - acceptable variation',
      operator_id: 'user-1',
      operator_name: 'John Operator',
      section_id: 'section-1',
      customer_id: 'customer-1'
    }

    it('should validate a valid override', () => {
      const result = createOverrideSchema.safeParse(validOverride)
      expect(result.success).toBe(true)
    })

    it('should reject missing board_id', () => {
      const { board_id, ...overrideWithoutBoard } = validOverride
      const result = createOverrideSchema.safeParse(overrideWithoutBoard)
      expect(result.success).toBe(false)
    })

    it('should reject missing defect_type', () => {
      const { defect_type, ...overrideWithoutDefect } = validOverride
      const result = createOverrideSchema.safeParse(overrideWithoutDefect)
      expect(result.success).toBe(false)
    })

    it('should reject missing reason', () => {
      const { reason, ...overrideWithoutReason } = validOverride
      const result = createOverrideSchema.safeParse(overrideWithoutReason)
      expect(result.success).toBe(false)
    })

    it('should accept optional location', () => {
      const result = createOverrideSchema.safeParse({ ...validOverride, location: 'U1-pin3' })
      expect(result.success).toBe(true)
      expect(result.data.location).toBe('U1-pin3')
    })

    it('should validate confidence range 0-100', () => {
      const result1 = createOverrideSchema.safeParse({ ...validOverride, confidence: 85 })
      expect(result1.success).toBe(true)

      const result2 = createOverrideSchema.safeParse({ ...validOverride, confidence: -1 })
      expect(result2.success).toBe(false)

      const result3 = createOverrideSchema.safeParse({ ...validOverride, confidence: 101 })
      expect(result3.success).toBe(false)
    })

    it('should accept valid image URL', () => {
      const result = createOverrideSchema.safeParse({
        ...validOverride,
        image_url: 'https://storage.example.com/image.png'
      })
      expect(result.success).toBe(true)
    })

    it('should accept empty string for image_url', () => {
      const result = createOverrideSchema.safeParse({ ...validOverride, image_url: '' })
      expect(result.success).toBe(true)
    })

    it('should reject invalid image URL', () => {
      const result = createOverrideSchema.safeParse({ ...validOverride, image_url: 'not-a-url' })
      expect(result.success).toBe(false)
    })
  })

  // ============================================
  // reviewOverrideSchema Tests
  // ============================================
  describe('reviewOverrideSchema', () => {
    const validReview = {
      action: 'approve',
      reviewer_id: 'manager-1',
      reviewer_name: 'Jane Manager'
    }

    it('should validate a valid approval', () => {
      const result = reviewOverrideSchema.safeParse(validReview)
      expect(result.success).toBe(true)
    })

    it('should validate a valid rejection', () => {
      const result = reviewOverrideSchema.safeParse({ ...validReview, action: 'reject' })
      expect(result.success).toBe(true)
    })

    it('should reject invalid action', () => {
      const result = reviewOverrideSchema.safeParse({ ...validReview, action: 'pending' })
      expect(result.success).toBe(false)
      expect(result.error.errors[0].message).toContain('approve or reject')
    })

    it('should reject missing reviewer_id', () => {
      const { reviewer_id, ...reviewWithoutReviewerId } = validReview
      const result = reviewOverrideSchema.safeParse(reviewWithoutReviewerId)
      expect(result.success).toBe(false)
    })

    it('should accept optional reviewer_notes', () => {
      const result = reviewOverrideSchema.safeParse({
        ...validReview,
        reviewer_notes: 'Confirmed with engineering'
      })
      expect(result.success).toBe(true)
      expect(result.data.reviewer_notes).toBe('Confirmed with engineering')
    })
  })

  // ============================================
  // loginSchema Tests
  // ============================================
  describe('loginSchema', () => {
    it('should validate valid login credentials', () => {
      const result = loginSchema.safeParse({
        email: 'user@example.com',
        password: 'password123'
      })
      expect(result.success).toBe(true)
    })

    it('should reject invalid email', () => {
      const result = loginSchema.safeParse({
        email: 'invalid-email',
        password: 'password123'
      })
      expect(result.success).toBe(false)
      expect(result.error.errors[0].message).toContain('Invalid email')
    })

    it('should reject empty password', () => {
      const result = loginSchema.safeParse({
        email: 'user@example.com',
        password: ''
      })
      expect(result.success).toBe(false)
      expect(result.error.errors[0].message).toContain('required')
    })

    it('should reject missing email', () => {
      const result = loginSchema.safeParse({ password: 'password123' })
      expect(result.success).toBe(false)
    })

    it('should reject missing password', () => {
      const result = loginSchema.safeParse({ email: 'user@example.com' })
      expect(result.success).toBe(false)
    })
  })

  // ============================================
  // changePasswordSchema Tests
  // ============================================
  describe('changePasswordSchema', () => {
    it('should validate matching passwords', () => {
      const result = changePasswordSchema.safeParse({
        current_password: 'oldpass',
        new_password: 'newpass123',
        confirm_password: 'newpass123'
      })
      expect(result.success).toBe(true)
    })

    it('should reject non-matching passwords', () => {
      const result = changePasswordSchema.safeParse({
        current_password: 'oldpass',
        new_password: 'newpass123',
        confirm_password: 'different123'
      })
      expect(result.success).toBe(false)
      expect(result.error.errors[0].message).toContain("don't match")
    })

    it('should reject short new password', () => {
      const result = changePasswordSchema.safeParse({
        current_password: 'oldpass',
        new_password: '123',
        confirm_password: '123'
      })
      expect(result.success).toBe(false)
      expect(result.error.errors[0].message).toContain('at least 6 characters')
    })

    it('should reject empty current password', () => {
      const result = changePasswordSchema.safeParse({
        current_password: '',
        new_password: 'newpass123',
        confirm_password: 'newpass123'
      })
      expect(result.success).toBe(false)
    })
  })

  // ============================================
  // deployModelSchema Tests
  // ============================================
  describe('deployModelSchema', () => {
    it('should validate with user_id', () => {
      const result = deployModelSchema.safeParse({ user_id: 'engineer-1' })
      expect(result.success).toBe(true)
    })

    it('should reject missing user_id', () => {
      const result = deployModelSchema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('should reject empty user_id', () => {
      const result = deployModelSchema.safeParse({ user_id: '' })
      expect(result.success).toBe(false)
    })
  })

  // ============================================
  // createNotificationSchema Tests
  // ============================================
  describe('createNotificationSchema', () => {
    const validNotification = {
      type: 'SYSTEM',
      category: 'override',
      title: 'Override Submitted',
      message: 'A new override has been submitted for review',
      severity: 'INFO'
    }

    it('should validate a valid notification', () => {
      const result = createNotificationSchema.safeParse(validNotification)
      expect(result.success).toBe(true)
    })

    it('should reject invalid type', () => {
      const result = createNotificationSchema.safeParse({
        ...validNotification,
        type: 'INVALID'
      })
      expect(result.success).toBe(false)
      expect(result.error.errors[0].message).toContain('SYSTEM or WORKFLOW')
    })

    it('should accept WORKFLOW type', () => {
      const result = createNotificationSchema.safeParse({
        ...validNotification,
        type: 'WORKFLOW'
      })
      expect(result.success).toBe(true)
    })

    it('should validate severity values', () => {
      const infoResult = createNotificationSchema.safeParse({
        ...validNotification,
        severity: 'INFO'
      })
      expect(infoResult.success).toBe(true)

      const warningResult = createNotificationSchema.safeParse({
        ...validNotification,
        severity: 'WARNING'
      })
      expect(warningResult.success).toBe(true)

      const criticalResult = createNotificationSchema.safeParse({
        ...validNotification,
        severity: 'CRITICAL'
      })
      expect(criticalResult.success).toBe(true)

      const invalidResult = createNotificationSchema.safeParse({
        ...validNotification,
        severity: 'LOW'
      })
      expect(invalidResult.success).toBe(false)
    })

    it('should reject title exceeding max length', () => {
      const result = createNotificationSchema.safeParse({
        ...validNotification,
        title: 'A'.repeat(201)
      })
      expect(result.success).toBe(false)
    })

    it('should reject message exceeding max length', () => {
      const result = createNotificationSchema.safeParse({
        ...validNotification,
        message: 'A'.repeat(1001)
      })
      expect(result.success).toBe(false)
    })
  })

  // ============================================
  // paginationSchema Tests
  // ============================================
  describe('paginationSchema', () => {
    it('should provide default values', () => {
      const result = paginationSchema.safeParse({})
      expect(result.success).toBe(true)
      expect(result.data.page).toBe(1)
      expect(result.data.limit).toBe(20)
    })

    it('should coerce string to number', () => {
      const result = paginationSchema.safeParse({ page: '5', limit: '25' })
      expect(result.success).toBe(true)
      expect(result.data.page).toBe(5)
      expect(result.data.limit).toBe(25)
    })

    it('should reject page less than 1', () => {
      const result = paginationSchema.safeParse({ page: 0 })
      expect(result.success).toBe(false)
    })

    it('should reject limit greater than 100', () => {
      const result = paginationSchema.safeParse({ limit: 101 })
      expect(result.success).toBe(false)
    })

    it('should reject non-integer values', () => {
      const result = paginationSchema.safeParse({ page: 1.5 })
      expect(result.success).toBe(false)
    })
  })

  // ============================================
  // createRoleSchema Tests
  // ============================================
  describe('createRoleSchema', () => {
    it('should validate a valid role', () => {
      const result = createRoleSchema.safeParse({
        id: 'quality-manager',
        name: 'Quality Manager',
        description: 'Manages quality control processes'
      })
      expect(result.success).toBe(true)
    })

    it('should reject role ID with uppercase', () => {
      const result = createRoleSchema.safeParse({
        id: 'Quality-Manager',
        name: 'Quality Manager'
      })
      expect(result.success).toBe(false)
      expect(result.error.errors[0].message).toContain('lowercase')
    })

    it('should reject role ID with spaces', () => {
      const result = createRoleSchema.safeParse({
        id: 'quality manager',
        name: 'Quality Manager'
      })
      expect(result.success).toBe(false)
    })

    it('should accept role ID with dashes and numbers', () => {
      const result = createRoleSchema.safeParse({
        id: 'level-2-inspector',
        name: 'Level 2 Inspector'
      })
      expect(result.success).toBe(true)
    })

    it('should reject name shorter than 2 characters', () => {
      const result = createRoleSchema.safeParse({
        id: 'x',
        name: 'X'
      })
      expect(result.success).toBe(false)
    })
  })

  // ============================================
  // imageUploadSchema Tests
  // ============================================
  describe('imageUploadSchema', () => {
    const validUpload = {
      override_id: 'override-123',
      section_id: 'section-1',
      board_id: 'board-456',
      user_id: 'user-789'
    }

    it('should validate valid upload metadata', () => {
      const result = imageUploadSchema.safeParse(validUpload)
      expect(result.success).toBe(true)
    })

    it('should reject missing override_id', () => {
      const { override_id, ...uploadWithoutOverride } = validUpload
      const result = imageUploadSchema.safeParse(uploadWithoutOverride)
      expect(result.success).toBe(false)
    })

    it('should reject all empty fields', () => {
      const result = imageUploadSchema.safeParse({
        override_id: '',
        section_id: '',
        board_id: '',
        user_id: ''
      })
      expect(result.success).toBe(false)
    })
  })

  // ============================================
  // errorLogSchema Tests
  // ============================================
  describe('errorLogSchema', () => {
    it('should validate with error field', () => {
      const result = errorLogSchema.safeParse({
        error: 'TypeError',
        message: 'Cannot read property x of undefined',
        url: '/dashboard'
      })
      expect(result.success).toBe(true)
    })

    it('should validate with message only', () => {
      const result = errorLogSchema.safeParse({
        message: 'An error occurred'
      })
      expect(result.success).toBe(true)
    })

    it('should reject without error or message', () => {
      const result = errorLogSchema.safeParse({
        url: '/dashboard'
      })
      expect(result.success).toBe(false)
      expect(result.error.errors[0].message).toContain('Either error or message is required')
    })

    it('should accept additionalInfo as record', () => {
      const result = errorLogSchema.safeParse({
        error: 'Error',
        additionalInfo: {
          component: 'Dashboard',
          action: 'fetchData'
        }
      })
      expect(result.success).toBe(true)
    })
  })

  // ============================================
  // updateUserSchema Tests
  // ============================================
  describe('updateUserSchema', () => {
    it('should allow partial updates', () => {
      const result = updateUserSchema.safeParse({ name: 'Updated Name' })
      expect(result.success).toBe(true)
    })

    it('should validate fields that are provided', () => {
      const result = updateUserSchema.safeParse({ email: 'invalid' })
      expect(result.success).toBe(false)
    })

    it('should accept empty object for no updates', () => {
      const result = updateUserSchema.safeParse({})
      expect(result.success).toBe(true)
    })
  })
})
