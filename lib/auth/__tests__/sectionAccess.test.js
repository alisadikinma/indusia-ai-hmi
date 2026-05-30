import {
  canAccessSection,
  canAccessAnySections,
  filterBySection,
  getSectionFilter,
  applySectionFilter,
  validateSectionAccess,
  getPrimarySection,
  hasMultipleSections,
  getSectionAccessSummary
} from '../sectionAccess'

describe('Section Access Module', () => {
  // Test users
  const operatorUser = {
    id: 'operator-1',
    role_id: 'operator',
    sections: ['section-a', 'section-b']
  }

  const managerUser = {
    id: 'manager-1',
    role_id: 'manager',
    sections: ['section-a']
  }

  const engineerUser = {
    id: 'engineer-1',
    role_id: 'engineer',
    sections: []
  }

  const superadminUser = {
    id: 'admin-1',
    role_id: 'superadmin',
    sections: []
  }

  const userNoSections = {
    id: 'user-1',
    role_id: 'operator',
    sections: []
  }

  // ============================================
  // canAccessSection tests
  // ============================================
  describe('canAccessSection', () => {
    it('should return false for null user', () => {
      expect(canAccessSection(null, 'section-a')).toBe(false)
    })

    it('should return true when no sectionId is provided', () => {
      expect(canAccessSection(operatorUser, null)).toBe(true)
      expect(canAccessSection(operatorUser, undefined)).toBe(true)
      expect(canAccessSection(operatorUser, '')).toBe(true)
    })

    it('should allow superadmin to access any section', () => {
      expect(canAccessSection(superadminUser, 'section-a')).toBe(true)
      expect(canAccessSection(superadminUser, 'section-xyz')).toBe(true)
    })

    it('should allow engineer to access any section', () => {
      expect(canAccessSection(engineerUser, 'section-a')).toBe(true)
      expect(canAccessSection(engineerUser, 'section-xyz')).toBe(true)
    })

    it('should allow operator to access assigned sections', () => {
      expect(canAccessSection(operatorUser, 'section-a')).toBe(true)
      expect(canAccessSection(operatorUser, 'section-b')).toBe(true)
    })

    it('should deny operator access to unassigned sections', () => {
      expect(canAccessSection(operatorUser, 'section-c')).toBe(false)
    })

    it('should return false for user with invalid sections field', () => {
      const invalidUser = { role_id: 'operator', sections: 'not-an-array' }
      expect(canAccessSection(invalidUser, 'section-a')).toBe(false)
    })

    it('should return false for user with no sections assigned', () => {
      expect(canAccessSection(userNoSections, 'section-a')).toBe(false)
    })
  })

  // ============================================
  // canAccessAnySections tests
  // ============================================
  describe('canAccessAnySections', () => {
    it('should return false for null user', () => {
      expect(canAccessAnySections(null, ['section-a'])).toBe(false)
    })

    it('should return true for empty sectionIds array', () => {
      expect(canAccessAnySections(operatorUser, [])).toBe(true)
    })

    it('should return true for null sectionIds', () => {
      expect(canAccessAnySections(operatorUser, null)).toBe(true)
    })

    it('should allow superadmin to access any sections', () => {
      expect(canAccessAnySections(superadminUser, ['section-x', 'section-y'])).toBe(true)
    })

    it('should allow engineer to access any sections', () => {
      expect(canAccessAnySections(engineerUser, ['section-x', 'section-y'])).toBe(true)
    })

    it('should return true if operator has access to at least one section', () => {
      expect(canAccessAnySections(operatorUser, ['section-a', 'section-c'])).toBe(true)
    })

    it('should return false if operator has no access to any section', () => {
      expect(canAccessAnySections(operatorUser, ['section-x', 'section-y'])).toBe(false)
    })
  })

  // ============================================
  // filterBySection tests
  // ============================================
  describe('filterBySection', () => {
    const testData = [
      { id: 1, name: 'Item A', section_id: 'section-a' },
      { id: 2, name: 'Item B', section_id: 'section-b' },
      { id: 3, name: 'Item C', section_id: 'section-c' },
      { id: 4, name: 'Global Item', section_id: null }
    ]

    it('should return empty array for null user', () => {
      expect(filterBySection(null, testData)).toEqual([])
    })

    it('should return empty array for null data', () => {
      expect(filterBySection(operatorUser, null)).toEqual([])
    })

    it('should return empty array for invalid data', () => {
      expect(filterBySection(operatorUser, 'not-an-array')).toEqual([])
    })

    it('should return all data for superadmin', () => {
      expect(filterBySection(superadminUser, testData)).toEqual(testData)
    })

    it('should return all data for engineer', () => {
      expect(filterBySection(engineerUser, testData)).toEqual(testData)
    })

    it('should filter data to user sections and global items', () => {
      const result = filterBySection(operatorUser, testData)
      expect(result).toHaveLength(3)
      expect(result.map(i => i.id)).toEqual([1, 2, 4])
    })

    it('should only include global items for user with no sections', () => {
      const result = filterBySection(userNoSections, testData)
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe(4)
    })

    it('should use custom section field name', () => {
      const customData = [
        { id: 1, location: 'section-a' },
        { id: 2, location: 'section-c' }
      ]
      const result = filterBySection(operatorUser, customData, 'location')
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe(1)
    })

    it('should return empty array for user with undefined sections', () => {
      const userUndefined = { role_id: 'operator' }
      expect(filterBySection(userUndefined, testData)).toEqual([])
    })
  })

  // ============================================
  // getSectionFilter tests
  // ============================================
  describe('getSectionFilter', () => {
    it('should return empty array for null user', () => {
      expect(getSectionFilter(null)).toEqual([])
    })

    it('should return null for superadmin (unrestricted)', () => {
      expect(getSectionFilter(superadminUser)).toBeNull()
    })

    it('should return null for engineer (unrestricted)', () => {
      expect(getSectionFilter(engineerUser)).toBeNull()
    })

    it('should return user sections for operator', () => {
      expect(getSectionFilter(operatorUser)).toEqual(['section-a', 'section-b'])
    })

    it('should return user sections for manager', () => {
      expect(getSectionFilter(managerUser)).toEqual(['section-a'])
    })

    it('should return empty array for user with no sections', () => {
      expect(getSectionFilter(userNoSections)).toEqual([])
    })

    it('should return empty array for user with undefined sections', () => {
      const userUndefined = { role_id: 'operator' }
      expect(getSectionFilter(userUndefined)).toEqual([])
    })
  })

  // ============================================
  // applySectionFilter tests
  // ============================================
  describe('applySectionFilter', () => {
    const mockQuery = {
      in: jest.fn().mockReturnThis()
    }

    beforeEach(() => {
      mockQuery.in.mockClear()
    })

    it('should return query unchanged for superadmin', () => {
      const result = applySectionFilter(mockQuery, superadminUser)
      expect(result).toBe(mockQuery)
      expect(mockQuery.in).not.toHaveBeenCalled()
    })

    it('should return query unchanged for engineer', () => {
      const result = applySectionFilter(mockQuery, engineerUser)
      expect(result).toBe(mockQuery)
      expect(mockQuery.in).not.toHaveBeenCalled()
    })

    it('should apply filter with user sections', () => {
      applySectionFilter(mockQuery, operatorUser)
      expect(mockQuery.in).toHaveBeenCalledWith('section_id', ['section-a', 'section-b'])
    })

    it('should use custom section field', () => {
      applySectionFilter(mockQuery, operatorUser, 'location')
      expect(mockQuery.in).toHaveBeenCalledWith('location', ['section-a', 'section-b'])
    })

    it('should force empty result for user with no sections', () => {
      applySectionFilter(mockQuery, userNoSections)
      expect(mockQuery.in).toHaveBeenCalledWith('section_id', ['__none__'])
    })
  })

  // ============================================
  // validateSectionAccess tests
  // ============================================
  describe('validateSectionAccess', () => {
    it('should not throw for valid access', () => {
      expect(() => validateSectionAccess(operatorUser, 'section-a')).not.toThrow()
    })

    it('should not throw for superadmin', () => {
      expect(() => validateSectionAccess(superadminUser, 'section-x')).not.toThrow()
    })

    it('should throw for invalid access', () => {
      expect(() => validateSectionAccess(operatorUser, 'section-c')).toThrow()
    })

    it('should throw error with correct properties', () => {
      try {
        validateSectionAccess(operatorUser, 'section-c')
        fail('Should have thrown')
      } catch (error) {
        expect(error.statusCode).toBe(403)
        expect(error.code).toBe('SECTION_ACCESS_DENIED')
        expect(error.details.requiredSection).toBe('section-c')
        expect(error.details.userSections).toEqual(['section-a', 'section-b'])
      }
    })

    it('should throw with empty userSections for null user', () => {
      try {
        validateSectionAccess(null, 'section-a')
        fail('Should have thrown')
      } catch (error) {
        expect(error.details.userSections).toEqual([])
      }
    })
  })

  // ============================================
  // getPrimarySection tests
  // ============================================
  describe('getPrimarySection', () => {
    it('should return first section for user with sections', () => {
      expect(getPrimarySection(operatorUser)).toBe('section-a')
    })

    it('should return null for null user', () => {
      expect(getPrimarySection(null)).toBeNull()
    })

    it('should return null for user with no sections', () => {
      expect(getPrimarySection(userNoSections)).toBeNull()
    })

    it('should return null for user with undefined sections', () => {
      expect(getPrimarySection({ role_id: 'operator' })).toBeNull()
    })
  })

  // ============================================
  // hasMultipleSections tests
  // ============================================
  describe('hasMultipleSections', () => {
    it('should return true for user with multiple sections', () => {
      expect(hasMultipleSections(operatorUser)).toBe(true)
    })

    it('should return false for user with one section', () => {
      expect(hasMultipleSections(managerUser)).toBe(false)
    })

    it('should return false for user with no sections', () => {
      expect(hasMultipleSections(userNoSections)).toBe(false)
    })

    it('should return false for null user', () => {
      expect(hasMultipleSections(null)).toBeFalsy()
    })
  })

  // ============================================
  // getSectionAccessSummary tests
  // ============================================
  describe('getSectionAccessSummary', () => {
    it('should return summary for null user', () => {
      const summary = getSectionAccessSummary(null)
      expect(summary).toEqual({
        hasAccess: false,
        sections: [],
        isUnrestricted: false
      })
    })

    it('should return unrestricted for superadmin', () => {
      const summary = getSectionAccessSummary(superadminUser)
      expect(summary.hasAccess).toBe(true)
      expect(summary.isUnrestricted).toBe(true)
      expect(summary.role).toBe('superadmin')
    })

    it('should return unrestricted for engineer', () => {
      const summary = getSectionAccessSummary(engineerUser)
      expect(summary.hasAccess).toBe(true)
      expect(summary.isUnrestricted).toBe(true)
      expect(summary.role).toBe('engineer')
    })

    it('should return restricted for operator', () => {
      const summary = getSectionAccessSummary(operatorUser)
      expect(summary.hasAccess).toBe(true)
      expect(summary.isUnrestricted).toBe(false)
      expect(summary.sections).toEqual(['section-a', 'section-b'])
      expect(summary.sectionCount).toBe(2)
      expect(summary.role).toBe('operator')
    })

    it('should handle user with undefined sections', () => {
      const summary = getSectionAccessSummary({ role_id: 'manager' })
      expect(summary.sections).toEqual([])
      expect(summary.sectionCount).toBe(0)
    })
  })
})
