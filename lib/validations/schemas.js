import { z } from 'zod'

// ============================================
// User Schemas
// ============================================

export const createUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  role_id: z.string().min(1, 'Role is required'),
  sections: z.array(z.string()).default([]),
  whatsapp: z.string().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  status: z.enum(['active', 'inactive']).default('active')
})

export const updateUserSchema = createUserSchema.partial()

export const userIdSchema = z.object({
  id: z.string().min(1, 'User ID is required')
})

// ============================================
// Role Schemas
// ============================================

export const createRoleSchema = z.object({
  id: z.string()
    .min(1, 'Role ID is required')
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Role ID must be lowercase alphanumeric with dashes only'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  description: z.string().optional()
})

export const updateRoleSchema = createRoleSchema.partial().omit({ id: true })

// ============================================
// Override Schemas
// ============================================

export const createOverrideSchema = z.object({
  board_id: z.string().min(1, 'Board ID is required'),
  defect_type: z.string().min(1, 'Defect type is required'),
  override_type: z.string().nullish(), // Alias for defect_type from LiveView
  location: z.string().nullish(),
  confidence: z.number().min(0).max(100).nullish(),
  reason: z.string().min(1, 'Reason is required'),
  operator_notes: z.string().nullish(),
  operator_id: z.string().nullish(),
  operator_name: z.string().nullish(),
  section_id: z.string().nullish(), // Optional - skip validation for operators on active line
  line_id: z.string().nullish(),
  work_order_id: z.string().nullish(),
  customer_id: z.string().nullish(),
  image_url: z.string().url().nullish().or(z.literal('')),
  local_image_path: z.string().nullish(),
  local_image_paths: z.string().nullish(), // JSON string
  ng_frame_details: z.string().nullish() // JSON string - per-frame false call metadata for AI training
})

export const reviewOverrideSchema = z.object({
  action: z.enum(['approve', 'reject'], {
    errorMap: () => ({ message: 'Action must be either approve or reject' })
  }),
  reviewer_id: z.string().min(1, 'Reviewer ID is required'),
  reviewer_name: z.string().min(1, 'Reviewer name is required'),
  reviewer_notes: z.string().optional()
})

export const overrideFiltersSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  section_id: z.string().optional(),
  customer_id: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional()
})

// ============================================
// Notification Schemas
// ============================================

export const createNotificationSchema = z.object({
  type: z.enum(['SYSTEM', 'WORKFLOW'], {
    errorMap: () => ({ message: 'Type must be SYSTEM or WORKFLOW' })
  }),
  category: z.string().min(1, 'Category is required'),
  title: z.string().min(1, 'Title is required').max(200),
  message: z.string().min(1, 'Message is required').max(1000),
  severity: z.enum(['INFO', 'WARNING', 'CRITICAL'], {
    errorMap: () => ({ message: 'Severity must be INFO, WARNING, or CRITICAL' })
  }),
  user_id: z.string().optional(),
  section_id: z.string().optional(),
  line_id: z.string().optional(),
  source: z.string().optional()
})

export const updateNotificationSchema = z.object({
  ids: z.array(z.string()).optional(),
  read: z.boolean().optional(),
  userId: z.string().optional(),
  markAllRead: z.boolean().optional()
})

// ============================================
// Event Log Schemas
// ============================================

export const createEventSchema = z.object({
  type: z.string().min(1, 'Event type is required'),
  source: z.string().min(1, 'Source is required'),
  user_id: z.string().optional(),
  user_name: z.string().optional(),
  role_id: z.string().optional(),
  section_id: z.string().optional(),
  details: z.record(z.any()).optional()
})

export const eventLogFiltersSchema = z.object({
  type: z.string().optional(),
  source: z.string().optional(),
  user_id: z.string().optional(),
  section_id: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  severity: z.string().optional()
})

// ============================================
// Auth Schemas
// ============================================

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
})

export const changePasswordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: z.string().min(6, 'New password must be at least 6 characters'),
  confirm_password: z.string().min(6, 'Confirm password is required')
}).refine(data => data.new_password === data.confirm_password, {
  message: "Passwords don't match",
  path: ['confirm_password']
})

// ============================================
// Image Upload Schemas
// ============================================

export const imageUploadSchema = z.object({
  override_id: z.string().min(1, 'Override ID is required'),
  section_id: z.string().min(1, 'Section ID is required'),
  board_id: z.string().min(1, 'Board ID is required'),
  user_id: z.string().min(1, 'User ID is required')
})

// ============================================
// Board Schemas
// ============================================

export const createBoardSchema = z.object({
  name: z.string().min(1, 'Board name is required').max(100),
  customerId: z.string().min(1, 'Customer ID is required'),
  cavityCount: z.number().int().min(1, 'Cavity count must be at least 1').default(1),
  description: z.string().nullish(),
  partNumber: z.string().nullish(),
})

export const updateBoardSchema = createBoardSchema.partial()

// ============================================
// Model Schemas
// ============================================

export const deployModelSchema = z.object({
  user_id: z.string().min(1, 'User ID is required')
})

export const createModelSchema = z.object({
  name: z.string().min(1, 'Model name is required').max(100),
  version: z.string().min(1, 'Version is required'),
  description: z.string().optional(),
  model_path: z.string().optional(),
  customer_id: z.string().optional(),
  section_id: z.string().optional(),
  board_id: z.string().optional()
})

export const updateModelSchema = createModelSchema.partial()

// ============================================
// Query Parameter Schemas
// ============================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
})

export const masterDataFiltersSchema = z.object({
  customer_id: z.string().optional(),
  section_id: z.string().optional(),
  line_id: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional()
})

// ============================================
// Permission Schemas
// ============================================

export const updatePermissionSchema = z.object({
  role_id: z.string().min(1, 'Role ID is required'),
  menu_id: z.string().min(1, 'Menu ID is required'),
  can_view: z.boolean().default(false),
  can_create: z.boolean().default(false),
  can_edit: z.boolean().default(false),
  can_delete: z.boolean().default(false)
})

export const bulkUpdatePermissionsSchema = z.object({
  role_id: z.string().min(1, 'Role ID is required'),
  permissions: z.array(z.object({
    menu_id: z.string().min(1),
    can_view: z.boolean().default(false),
    can_create: z.boolean().default(false),
    can_edit: z.boolean().default(false),
    can_delete: z.boolean().default(false)
  }))
})

// ============================================
// Error Log Schema
// ============================================

export const errorLogSchema = z.object({
  error: z.string().optional(),
  message: z.string().optional(),
  stack: z.string().optional(),
  componentStack: z.string().optional(),
  url: z.string().optional(),
  userAgent: z.string().optional(),
  timestamp: z.string().optional(),
  source: z.string().optional(),
  userId: z.string().optional(),
  additionalInfo: z.record(z.any()).optional()
}).refine(data => data.error || data.message, {
  message: 'Either error or message is required'
})
