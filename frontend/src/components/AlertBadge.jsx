const SEVERITY = {
  critical: { bg: '#fef2f2', border: '#fecaca', tagBg: '#fee2e2', tagText: '#991b1b', text: '#7f1d1d', accent: '#ef4444' },
  high:     { bg: '#fff7ed', border: '#fed7aa', tagBg: '#ffedd5', tagText: '#9a3412', text: '#7c2d12', accent: '#f97316' },
  medium:   { bg: '#fffbeb', border: '#fde68a', tagBg: '#fef3c7', tagText: '#92400e', text: '#78350f', accent: '#f59e0b' },
  low:      { bg: '#f0fdf4', border: '#bbf7d0', tagBg: '#dcfce7', tagText: '#166534', text: '#14532d', accent: '#10b981' },
}

export default function AlertBadge({ alert, onAck, onDelete }) {
  const c = SEVERITY[alert.severity] || SEVERITY.low

  return (
    <div style={{
      background: c.bg,
      border: `1px solid ${c.border}`,
      borderLeft: `4px solid ${c.accent}`,
      borderRadius: 'var(--radius-sm)',
      padding: '12px 14px',
      marginBottom: 8,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 12,
      boxShadow: 'var(--shadow-xs)',
      transition: 'all 0.15s ease'
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
          <span style={{
            background: c.tagBg,
            color: c.tagText,
            fontSize: 10,
            fontWeight: 700,
            padding: '2px 7px',
            borderRadius: 'var(--radius-full)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            border: `1px solid ${c.border}`
          }}>
            {alert.severity}
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: 11.5, fontWeight: 500 }}>
            {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          {alert.acknowledged && (
            <span style={{ color: 'var(--success-text)', fontSize: 11, fontWeight: 600 }}>
              ✓ Acknowledged
            </span>
          )}
        </div>
        <p style={{ color: c.text, fontSize: 13, lineHeight: 1.45, margin: 0, fontWeight: 500 }}>
          {alert.message}
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 6 }}>
        {!alert.acknowledged && onAck && (
          <button onClick={() => onAck(alert.id)} style={{
            background: '#ffffff',
            border: `1px solid ${c.border}`,
            color: c.tagText,
            borderRadius: 'var(--radius-sm)',
            padding: '4px 10px',
            cursor: 'pointer',
            fontSize: 11.5,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            boxShadow: 'var(--shadow-xs)'
          }}
            onMouseOver={e => e.currentTarget.style.background = c.tagBg}
            onMouseOut={e => e.currentTarget.style.background = '#ffffff'}
          >
            Acknowledge
          </button>
        )}
        {onDelete && (
          <button onClick={() => onDelete(alert.id)} style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-light)',
            borderRadius: 'var(--radius-sm)',
            padding: '4px 6px',
            cursor: 'pointer',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
            onMouseOver={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = '#ffffff' }}
            onMouseOut={e => { e.currentTarget.style.color = 'var(--text-light)'; e.currentTarget.style.background = 'transparent' }}
            title="Dismiss alert"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}
