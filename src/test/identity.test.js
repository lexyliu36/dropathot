import { describe, it, expect, beforeEach, vi } from 'vitest'
import { generatePenName, getOrCreateSession, updateSession, clearSession } from '../lib/identity.js'

// Mock fetch (used by clearSession)
globalThis.fetch = vi.fn(() => Promise.resolve())

// Mock import.meta.env
vi.stubGlobal('import', { meta: { env: { VITE_API_URL: 'http://localhost:4000' } } })

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('generatePenName', () => {
  it('returns a non-empty string', () => {
    expect(typeof generatePenName()).toBe('string')
    expect(generatePenName().length).toBeGreaterThan(0)
  })

  it('combines an adjective and a noun (no space, PascalCase)', () => {
    // Each word is capitalized and there's no space — matches /^[A-Z][a-z]+[A-Z][a-z]+$/
    expect(generatePenName()).toMatch(/^[A-Z][a-zA-Z]+$/)
  })

  it('produces different names across calls (probabilistic)', () => {
    const names = new Set(Array.from({ length: 20 }, generatePenName))
    expect(names.size).toBeGreaterThan(1)
  })
})

describe('getOrCreateSession', () => {
  it('creates a new session when localStorage is empty', () => {
    const session = getOrCreateSession()
    expect(session).toMatchObject({
      type: null,
      penName: null,
      ageVerified: false,
    })
    expect(typeof session.id).toBe('string')
    expect(session.id.length).toBeGreaterThan(0)
  })

  it('persists the session to localStorage', () => {
    getOrCreateSession()
    expect(localStorage.getItem('thots_session')).not.toBeNull()
  })

  it('returns the same session on repeated calls', () => {
    const a = getOrCreateSession()
    const b = getOrCreateSession()
    expect(a.id).toBe(b.id)
  })

  it('recovers a previously stored session', () => {
    const stored = { id: 'test-id', type: 'anon', penName: 'GhostEcho', ageVerified: true, createdAt: 0 }
    localStorage.setItem('thots_session', JSON.stringify(stored))
    const session = getOrCreateSession()
    expect(session.id).toBe('test-id')
    expect(session.penName).toBe('GhostEcho')
  })
})

describe('updateSession', () => {
  it('merges updates into the existing session', () => {
    getOrCreateSession()
    const updated = updateSession({ ageVerified: true, type: 'anon' })
    expect(updated.ageVerified).toBe(true)
    expect(updated.type).toBe('anon')
  })

  it('preserves fields not included in the update', () => {
    const original = getOrCreateSession()
    const updated = updateSession({ ageVerified: true })
    expect(updated.id).toBe(original.id)
    expect(updated.createdAt).toBe(original.createdAt)
  })

  it('persists the updated session to localStorage', () => {
    getOrCreateSession()
    updateSession({ penName: 'SilentDrifter' })
    const stored = JSON.parse(localStorage.getItem('thots_session'))
    expect(stored.penName).toBe('SilentDrifter')
  })
})

describe('clearSession', () => {
  it('removes the session from localStorage', () => {
    getOrCreateSession()
    clearSession()
    expect(localStorage.getItem('thots_session')).toBeNull()
  })

  it('calls /auth/logout after clearing', () => {
    getOrCreateSession()
    clearSession()
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/logout'),
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('creates a fresh session after clear', () => {
    const original = getOrCreateSession()
    clearSession()
    const fresh = getOrCreateSession()
    expect(fresh.id).not.toBe(original.id)
  })
})
