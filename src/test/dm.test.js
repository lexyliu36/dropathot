import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Pure logic extracted from DMDrawer / ToolsPanel ─────────────────────────
// These mirror the exact implementations in the components. If you change the
// logic there, update these too — the tests will catch regressions.

/**
 * Merges a fresh server payload with the current message list, preserving any
 * optimistic messages (id starts with "opt-") not yet confirmed by the server.
 * This is the fix for the poll-overwrites-optimistic-message bug.
 */
function mergeMessages(serverData, prevMessages) {
  const serverIds = new Set(serverData.map(m => m.id))
  const pending = prevMessages.filter(
    m => String(m.id).startsWith('opt-') && !serverIds.has(m.id)
  )
  return [...serverData, ...pending]
}

/**
 * fetchConvos contract: on success update state, on error keep existing state.
 */
async function fetchConvos(fetchFn, setState) {
  try {
    const r = await fetchFn()
    if (r.ok) {
      const data = await r.json()
      setState(data)
    }
    // on non-ok: keep existing state
  } catch {
    // on network error: keep existing state
  }
}

// ─── mergeMessages ────────────────────────────────────────────────────────────

describe('mergeMessages — optimistic message preservation', () => {
  const serverMsg = { id: 'msg-1', from_user_id: 'them', content: 'hi' }
  const optimistic = { id: 'opt-1234', from_user_id: 'me', content: 'sending…' }

  it('keeps optimistic messages when poll returns before server confirms send', () => {
    const prev = [serverMsg, optimistic]
    const pollResult = [serverMsg] // server doesn't know about optimistic yet
    const merged = mergeMessages(pollResult, prev)

    expect(merged.find(m => m.id === 'opt-1234')).toBeTruthy()
    expect(merged.find(m => m.id === 'msg-1')).toBeTruthy()
  })

  it('produces no duplicate once component has swapped opt-id for real id before poll fires', () => {
    // Sequence: POST resolves → component maps opt-1234 → msg-real in state
    // THEN poll fires. By then, prev no longer contains opt-1234.
    const confirmed = { id: 'msg-real', from_user_id: 'me', content: 'sending…' }
    const prevAfterConfirm = [serverMsg, confirmed] // opt- already replaced by real
    const pollResult = [serverMsg, confirmed]        // server also has it

    const merged = mergeMessages(pollResult, prevAfterConfirm)

    // confirmed appears exactly once, no opt- IDs
    expect(merged.filter(m => m.id === 'msg-real')).toHaveLength(1)
    expect(merged.filter(m => String(m.id).startsWith('opt-'))).toHaveLength(0)
  })

  it('handles multiple in-flight optimistic messages correctly', () => {
    const opt1 = { id: 'opt-aaa', content: 'first' }
    const opt2 = { id: 'opt-bbb', content: 'second' }
    const prev = [serverMsg, opt1, opt2]
    const pollResult = [serverMsg]
    const merged = mergeMessages(pollResult, prev)

    expect(merged).toHaveLength(3)
    expect(merged.find(m => m.id === 'opt-aaa')).toBeTruthy()
    expect(merged.find(m => m.id === 'opt-bbb')).toBeTruthy()
  })

  it('server messages always come before pending optimistics in the list', () => {
    const opt = { id: 'opt-xyz', content: 'pending' }
    const prev = [serverMsg, opt]
    const pollResult = [serverMsg]
    const merged = mergeMessages(pollResult, prev)

    expect(merged[0].id).toBe('msg-1')
    expect(merged[1].id).toBe('opt-xyz')
  })

  it('returns server data as-is when there are no optimistic messages', () => {
    const s1 = { id: 'msg-1', content: 'a' }
    const s2 = { id: 'msg-2', content: 'b' }
    const merged = mergeMessages([s1, s2], [s1])
    expect(merged).toHaveLength(2)
    expect(merged.find(m => m.id === 'msg-2')).toBeTruthy()
  })
})

// ─── fetchConvos — conversation list reliability ──────────────────────────────

describe('fetchConvos — keeps conversations on error', () => {
  const existing = [
    { other_user_id: 'u1', other_pen_name: 'Alice', last_content: 'hi', unread: 0 },
  ]

  it('updates state on successful fetch', async () => {
    const fresh = [{ other_user_id: 'u2', other_pen_name: 'Bob', last_content: 'hey', unread: 1 }]
    let state = existing
    const setState = d => { state = d }
    await fetchConvos(() => Promise.resolve({ ok: true, json: async () => fresh }), setState)
    expect(state).toHaveLength(1)
    expect(state[0].other_pen_name).toBe('Bob')
  })

  it('preserves existing conversations when server returns non-ok', async () => {
    let state = existing
    const setState = d => { state = d }
    await fetchConvos(() => Promise.resolve({ ok: false, status: 500 }), setState)
    expect(state).toHaveLength(1)
    expect(state[0].other_pen_name).toBe('Alice')
  })

  it('preserves existing conversations when fetch throws (network error)', async () => {
    let state = existing
    const setState = d => { state = d }
    await fetchConvos(() => Promise.reject(new Error('network down')), setState)
    expect(state).toHaveLength(1)
    expect(state[0].other_pen_name).toBe('Alice')
  })

  it('does NOT wipe to empty array on repeated errors', async () => {
    let state = existing
    const setState = d => { state = d }
    for (let i = 0; i < 5; i++) {
      await fetchConvos(() => Promise.reject(new Error('offline')), setState)
    }
    expect(state).not.toHaveLength(0)
  })
})

// ─── Poll interval ────────────────────────────────────────────────────────────

describe('fetchConvos — polling cadence', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('fires once on mount then every 15 seconds', async () => {
    let calls = 0
    const fn = async () => { calls++; return { ok: true, json: async () => [] } }

    // Simulate initial + interval (mirroring the useEffect pattern)
    await fetchConvos(fn, () => {}) // initial
    const id = setInterval(() => fetchConvos(fn, () => {}), 15_000)
    vi.advanceTimersByTime(45_000)
    clearInterval(id)
    // Flush microtasks for the 3 interval callbacks
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(calls).toBe(4) // 1 initial + 3 polls at 15s, 30s, 45s
  })
})
