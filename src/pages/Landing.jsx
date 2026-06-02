import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Mail, Lock, Eye, EyeOff } from "lucide-react";

export default function Landing() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("home"); // home | login | signup
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", penName: "" });

  function handleAnon() {
    navigate("/age-gate", { state: { type: "anon" } });
  }
  function handleLogin(e) {
    e.preventDefault();
    // TODO: real auth — skip to map for now
    navigate("/map");
  }
  function handleSignup(e) {
    e.preventDefault();
    navigate("/age-gate", { state: { type: "user", ...form } });
  }

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden bg-[#0a0a0f]">
      {/* Background gradient blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-brand-purple opacity-10 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-brand-red opacity-10 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-sm px-6 flex flex-col items-center gap-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-1 mb-2">
          <span className="text-4xl font-black tracking-tight text-white">Thots.</span>
          <div className="flex items-center gap-1 text-slate-400 text-sm">
            <MapPin size={14} />
            <span>For the curious</span>
          </div>
        </div>

        {mode === "home" && (
          <div className="w-full flex flex-col gap-3">
            <button
              onClick={() => setMode("login")}
              className="w-full py-3.5 rounded-2xl bg-brand-blue text-white font-semibold text-base hover:bg-blue-500 transition-colors cursor-pointer"
            >
              Log in
            </button>
            <button
              onClick={() => setMode("signup")}
              className="w-full py-3.5 rounded-2xl bg-white/10 border border-white/15 text-white font-semibold text-base hover:bg-white/15 transition-colors cursor-pointer"
            >
              Create account
            </button>
            <div className="flex items-center gap-3 my-1">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-slate-500 text-sm">or</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>
            <button
              onClick={handleAnon}
              className="w-full py-3.5 rounded-2xl bg-[#1a1a2e] border border-white/10 text-white font-semibold text-base hover:bg-[#22223a] transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <span className="text-lg">🎭</span>
              Use anonymously
            </button>
          </div>
        )}

        {mode === "login" && (
          <form onSubmit={handleLogin} className="w-full flex flex-col gap-3">
            <div className="relative">
              <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full bg-white/8 border border-white/10 rounded-2xl py-3.5 pl-11 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-blue transition-colors"
                required
              />
            </div>
            <div className="relative">
              <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="w-full bg-white/8 border border-white/10 rounded-2xl py-3.5 pl-11 pr-11 text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-blue transition-colors"
                required
              />
              <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white cursor-pointer">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="text-right">
              <button type="button" className="text-sm text-slate-400 underline cursor-pointer hover:text-white">Forgot password?</button>
            </div>
            <button type="submit" className="w-full py-3.5 rounded-2xl bg-brand-blue text-white font-semibold text-base hover:bg-blue-500 transition-colors cursor-pointer mt-1">
              Log in
            </button>
            <button type="button" onClick={() => setMode("home")} className="text-slate-500 text-sm hover:text-white cursor-pointer">
              ← Back
            </button>
          </form>
        )}

        {mode === "signup" && (
          <form onSubmit={handleSignup} className="w-full flex flex-col gap-3">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-base">@</span>
              <input
                type="text"
                placeholder="Pen name"
                value={form.penName}
                onChange={e => setForm(f => ({ ...f, penName: e.target.value }))}
                maxLength={24}
                className="w-full bg-white/8 border border-white/10 rounded-2xl py-3.5 pl-10 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-purple transition-colors"
                required
              />
            </div>
            <div className="relative">
              <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full bg-white/8 border border-white/10 rounded-2xl py-3.5 pl-11 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-purple transition-colors"
                required
              />
            </div>
            <div className="relative">
              <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="w-full bg-white/8 border border-white/10 rounded-2xl py-3.5 pl-11 pr-11 text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-purple transition-colors"
                required
              />
              <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white cursor-pointer">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <button type="submit" className="w-full py-3.5 rounded-2xl bg-brand-purple text-white font-semibold text-base hover:bg-violet-500 transition-colors cursor-pointer mt-1">
              Create account
            </button>
            <button type="button" onClick={() => setMode("home")} className="text-slate-500 text-sm hover:text-white cursor-pointer">
              ← Back
            </button>
          </form>
        )}

        {/* Legal */}
        <p className="text-center text-xs text-slate-600 leading-relaxed px-2">
          By entering, you agree to our{" "}
          <a href="#" className="underline text-slate-500 hover:text-white">Terms of Service</a>,{" "}
          <a href="#" className="underline text-slate-500 hover:text-white">Privacy Policy</a>, and{" "}
          <a href="#" className="underline text-slate-500 hover:text-white">Safety Policy</a>.{" "}
          You must be 18 or older to enter.
        </p>
      </div>
    </div>
  );
}
