import { describe, expect, it } from 'vitest'

import type { TodoFormValues } from './types'
import { todoFormValidate } from './validation'

const base: TodoFormValues = {
  title: '',
  description: '',
  content: '',
  date: null,
  status: 'completed',
}

describe('todoFormValidate', () => {
  describe('title', () => {
    it('returns error when empty', () => {
      expect(todoFormValidate.title('', base)).toBe('Required')
    })

    it('returns error when only whitespace', () => {
      expect(todoFormValidate.title('   ', base)).toBe('Required')
    })

    it('returns error when exceeds 200 characters', () => {
      expect(todoFormValidate.title('a'.repeat(201), base)).toBe('Max 200 characters')
    })

    it('returns null when valid', () => {
      expect(todoFormValidate.title('Buy groceries', base)).toBeNull()
    })
  })

  describe('description', () => {
    it('returns error when empty', () => {
      expect(todoFormValidate.description('', base)).toBe('Required')
    })

    it('returns error when exceeds 500 characters', () => {
      expect(todoFormValidate.description('a'.repeat(501), base)).toBe('Max 500 characters')
    })

    it('returns null when valid', () => {
      expect(todoFormValidate.description('Some description', base)).toBeNull()
    })
  })

  describe('content', () => {
    it('returns error when empty string', () => {
      expect(todoFormValidate.content('', base)).toBe('Required')
    })

    it('returns error when empty paragraph (Tiptap default)', () => {
      expect(todoFormValidate.content('<p></p>', base)).toBe('Required')
    })

    it('returns error when paragraph with only a line break', () => {
      expect(todoFormValidate.content('<p><br class="ProseMirror-trailingBreak"></p>', base)).toBe('Required')
    })

    it('returns error when exceeds 1000 characters', () => {
      expect(todoFormValidate.content('a'.repeat(1001), base)).toBe('Max 1000 characters')
    })

    it('returns null when valid plain text', () => {
      expect(todoFormValidate.content('Some content', base)).toBeNull()
    })

    it('returns null when valid HTML', () => {
      expect(todoFormValidate.content('<p>Some content</p>', base)).toBeNull()
    })
  })

  describe('date', () => {
    it('returns error when null and status is completed', () => {
      expect(todoFormValidate.date(null, { ...base, status: 'completed' })).toBe('Required')
    })

    it('returns null when null and status is pending', () => {
      expect(todoFormValidate.date(null, { ...base, status: 'pending' })).toBeNull()
    })

    it('returns null when date is provided', () => {
      expect(todoFormValidate.date('2026-01-01', { ...base, status: 'completed' })).toBeNull()
    })
  })
})
