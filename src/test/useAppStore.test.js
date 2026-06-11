import { describe, it, expect, beforeEach } from 'vitest'
import useAppStore from '../stores/useAppStore.js'

// Reset store state before each test
beforeEach(() => {
  useAppStore.setState({
    session: null,
    thots: [],
    selectedThot: null,
    hypedThotIds: new Set(),
    blockedSessions: new Set(),
    reportedThotIds: new Set(),
    composing: false,
    radius: 625,
  })
})

const makeThot = (overrides = {}) => ({
  id: crypto.randomUUID(),
  content: 'test thot',
  session_id: 'session-abc',
  created_at: new Date().toISOString(),
  hype_count: 0,
  ...overrides,
})

describe('addThot', () => {
  it('adds a thot to the store', () => {
    const t = makeThot()
    useAppStore.getState().addThot(t)
    expect(useAppStore.getState().thots).toHaveLength(1)
    expect(useAppStore.getState().thots[0].id).toBe(t.id)
  })

  it('deduplicates — does not add the same thot twice', () => {
    const t = makeThot()
    useAppStore.getState().addThot(t)
    useAppStore.getState().addThot(t)
    expect(useAppStore.getState().thots).toHaveLength(1)
  })

  it('replaces previous thot from the same session (one active pin per user)', () => {
    const first = makeThot({ id: 'id-1', session_id: 'sess-1' })
    const second = makeThot({ id: 'id-2', session_id: 'sess-1' })
    useAppStore.getState().addThot(first)
    useAppStore.getState().addThot(second)
    const thots = useAppStore.getState().thots
    expect(thots).toHaveLength(1)
    expect(thots[0].id).toBe('id-2')
  })

  it('does not add a thot from a blocked session', () => {
    useAppStore.setState({ blockedSessions: new Set(['blocked-sess']) })
    const t = makeThot({ session_id: 'blocked-sess' })
    useAppStore.getState().addThot(t)
    expect(useAppStore.getState().thots).toHaveLength(0)
  })
})

describe('removeThot', () => {
  it('removes a thot by id', () => {
    const t = makeThot({ id: 'rem-1' })
    useAppStore.setState({ thots: [t] })
    useAppStore.getState().removeThot('rem-1')
    expect(useAppStore.getState().thots).toHaveLength(0)
  })

  it('clears selectedThot when the deleted thot is selected', () => {
    const t = makeThot({ id: 'sel-1' })
    useAppStore.setState({ thots: [t], selectedThot: t })
    useAppStore.getState().removeThot('sel-1')
    expect(useAppStore.getState().selectedThot).toBeNull()
  })

  it('keeps selectedThot when a different thot is deleted', () => {
    const a = makeThot({ id: 'a' })
    const b = makeThot({ id: 'b' })
    useAppStore.setState({ thots: [a, b], selectedThot: a })
    useAppStore.getState().removeThot('b')
    expect(useAppStore.getState().selectedThot?.id).toBe('a')
  })
})

describe('setThots', () => {
  it('replaces the thot list', () => {
    const thots = [makeThot(), makeThot()]
    useAppStore.getState().setThots(thots)
    expect(useAppStore.getState().thots).toHaveLength(2)
  })

  it('filters out thots from blocked sessions', () => {
    useAppStore.setState({ blockedSessions: new Set(['bad-sess']) })
    const thots = [
      makeThot({ session_id: 'good-sess' }),
      makeThot({ session_id: 'bad-sess' }),
    ]
    useAppStore.getState().setThots(thots)
    expect(useAppStore.getState().thots).toHaveLength(1)
    expect(useAppStore.getState().thots[0].session_id).toBe('good-sess')
  })
})

describe('toggleHypedThot', () => {
  it('adds thotId to hypedThotIds when hyping', () => {
    useAppStore.getState().toggleHypedThot('thot-1', true, 5)
    expect(useAppStore.getState().hypedThotIds.has('thot-1')).toBe(true)
  })

  it('removes thotId from hypedThotIds when un-hyping', () => {
    useAppStore.setState({ hypedThotIds: new Set(['thot-1']) })
    useAppStore.getState().toggleHypedThot('thot-1', false, 3)
    expect(useAppStore.getState().hypedThotIds.has('thot-1')).toBe(false)
  })

  it('updates hype_count on the matching thot', () => {
    const t = makeThot({ id: 'thot-1', hype_count: 2 })
    useAppStore.setState({ thots: [t] })
    useAppStore.getState().toggleHypedThot('thot-1', true, 10)
    expect(useAppStore.getState().thots[0].hype_count).toBe(10)
  })
})

describe('blockSession', () => {
  it('adds session to blockedSessions', () => {
    useAppStore.getState().blockSession('evil-sess')
    expect(useAppStore.getState().blockedSessions.has('evil-sess')).toBe(true)
  })

  it('removes all thots from the blocked session', () => {
    const t = makeThot({ session_id: 'evil-sess' })
    useAppStore.setState({ thots: [t] })
    useAppStore.getState().blockSession('evil-sess')
    expect(useAppStore.getState().thots).toHaveLength(0)
  })

  it('keeps thots from other sessions', () => {
    const good = makeThot({ session_id: 'good-sess' })
    const bad = makeThot({ session_id: 'evil-sess' })
    useAppStore.setState({ thots: [good, bad] })
    useAppStore.getState().blockSession('evil-sess')
    expect(useAppStore.getState().thots).toHaveLength(1)
    expect(useAppStore.getState().thots[0].session_id).toBe('good-sess')
  })
})

describe('unblockSession', () => {
  it('removes session from blockedSessions', () => {
    useAppStore.setState({ blockedSessions: new Set(['sess-x']) })
    useAppStore.getState().unblockSession('sess-x')
    expect(useAppStore.getState().blockedSessions.has('sess-x')).toBe(false)
  })
})
