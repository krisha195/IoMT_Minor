export default function MotionCard({
  ax = 0,
  ay = 0,
  az = 1,
  motionScore = 0,
  motionStatus = 'STABLE',
  fingerDetected = true,
  isDoctor = false
}) {
  const normAx = ax != null ? Number(ax).toFixed(3) : '0.000'
  const normAy = ay != null ? Number(ay).toFixed(3) : '0.000'
  const normAz = az != null ? Number(az).toFixed(3) : '1.000'
  const normScore = motionScore != null ? Number(motionScore).toFixed(4) : '0.0000'
  const statusStr = (motionStatus || 'STABLE').toUpperCase()

  const isMotionElevated = statusStr === 'MODERATE' || statusStr === 'HIGH'
  const isHighMotion = statusStr === 'HIGH'

  const statusConfig = {
    STABLE: {
      label: 'Stable / Resting',
      color: '#166534',
      bg: '#f0fdf4',
      border: '#bbf7d0',
      dot: '#10b981',
      desc: 'Minimal physical activity. PPG vitals fidelity is optimal.'
    },
    LOW: {
      label: 'Low Motion',
      color: '#1e40af',
      bg: '#eff6ff',
      border: '#bfdbfe',
      dot: '#3b82f6',
      desc: 'Minor patient movement (e.g. arm adjustments). Telemetry is reliable.'
    },
    MODERATE: {
      label: 'Moderate Motion',
      color: '#92400e',
      bg: '#fffbeb',
      border: '#fde68a',
      dot: '#f59e0b',
      desc: 'Active movement detected (e.g. ambulation). Mild PPG artifact potential.'
    },
    HIGH: {
      label: 'High Motion Spike',
      color: '#991b1b',
      bg: '#fef2f2',
      border: '#fecaca',
      dot: '#ef4444',
      desc: 'Rapid acceleration detected. Vitals may contain motion artifacts.'
    },
    SENSOR_ERROR: {
      label: 'Sensor Fault',
      color: '#64748b',
      bg: '#f8fafc',
      border: '#e2e8f0',
      dot: '#cbd5e1',
      desc: 'MPU6500 accelerometer communication anomaly.'
    }
  }

  const currentStatus = statusConfig[statusStr] || statusConfig.STABLE

  // Compute visual magnitude percentage for motion score (0.0 to 0.25g scale)
  const scorePercent = Math.min(100, Math.max(3, (Number(normScore) / 0.25) * 100))

  return (
    <div className="saas-card" style={{
      padding: '20px 22px',
      marginBottom: 20,
      background: '#ffffff',
      border: isMotionElevated ? '1px solid #fde68a' : '1px solid var(--border-default)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: isMotionElevated ? '0 2px 8px rgba(245, 158, 11, 0.08)' : 'var(--shadow-xs)'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>🏃</span>
            <span style={{
              fontSize: 15,
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.01em'
            }}>
              MPU6500 Motion & 3-Axis Acceleration
            </span>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              background: currentStatus.bg,
              border: `1px solid ${currentStatus.border}`,
              color: currentStatus.color,
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)'
            }}>
              <span style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: currentStatus.dot
              }} />
              {currentStatus.label}
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
            Continuous kinematic telemetry & PPG motion-artifact surveillance
          </div>
        </div>

        {/* Live Score Counter */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Motion Intensity
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: isHighMotion ? '#dc2626' : isMotionElevated ? '#d97706' : 'var(--text-primary)' }}>
            {normScore} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>g</span>
          </div>
        </div>
      </div>

      {/* Motion Artifact Warning Banner */}
      {isMotionElevated && (
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          padding: '12px 16px',
          background: isHighMotion ? '#fef2f2' : '#fffbeb',
          border: `1px solid ${isHighMotion ? '#fecaca' : '#fde68a'}`,
          borderRadius: 'var(--radius-md)',
          marginBottom: 16
        }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 13,
              fontWeight: 700,
              color: isHighMotion ? '#991b1b' : '#92400e',
              marginBottom: 2
            }}>
              {isDoctor ? 'Motion Artifact Advisory' : 'Movement Detected — Please Stay Still'}
            </div>
            <div style={{ fontSize: 12, color: isHighMotion ? '#b91c1c' : '#78350f', lineHeight: 1.45 }}>
              {isDoctor ? (
                <>
                  Significant patient acceleration detected (<strong>{statusStr}</strong> motion, score: <strong>{normScore}g</strong>). Optical photoplethysmography (MAX30102) signals may reflect transient motion artifact deflection. Clinical interpretation should cross-reference resting baseline.
                </>
              ) : (
                <>
                  We detected body or arm movement. For the most accurate pulse and oxygen readings, please rest comfortably with your hand relaxed for a few moments.
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Finger Detached Alert Banner */}
      {!fingerDetected && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          background: '#fff7ed',
          border: '1px solid #fed7aa',
          borderRadius: 'var(--radius-md)',
          marginBottom: 16
        }}>
          <span style={{ fontSize: 16 }}>👆</span>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: '#c2410c' }}>
            MAX30102 Optical Sensor: No finger contact detected. Please place index finger firmly on the sensor window.
          </div>
        </div>
      )}

      {/* Metric Breakdown Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 12,
        marginBottom: 14
      }}>
        {/* X Axis */}
        <div style={{
          background: 'var(--bg-canvas)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 14px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#ef4444' }}>X-AXIS</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Lateral</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
            {normAx} <span style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--text-muted)' }}>g</span>
          </div>
          <div style={{
            height: 4,
            background: '#e2e8f0',
            borderRadius: 2,
            marginTop: 8,
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              width: `${Math.min(100, Math.abs(Number(normAx)) * 100)}%`,
              background: '#ef4444'
            }} />
          </div>
        </div>

        {/* Y Axis */}
        <div style={{
          background: 'var(--bg-canvas)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 14px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#059669' }}>Y-AXIS</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Longitudinal</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
            {normAy} <span style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--text-muted)' }}>g</span>
          </div>
          <div style={{
            height: 4,
            background: '#e2e8f0',
            borderRadius: 2,
            marginTop: 8,
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              width: `${Math.min(100, Math.abs(Number(normAy)) * 100)}%`,
              background: '#059669'
            }} />
          </div>
        </div>

        {/* Z Axis */}
        <div style={{
          background: 'var(--bg-canvas)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 14px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#2563eb' }}>Z-AXIS</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Gravity / Vert</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
            {normAz} <span style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--text-muted)' }}>g</span>
          </div>
          <div style={{
            height: 4,
            background: '#e2e8f0',
            borderRadius: 2,
            marginTop: 8,
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              width: `${Math.min(100, Math.abs(Number(normAz)) * 100)}%`,
              background: '#2563eb'
            }} />
          </div>
        </div>

        {/* Dynamic Motion Intensity */}
        <div style={{
          background: 'var(--bg-canvas)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 14px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed' }}>DELTA MOTION</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Vector Drift</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
            {normScore} <span style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--text-muted)' }}>g</span>
          </div>
          <div style={{
            height: 4,
            background: '#e2e8f0',
            borderRadius: 2,
            marginTop: 8,
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              width: `${scorePercent}%`,
              background: isHighMotion ? '#dc2626' : isMotionElevated ? '#f59e0b' : '#7c3aed',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>
      </div>

      {/* Informative Footer */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 10,
        borderTop: '1px solid var(--border-default)',
        fontSize: 11.5,
        color: 'var(--text-muted)',
        flexWrap: 'wrap',
        gap: 8
      }}>
        <div>
          <strong>Status:</strong> {currentStatus.desc}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <span>Low: &lt; 0.08g</span>
          <span>Mod: 0.08–0.16g</span>
          <span>High: &gt; 0.16g</span>
        </div>
      </div>
    </div>
  )
}
