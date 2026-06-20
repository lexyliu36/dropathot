import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('../stores/useAppStore', () => {
  const { create } = require('zustand')
  // Store has NO thots — simulates the thot being outside the current viewport
  const store = create(() => ({
    session: { type: 'user', id: 'user-me', supabaseToken: 'tok', penName: 'Aristotle' },
    thots: [],
    hypedThotIds: new Set(),
    reportedThotIds: new Set(),
    blockedSessions: new Set(),
    addReportedThot: vi.fn(),
    removeReportedThot: vi.fn(),
  }))
  return { default: store }
})

// Prevent inter-test cache pollution
vi.mock('../lib/thotCache', () => ({
  getCached: vi.fn().mockReturnValue(null),
  setCached: vi.fn(),
  appendCached: vi.fn(),
  removeFromCache: vi.fn(),
}))

vi.mock('../components/ThotPin', () => ({
  AnonAvatar: () => <div data-testid="anon-avatar" />,
}))

vi.mock('../components/CommentThread', () => ({
  default: () => <div data-testid="comment-thread" />,
}))

vi.mock('../components/ShareSheet', () => ({
  default: () => <div data-testid="share-sheet" />,
}))

vi.mock('../lib/geocode.js', () => ({
  reverseGeocode: vi.fn().mockResolvedValue('New York'),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}))

beforeEach(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()
const past   = new Date(Date.now() - 60 * 60 * 1000).toISOString()

function makeThot(overrides = {}) {
  return {
    id: 'thot-1',
    content: 'The line is not long on the NYC ferry',
    pen_name: 'Aristotle',
    session_id: 'user-me',
    user_id: 'user-me',
    lat: 40.7128,
    lng: -74.006,
    hype_count: 0,
    comment_count: 0,
    created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    expires_at: future,
    hidden: false,
    user_deleted: false,
    ...overrides,
  }
}

function mockFetchWith(thot) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ thots: [thot], total: 1 }),
  })
}

const { default: ProfileSheet } = await import('../components/ProfileSheet.jsx')

const SESSION = { type: 'user', id: 'user-me', penName: 'Aristotle' }

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ProfileSheet — ThotCard clickability', () => {
  it('calls onFlyTo when clicking an active thot that is outside the current viewport', async () => {
    const user = userEvent.setup()
    const thot = makeThot()
    mockFetchWith(thot)
    const onFlyTo = vi.fn()

    render(
      <ProfileSheet
        thot={thot}
        session={SESSION}
        isYouProfile={true}
        onFlyTo={onFlyTo}
        onClose={vi.fn()}
        onHype={vi.fn()}
      />
    )

    await screen.findByText('The line is not long on the NYC ferry')
    // getAllByText('Aristotle')[0] is the ProfileSheet header; [1] is the ThotCard row
    await user.click(screen.getAllByText('Aristotle')[1])

    expect(onFlyTo).toHaveBeenCalledWith(expect.objectContaining({ id: 'thot-1' }))
  })

  it('does NOT call onFlyTo for an expired thot', async () => {
    const user = userEvent.setup()
    const thot = makeThot({ expires_at: past })
    mockFetchWith(thot)
    const onFlyTo = vi.fn()

    render(
      <ProfileSheet
        thot={thot}
        session={SESSION}
        isYouProfile={true}
        onFlyTo={onFlyTo}
        onClose={vi.fn()}
        onHype={vi.fn()}
      />
    )

    await screen.findByText('The line is not long on the NYC ferry')
    await user.click(screen.getAllByText('Aristotle')[1])

    expect(onFlyTo).not.toHaveBeenCalled()
  })

  it('does NOT call onFlyTo for a hidden thot', async () => {
    const user = userEvent.setup()
    const thot = makeThot({ hidden: true })
    mockFetchWith(thot)
    const onFlyTo = vi.fn()

    render(
      <ProfileSheet
        thot={thot}
        session={SESSION}
        isYouProfile={true}
        onFlyTo={onFlyTo}
        onClose={vi.fn()}
        onHype={vi.fn()}
      />
    )

    await screen.findByText('The line is not long on the NYC ferry')
    await user.click(screen.getAllByText('Aristotle')[1])

    expect(onFlyTo).not.toHaveBeenCalled()
  })

  it('renders an active out-of-viewport thot at full opacity', async () => {
    const thot = makeThot()
    mockFetchWith(thot)

    const { container } = render(
      <ProfileSheet
        thot={thot}
        session={SESSION}
        isYouProfile={true}
        onFlyTo={vi.fn()}
        onClose={vi.fn()}
        onHype={vi.fn()}
      />
    )

    await screen.findByText('The line is not long on the NYC ferry')
    // Card must NOT carry opacity-50 for a live (non-expired, non-hidden) thot
    expect(container.querySelector('.opacity-50')).toBeNull()
  })

  it('renders an expired thot with opacity-50', async () => {
    const thot = makeThot({ expires_at: past })
    mockFetchWith(thot)

    const { container } = render(
      <ProfileSheet
        thot={thot}
        session={SESSION}
        isYouProfile={true}
        onFlyTo={vi.fn()}
        onClose={vi.fn()}
        onHype={vi.fn()}
      />
    )

    await screen.findByText('The line is not long on the NYC ferry')
    expect(container.querySelector('.opacity-50')).not.toBeNull()
  })
})
