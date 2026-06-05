import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { Mail, ArrowLeft, RotateCcw } from "lucide-react"
import { resendVerification } from "../lib/auth"

const COOLDOWN_SECONDS = 60

export default function VerifyEmail() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const email = state?.email

  const [cooldown, setCooldown] = useState(0)
  const [status, setStatus] = useState(null) // null | 'sending' | 'sent' | 'error'
  const [errorMsg, setErrorMsg] = useState("")

  // Redirect if landed here without an email
  useEffect(() => {
    if (!email) navigate("/", { replace: true })
  }, [email])

  // Countdown timer
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  async function handleResend() {
    setStatus("sending")
    setErrorMsg("")
    try {
      await resendVerification(email)
      setStatus("sent")
      setCooldown(COOLDOWN_SECONDS)
    } catch (err) {
      setStatus("error")
      setErrorMsg(err.message)
    }
  }

  if (!email) return null

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden bg-[#0a0a0f] px-6">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-brand-blue opacity-8 blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        <div className="bg-[#0e0e1a] border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
          <div className="h-1.5 bg-gradient-to-r from-brand-blue to-brand-purple" />

          <div className="p-8 flex flex-col items-center text-center gap-5">
            {/* Icon */}
            <div className="w-16 h-16 rounded-2xl bg-brand-blue/10 border border-brand-blue/20 flex items-center justify-center">
              <Mail size={28} className="text-brand-blue" />
            </div>

            {/* Heading */}
            <div>
              <h2 className="text-white font-bold text-xl mb-2">Check your email</h2>
              <p className="text-slate-300 text-sm leading-relaxed">
                We sent a verification link to
              </p>
              <p className="text-white font-semibold text-sm mt-1 break-all">{email}</p>
            </div>

            {/* Instructions */}
            <p className="text-slate-500 text-xs leading-relaxed">
              Click the link in the email to verify your account, then come back here to sign in.
              Check your spam folder if you don't see it.
            </p>

            {/* Resend */}
            <div className="w-full flex flex-col gap-2">
              {status === "sent" && (
                <p className="text-green-400 text-xs font-medium">
                  ✓ New verification email sent
                </p>
              )}
              {status === "error" && (
                <p className="text-red-400 text-xs">{errorMsg}</p>
              )}

              <button
                onClick={handleResend}
                disabled={status === "sending" || cooldown > 0}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-white/10 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                style={{ color: cooldown > 0 ? '#475569' : '#fff' }}
              >
                <RotateCcw size={14} className={status === "sending" ? "animate-spin" : ""} />
                {status === "sending"
                  ? "Sending…"
                  : cooldown > 0
                  ? `Resend in ${cooldown}s`
                  : "Resend verification email"}
              </button>
            </div>

            {/* Back to sign in */}
            <button
              onClick={() => navigate("/", { state: { openLogin: true } })}
              className="flex items-center gap-1.5 text-slate-500 hover:text-white text-sm transition-colors cursor-pointer"
            >
              <ArrowLeft size={14} />
              Back to sign in
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-slate-700 mt-4">
          Wrong email?{" "}
          <button
            onClick={() => navigate("/", { state: { openSignup: true } })}
            className="text-slate-500 underline hover:text-white cursor-pointer"
          >
            Start over
          </button>
        </p>
      </div>
    </div>
  )
}
