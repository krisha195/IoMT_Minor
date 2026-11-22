import { useNavigate } from 'react-router-dom'

export default function Sidebar({ role, careStatus, active, setActive, unread }) {
  const navigate = useNavigate()
  const logout = () => { localStorage.clear(); navigate('/login') }

  const isRecovery = careStatus === 'POST_TREATMENT_RECOVERY'
  const isCompleted = careStatus === 'RECOVERY_COMPLETED'

  // Patient navigation links conditioned on eligibility
  let patientLinks = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard' },
  ]

  if (isRecovery) {
    patientLinks.push(
      { id: 'tasks',       icon: '📋', label: 'Care Checklist' },
      { id: 'medications', icon: '💊', label: 'Medications' },
      { id: 'copilot',     icon: '🩺', label: 'Recovery Copilot' },
      { id: 'history',     icon: '📜', label: 'Surgery History' },
      { id: 'progress',    icon: '📈', label: 'Recovery Progress' }
    )
  } else if (isCompleted) {
    patientLinks.push(
      { id: 'copilot',     icon: '🩺', label: 'AI Health Copilot' },
      { id: 'history',     icon: '📜', label: 'Treatment History' }
    )
  } else {
    patientLinks.push(
      { id: 'copilot',     icon: '🩺', label: 'AI Health Copilot' }
    )
  }

  patientLinks.push(
    { id: 'vitals',  icon: '📉', label: 'Vitals History' },
    { id: 'alerts',  icon: '🔔', label: 'Alerts' },
    { id: 'chat',    icon: '💬', label: 'Chat', badge: unread },
    { id: 'profile', icon: '👤', label: 'Profile' }
  )

  const doctorLinks = [
    { id: 'dashboard', icon: '📊', label: 'Overview' },
    { id: 'patients',  icon: '👥', label: 'Patients' },
    { id: 'alerts',    icon: '🚨', label: 'Alerts' },
    { id: 'chat',      icon: '💬', label: 'Chat', badge: unread },
    { id: 'profile',   icon: '👤', label: 'Profile' },
  ]

  const links = role === 'doctor' ? doctorLinks : patientLinks

  return (
    <aside style={{
      width: 240, background: '#ffffff', borderRight: '1px solid var(--border-default)',
      display: 'flex', flexDirection: 'column', height: '100vh',
      position: 'sticky', top: 0, flexShrink: 0, zIndex: 60
    }}>
      {/* Brand */}
      <div style={{ padding: '20px 18px', borderBottom: '1px solid var(--border-default)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 'var(--radius-sm)',
            background: 'linear-gradient(135deg,#2563eb,#3b82f6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
            boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)', color: '#ffffff'
          }}>🫀</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              PulseNet
            </div>
            <div style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600, letterSpacing: '0.02em' }}>
              Every Pulse Matters
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '16px 12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {links.map(l => {
          const isAct = active === l.id
          return (
            <button key={l.id} onClick={() => setActive(l.id)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
              background: isAct ? 'var(--primary-light)' : 'transparent',
              color: isAct ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: isAct ? 600 : 500,
              fontSize: 13, transition: 'all 0.15s ease',
              position: 'relative',
              textAlign: 'left'
            }}
              onMouseOver={e => { if (!isAct) e.currentTarget.style.background = 'var(--bg-subtle)' }}
              onMouseOut={e => { if (!isAct) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ fontSize: 16, opacity: isAct ? 1 : 0.8 }}>{l.icon}</span>
              <span style={{ flex: 1 }}>{l.label}</span>
              {l.badge > 0 && (
                <span style={{
                  background: 'var(--danger)', color: '#ffffff',
                  fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 'var(--radius-full)'
                }}>{l.badge}</span>
              )}
            </button>
          )
        })}
      </nav>

      {/* User Footer */}
      <div style={{ padding: '16px 18px', borderTop: '1px solid var(--border-default)', background: 'var(--bg-subtle)' }}>
        <button onClick={logout} style={{
          width: '100%', padding: '8px 12px', background: '#ffffff',
          border: '1px solid var(--border-default)', color: 'var(--text-secondary)', borderRadius: 'var(--radius-sm)',
          cursor: 'pointer', fontSize: 12.5, fontWeight: 500, transition: 'all 0.15s ease',
          boxShadow: 'var(--shadow-xs)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
        }}
          onMouseOver={e => { e.currentTarget.style.borderColor='var(--danger-border)'; e.currentTarget.style.color='var(--danger)'; e.currentTarget.style.background='var(--danger-bg)' }}
          onMouseOut={e  => { e.currentTarget.style.borderColor='var(--border-default)'; e.currentTarget.style.color='var(--text-secondary)'; e.currentTarget.style.background='#ffffff' }}
        >
          <span>🚪</span> Sign Out
        </button>
      </div>
    </aside>
  )
}
