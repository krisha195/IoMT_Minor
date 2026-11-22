const RANGES = { hr: [40,150], spo2: [90,100], temperature: [25.0, 35.0] }

function getStatus(vital, value, fingerDetected) {
  if (vital === 'motion' || vital === 'motion_status') {
    if (!value) return 'none'
    const val = String(value).toUpperCase()
    if (val === 'STABLE') return 'normal'
    if (val === 'LOW') return 'info'
    if (val === 'MODERATE') return 'warning'
    if (val === 'HIGH') return 'critical'
    return 'none'
  }
  if ((vital === 'hr' || vital === 'spo2') && (fingerDetected === false || value == null || Number(value) <= 0)) {
    return 'detached'
  }
  if (value == null) return 'none'
  const [lo, hi] = RANGES[vital] || [0, 9999]
  if (vital === 'spo2' && value < 90) return 'critical'
  if (vital === 'temperature' && value >= 36.5) return 'critical'
  if (value < lo || value > hi) return 'warning'
  return 'normal'
}

const STATUS_TOKENS = {
  normal: {
    bg: '#f0fdf4',
    border: '#bbf7d0',
    text: '#166534',
    dot: '#10b981',
    label: 'Normal'
  },
  info: {
    bg: '#eff6ff',
    border: '#bfdbfe',
    text: '#1e40af',
    dot: '#3b82f6',
    label: 'Low Motion'
  },
  warning: {
    bg: '#fffbeb',
    border: '#fde68a',
    text: '#92400e',
    dot: '#f59e0b',
    label: 'Warning'
  },
  critical: {
    bg: '#fef2f2',
    border: '#fecaca',
    text: '#991b1b',
    dot: '#ef4444',
    label: 'Critical'
  },
  detached: {
    bg: '#fff7ed',
    border: '#fed7aa',
    text: '#c2410c',
    dot: '#ea580c',
    label: 'No Finger Contact'
  },
  none: {
    bg: '#f8fafc',
    border: '#e2e8f0',
    text: '#64748b',
    dot: '#cbd5e1',
    label: 'No Signal'
  }
}

export default function VitalCard({ label, value, unit, icon, vital, fingerDetected, subtitle }) {
  const isDetached = (vital === 'hr' || vital === 'spo2') && (fingerDetected === false || value == null || Number(value) <= 0)
  const status = vital ? getStatus(vital, value, fingerDetected) : 'none'
  const token = STATUS_TOKENS[status]
  const isLive = Boolean(vital && value != null && !isDetached)

  // Determine dynamic badge label
  let badgeLabel = token.label
  if (vital === 'motion' || vital === 'motion_status') {
    if (value) badgeLabel = String(value).toUpperCase()
  } else if (isDetached) {
    badgeLabel = 'No Finger'
  }

  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-lg)',
      padding: '20px 22px',
      flex: 1,
      minWidth: 170,
      boxShadow: 'var(--shadow-sm)',
      position: 'relative',
      overflow: 'hidden',
      transition: 'all 0.2s ease'
    }}>
      {/* Top status accent line */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        background: token.dot
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{
            color: 'var(--text-muted)',
            fontSize: 11.5,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em'
          }}>
            {label}
          </div>
          {subtitle && (
            <div style={{ color: 'var(--text-muted)', fontSize: 10.5, marginTop: 1 }}>
              {subtitle}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isLive && (
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: token.dot,
              display: 'inline-block',
              animation: 'pulseLive 2s ease-in-out infinite'
            }} title="Live IoMT Telemetry" />
          )}
          <span style={{ fontSize: 18, opacity: 0.85 }}>{icon}</span>
        </div>
      </div>

      <div style={{
        color: isDetached ? 'var(--text-muted)' : 'var(--text-primary)',
        fontSize: typeof value === 'string' && value.length > 5 ? 24 : 32,
        fontWeight: 800,
        lineHeight: 1.1,
        letterSpacing: '-0.02em',
        marginBottom: 10
      }}>
        {isDetached ? (
          <span style={{ fontSize: 18, fontWeight: 600, color: '#ea580c' }}>
            Detached
          </span>
        ) : (
          value ?? '—'
        )}
        {unit && !isDetached && (
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)', marginLeft: 4 }}>
            {unit}
          </span>
        )}
      </div>

      {vital && (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          background: token.bg,
          border: `1px solid ${token.border}`,
          color: token.text,
          fontSize: 11,
          fontWeight: 600,
          padding: '2px 8px',
          borderRadius: 'var(--radius-full)'
        }}>
          <span style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: token.dot
          }} />
          {badgeLabel}
        </div>
      )}
    </div>
  )
}
