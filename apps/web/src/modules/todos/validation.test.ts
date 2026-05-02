import { describe, expect, it } from 'vitest'

import { todoFormValidate } from './validation'

describe('todoFormValidate', () => {
  describe('title', () => {
    it('returns error when empty', () => {
      expect(todoFormValidate.title('')).toBe('Required')
    })

    it('returns error when only whitespace', () => {
      expect(todoFormValidate.title('   ')).toBe('Required')
    })

    it('returns error when exceeds 200 characters', () => {
      expect(todoFormValidate.title('a'.repeat(201))).toBe('Max 200 characters')
    })

    it('returns null when valid', () => {
      expect(todoFormValidate.title('Buy groceries')).toBeNull()
    })
  })

  describe('description', () => {
    it('returns error when empty', () => {
      expect(todoFormValidate.description('')).toBe('Required')
    })

    it('returns error when exceeds 500 characters', () => {
      expect(todoFormValidate.description('a'.repeat(501))).toBe(
        'Max 500 characters'
      )
    })

    it('returns null when valid', () => {
      expect(todoFormValidate.description('Some description')).toBeNull()
    })
  })

  describe('content', () => {
    it('returns error when empty', () => {
      expect(todoFormValidate.content('')).toBe('Required')
    })

    it('returns error when exceeds 1000 characters', () => {
      expect(todoFormValidate.content('a'.repeat(501))).toBe(
        'Max 500 characters'
      )
    })

    it('returns null when valid', () => {
      expect(todoFormValidate.content('Some description')).toBeNull()
    })
  })

  describe('date', () => {
    it('returns error when null', () => {
      expect(todoFormValidate.date(null)).toBe('Required')
    })

    it('returns null when a date is provided', () => {
      expect(todoFormValidate.date('2026-01-01')).toBeNull()
    })
  })
})
