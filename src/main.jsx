import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
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

function RequireAuth({ children }) {
  const session = getOrCreateSession()
  const enrolled = session.ageVerified === true &&
    (session.type === "anon" || session.type === "user")
  if (!enrolled) return <Navigate to="/" replace />
  return children
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
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
  </StrictMode>
)
