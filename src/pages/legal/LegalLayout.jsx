import { useNavigate } from 'react-router-dom'
import { ArrowLeft, MapPin } from 'lucide-react'

export default function LegalLayout({ title, updated, children }) {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-[#0a0a0f]" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-white/8 bg-[#0a0a0f]/95 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)}
            className="text-slate-500 hover:text-white transition-colors p-1 -ml-1 cursor-pointer"
            style={{ background: 'none', border: 'none' }}>
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <MapPin size={15} style={{ color: '#e11d48' }} />
            <span className="text-white font-bold text-sm tracking-tight">drop-a-thot</span>
          </div>
          <span className="text-slate-600 text-sm">/ {title}</span>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-6 py-10 pb-20">
        <h1 className="text-white text-2xl font-bold mb-1">{title}</h1>
        <p className="text-slate-500 text-sm mb-10">Last updated: {updated}</p>
        <div className="prose-legal">{children}</div>
      </div>

      <style>{`
        .prose-legal h2 {
          color: #fff;
          font-size: 1rem;
          font-weight: 700;
          margin-top: 2rem;
          margin-bottom: 0.5rem;
          padding-bottom: 0.4rem;
          border-bottom: 1px solid rgba(255,255,255,0.07);
        }
        .prose-legal p {
          color: #94a3b8;
          font-size: 0.875rem;
          line-height: 1.75;
          margin-bottom: 0.85rem;
        }
        .prose-legal ul {
          list-style: disc;
          margin-left: 1.25rem;
          margin-bottom: 0.85rem;
        }
        .prose-legal li {
          color: #94a3b8;
          font-size: 0.875rem;
          line-height: 1.75;
          margin-bottom: 0.25rem;
        }
        .prose-legal a {
          color: #7c3aed;
          text-decoration: underline;
        }
        .prose-legal strong {
          color: #cbd5e1;
          font-weight: 600;
        }
        .prose-legal .callout {
          background: rgba(225,29,72,0.08);
          border: 1px solid rgba(225,29,72,0.2);
          border-radius: 0.75rem;
          padding: 0.875rem 1rem;
          margin-bottom: 1rem;
          color: #fca5a5;
          font-size: 0.8125rem;
          line-height: 1.6;
        }
      `}</style>
    </div>
  )
}
