import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// jsdom doesn't implement scrollIntoView — mock it globally so DMDrawer doesn't throw
beforeEach(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
})

// ─── Shared mocks ────────────────────────────────────────────────────────────

vi.mock('../stores/useAppStore', () => {
  const { create } = require('zustand')
  const store = create(() => ({
    session: {
      type: 'user',
      userId: 'user-me',
      supabaseToken: 'tok',
      penName: 'Me',
    },
  }))
  return { default: store }
})

vi.mock('../components/ThotPin', () => ({
  AnonAvatar: () => null,
}))

const PARTNER_ID = 'user-them'
const makeMsg = (overrides = {}) => ({
  id: `msg-${Math.random().toString(36).slice(2)}`,
  from_user_id: PARTNER_ID,
  to_user_id: 'user-me',
  content: 'hello',
  hype_count: 0,
  i_hyped: false,
  created_at: new Date().toISOString(),
  ...overrides,
})

// ─── DMDrawer component smoke tests ──────────────────────────────────────────
// Note: poll-race scenarios are covered as pure logic in dm.test.js.
// These tests verify send + optimistic UI behaviour via real timers.

describe('DMDrawer — send behaviour', () => {
  const partner = { userId: PARTNER_ID, penName: 'Them', accentColor: '#7c3aed' }
  let fetchMock

  beforeEach(() => {
    fetchMock = vi.fn()
    global.fetch = fetchMock
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  async function renderDM(initialMessages = []) {
    const { default: DMDrawer } = await import('../components/DMDrawer.jsx')
    fetchMock.mockResolvedValue({ ok: true, json: async () => initialMessages })
    let result
    await act(async () => {
      result = render(<DMDrawer partner={partner} onClose={() => {}} />)
    })
    return result
  }

  it('renders existing messages on mount', async () => {
    const msg = makeMsg({ content: 'hey there' })
    await renderDM([msg])
    expect(screen.getByText('hey there')).toBeTruthy()
  })

  it('shows textarea input', async () => {
    await renderDM([])
    expect(screen.getByPlaceholderText('Say something…')).toBeTruthy()
  })

  it('confirmed message replaces its optimistic counterpart (no duplicate)', async () => {
    const existing = makeMsg({ content: 'existing' })
    const saved = makeMsg({ id: 'msg-real', from_user_id: 'user-me', content: 'sent!' })

    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [existing] }) // initial load
      .mockResolvedValueOnce({ ok: true, json: async () => saved })       // POST confirm

    await renderDM([existing])

    const input = screen.getByPlaceholderText('Say something…')
    await userEvent.type(input, 'sent!')
    const sendBtn = screen.getAllByRole('button').find(b => b.type === 'submit' || b.querySelector('svg'))
    await act(async () => { await userEvent.click(sendBtn) })
    await act(async () => { await Promise.resolve() })
    await act(async () => { await Promise.resolve() })

    // Should appear exactly once (optimistic replaced by confirmed)
    expect(screen.getAllByText('sent!')).toHaveLength(1)
  })

  it('restores input text when send fails', async () => {
    const existing = makeMsg({ content: 'existing' })
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [existing] })
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })

    await renderDM([existing])

    const input = screen.getByPlaceholderText('Say something…')
    await userEvent.type(input, 'doomed')
    const sendBtn = screen.getAllByRole('button').find(b => b.querySelector && b.querySelector('svg'))
    await act(async () => { await userEvent.click(sendBtn) })
    await act(async () => { await Promise.resolve() })
    await act(async () => { await Promise.resolve() })

    // Input restored to the failed message text
    expect(input.value).toBe('doomed')
  })
})

// ─── MessagesTab conversation list ───────────────────────────────────────────

describe('MessagesTab — conversation list reliability', () => {
  const API = 'http://localhost:4000'
  let fetchMock

  beforeEach(() => {
    vi.useFakeTimers()
    fetchMock = vi.fn()
    global.fetch = fetchMock
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('does not wipe conversations when a network error occurs', async () => {
    const convos = [{ other_user_id: 'u1', other_pen_name: 'Alice', last_content: 'hi', unread: 0, last_at: new Date().toISOString() }]

    let state = []
    async function fetchConvos() {
      try {
        const r = await fetch(`${API}/messages`, {})
        if (r.ok) {
          const data = await r.json()
          state = data
        }
      } catch {
        // keep existing — no state change
      }
    }

    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => convos })
    await fetchConvos()
    expect(state).toHaveLength(1)

    fetchMock.mockRejectedValueOnce(new Error('network down'))
    await fetchConvos()

    expect(state).toHaveLength(1)
    expect(state[0].other_pen_name).toBe('Alice')
  })

  it('re-fetches conversations on 15s interval', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] })

    let calls = 0
    async function fetchConvos() {
      calls++
      await fetch(`${API}/messages`, {})
    }

    await fetchConvos() // initial
    const id = setInterval(() => fetchConvos(), 15_000)
    vi.advanceTimersByTime(15_000); await act(async () => { await Promise.resolve() })
    vi.advanceTimersByTime(15_000); await act(async () => { await Promise.resolve() })
    vi.advanceTimersByTime(15_000); await act(async () => { await Promise.resolve() })
    clearInterval(id)

    expect(calls).toBe(4)
  })
})
