import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import * as Sentry from "@sentry/react"
import "./index.css"
import Landing from "./pages/Landing"
import AgeGate from "./pages/AgeGate"
import Map from "./pages/Map"
import VerifyEmail from "./pages/VerifyEmail"
import ThotPage from "./pages/ThotPage"
import CommentPage from "./pages/CommentPage"
import TermsPage from "./pages/legal/TermsPage"
import PrivacyPage from "./pages/legal/PrivacyPage"
import SafetyPage from "./pages/legal/SafetyPage"
import AdminDashboard from "./pages/AdminDashboard"
import { getOrCreateSession } from "./lib/identity"

// Init Sentry — only activates when VITE_SENTRY_DSN is set (prod/staging).
// In local dev without the env var this is a no-op.
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE, // "production" | "development"
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,   // mask PII in session replays
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate: 0.2,       // 20% of transactions for perf monitoring
    replaysSessionSampleRate: 0.05,   // 5% of sessions recorded
    replaysOnErrorSampleRate: 1.0,    // 100% of sessions with errors recorded
  })
}

// iOS Safari zooms in when an input is focused. On blur, briefly set
// user-scalable=0 (stronger than maximum-scale alone) to force the browser
// to snap back to 1x, then restore the original viewport after 300ms so
// pinch-zoom on the map still works.
;(function () {
  const meta = document.querySelector('meta[name=viewport]')
  if (!meta) return
  const orig = meta.content
  document.addEventListener('focusout', (e) => {
    if (!e.target.matches('input, textarea, select')) return
    meta.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0'
    setTimeout(() => { meta.content = orig }, 300)
  })
})()

function RequireAuth({ children }) {
  const session = getOrCreateSession()
  const enrolled = session.ageVerified === true && (session.type === 'user' || session.type === 'viewer')
  if (!enrolled) return <Navigate to="/" replace />
  return children
}

// Fallback UI shown when an unhandled React error is caught
function ErrorFallback({ error }) {
  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: '12px',
      background: '#0a0a0f', color: '#fff', fontFamily: 'Inter, sans-serif',
      padding: '24px', textAlign: 'center',
    }}>
      <p style={{ fontSize: '32px', margin: 0 }}>💥</p>
      <p style={{ fontWeight: 600, fontSize: '16px', margin: 0 }}>Something went wrong</p>
      <p style={{ color: '#64748b', fontSize: '13px', margin: 0, maxWidth: '280px' }}>
        {error?.message || 'An unexpected error occurred.'}
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{
          marginTop: '8px', padding: '8px 20px', borderRadius: '10px',
          background: '#7c3aed', color: '#fff', border: 'none',
          fontSize: '14px', fontWeight: 600, cursor: 'pointer',
        }}
      >
        Reload
      </button>
    </div>
  )
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={ErrorFallback} showDialog={false}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/age-gate" element={<AgeGate />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/map" element={<RequireAuth><Map /></RequireAuth>} />
          <Route path="/t/:id" element={<ThotPage />} />
          <Route path="/c/:id" element={<CommentPage />} />
          <Route path="/legal/terms" element={<TermsPage />} />
          <Route path="/legal/privacy" element={<PrivacyPage />} />
          <Route path="/legal/safety" element={<SafetyPage />} />
          <Route path="/drop-ops" element={<AdminDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </Sentry.ErrorBoundary>
  </StrictMode>
)
