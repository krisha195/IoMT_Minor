import { useState } from 'react'
import api from '../api'

const QUICK_PROMPTS = [
  "How should I change and care for the wound dressing?",
  "What should I do if the patient feels dizzy or lightheaded?",
  "What is the schedule for pain medications today?",
  "What warning signs require immediate doctor contact?",
  "What care tasks are still pending for today?"
]

export default function AICaregiverCopilot({ patientId, patientName = 'Patient' }) {
  const [messages, setMessages] = useState([
    {
      sender: 'copilot',
      text: `Hello! I am your AI Home Recovery Copilot for ${patientName}. I can help you understand the doctor's discharge instructions, medication timing, wound care, and tell you when to escalate concerning symptoms to the surgical team. How can I assist you today?`
    }
  ])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)

  const askCopilot = async (questionText) => {
    const q = questionText || query
    if (!q.trim()) return

    const newMsgs = [...messages, { sender: 'user', text: q }]
    setMessages(newMsgs)
    setQuery('')
    setLoading(true)

    try {
      const { data } = await api.post(`/api/recovery/${patientId}/copilot/ask`, { question: q })
      setMessages([...newMsgs, {
        sender: 'copilot',
        text: data.answer,
        escalation: data.escalation_recommended,
        disclaimer: data.disclaimer
      }])
    } catch {
      setMessages([...newMsgs, {
        sender: 'copilot',
        text: 'Sorry, I encountered an issue retrieving the care plan. Please consult your physician directly.'
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="saas-card" style={{ padding: 22, marginBottom: 22 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg,#0284c7,#2563eb)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: 'white',
          boxShadow: '0 2px 4px rgba(37,99,235,0.2)'
        }}>
          🩺
        </div>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            AI Caregiver Copilot for Home Recovery
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 12, margin: '2px 0 0 0' }}>
            Interactive recovery guide grounded in doctor discharge orders and active telemetry
          </p>
        </div>
      </div>

      {/* Quick Prompts */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {QUICK_PROMPTS.map((p, idx) => (
          <button
            key={idx}
            disabled={loading}
            onClick={() => askCopilot(p)}
            style={{
              padding: '6px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
              borderRadius: 20, color: 'var(--primary)', fontSize: 12, fontWeight: 500, cursor: 'pointer',
              transition: 'all 0.15s', boxShadow: 'var(--shadow-xs)'
            }}
            onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'var(--primary-light)' }}
            onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.background = 'var(--bg-surface)' }}
          >
            💬 {p}
          </button>
        ))}
      </div>

      {/* Chat Thread */}
      <div style={{
        background: 'var(--bg-canvas)', border: '1px solid var(--border-default)', borderRadius: 10,
        padding: 16, maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16
      }}>
        {messages.map((m, idx) => {
          const isUser = m.sender === 'user'
          return (
            <div key={idx} style={{
              alignSelf: isUser ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              background: isUser ? 'var(--primary)' : m.escalation ? '#fef2f2' : 'var(--bg-surface)',
              border: `1px solid ${m.escalation ? '#fecaca' : isUser ? 'var(--primary)' : 'var(--border-default)'}`,
              borderRadius: 10, padding: '12px 16px',
              boxShadow: 'var(--shadow-xs)',
              color: isUser ? '#ffffff' : 'var(--text-primary)'
            }}>
              <div style={{
                fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 5,
                color: isUser ? '#bfdbfe' : m.escalation ? 'var(--danger)' : 'var(--primary)'
              }}>
                {isUser ? 'Caregiver / Patient' : '🤖 Copilot Clinical Assistant'}
                {m.escalation && ' 🚨 CLINICAL ESCALATION ADVICE'}
              </div>

              <div style={{ fontSize: 13, whiteSpace: 'pre-line', lineHeight: 1.55 }}>
                {m.text}
              </div>

              {m.disclaimer && (
                <div style={{ fontSize: 10, color: 'var(--text-light)', marginTop: 8, fontStyle: 'italic', borderTop: '1px solid var(--border-default)', paddingTop: 4 }}>
                  {m.disclaimer}
                </div>
              )}
            </div>
          )
        })}

        {loading && (
          <div style={{ alignSelf: 'flex-start', color: 'var(--text-secondary)', fontSize: 12, padding: 8 }}>
            AI Copilot is reviewing verified recovery instructions...
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={(e) => { e.preventDefault(); askCopilot(); }} style={{ display: 'flex', gap: 10 }}>
        <input
          placeholder="Ask a question about wound care, medications, or post-op symptoms..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          disabled={loading}
          className="saas-input"
          style={{ flex: 1, padding: '10px 14px', fontSize: 13 }}
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="saas-btn saas-btn-primary"
          style={{ padding: '10px 20px', fontSize: 13 }}
        >
          Send
        </button>
      </form>
    </div>
  )
}


