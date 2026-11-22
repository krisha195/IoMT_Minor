import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts'

const CONFIGS = {
  hr:          { color: '#ef4444', label: 'Heart Rate (MAX30102)', unit: 'bpm', lo: 40,   hi: 150  },
  spo2:        { color: '#2563eb', label: 'SpO₂ Oxygen (MAX30102)', unit: '%',   lo: 90,   hi: 100  },
  temperature: { color: '#059669', label: 'Body Temperature (LM35)', unit: '°C', lo: 25.0, hi: 35.0 },
  motion:      { color: '#7c3aed', label: 'Motion Intensity (MPU6500)', unit: 'g', lo: 0.0, hi: 0.16 },
}

const CustomTooltip = ({ active, payload, label, unit, color }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-sm)',
      padding: '8px 12px',
      boxShadow: 'var(--shadow-md)'
    }}>
      <p style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 2 }}>{label}</p>
      <p style={{ color, fontSize: 14, fontWeight: 700, margin: 0 }}>
        {payload[0].value != null && !isNaN(payload[0].value) ? payload[0].value : '—'}{' '}
        <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>{unit}</span>
      </p>
    </div>
  )
}

export default function VitalsChart({ data = [], vital = 'hr', range, onRangeChange }) {
  const cfg = CONFIGS[vital] || CONFIGS.hr

  const chartData = data
    .filter(d => d && d.timestamp)
    .map(d => {
      let rawVal = vital === 'motion' ? (d.motion_score ?? d.motion) : d[vital]
      const numVal = rawVal != null && rawVal !== '' ? parseFloat(rawVal) : null
      const dt = new Date(d.timestamp)
      const isMultiDay = range === '7d' || range === '24h'
      const timeStr = isMultiDay
        ? `${dt.getMonth() + 1}/${dt.getDate()} ${dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        : dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

      return {
        t: timeStr,
        v: numVal != null && !isNaN(numVal) ? Number(numVal.toFixed(vital === 'motion' ? 4 : 1)) : null
      }
    })

  const latestPoint = chartData.length ? chartData[chartData.length - 1] : null
  const lastValue = (latestPoint && latestPoint.v != null && !isNaN(latestPoint.v)) ? latestPoint.v : null
  const isOpticalDetached = (vital === 'hr' || vital === 'spo2') && (lastValue == null)

  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-lg)',
      padding: '18px 22px',
      marginBottom: 16,
      boxShadow: 'var(--shadow-sm)'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
        flexWrap: 'wrap',
        gap: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            color: 'var(--text-primary)',
            fontSize: 13.5,
            fontWeight: 700,
            letterSpacing: '-0.01em'
          }}>
            {cfg.label}
          </span>
          <span style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            fontWeight: 500,
            background: 'var(--bg-canvas)',
            padding: '2px 8px',
            borderRadius: 12,
            border: '1px solid var(--border-default)'
          }}>
            {range ? `${range.toUpperCase()} Window` : 'Real-Time Stream'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Time range selector pill buttons if onRangeChange is supported */}
          {onRangeChange && (
            <div style={{ display: 'flex', gap: 4, background: 'var(--bg-canvas)', padding: 2, borderRadius: 6, border: '1px solid var(--border-default)' }}>
              {[
                ['', 'Live'],
                ['1h', '1H'],
                ['6h', '6H'],
                ['24h', '24H'],
                ['7d', '7D']
              ].map(([rKey, rLabel]) => (
                <button
                  key={rKey}
                  onClick={() => onRangeChange(rKey)}
                  style={{
                    padding: '2px 8px',
                    fontSize: 11,
                    fontWeight: (range || '') === rKey ? 700 : 500,
                    borderRadius: 4,
                    border: 'none',
                    cursor: 'pointer',
                    background: (range || '') === rKey ? '#ffffff' : 'transparent',
                    color: (range || '') === rKey ? 'var(--primary)' : 'var(--text-muted)',
                    boxShadow: (range || '') === rKey ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {rLabel}
                </button>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            {isOpticalDetached ? (
              <span style={{ color: '#ea580c', fontSize: 14, fontWeight: 700, background: '#fff7ed', border: '1px solid #fed7aa', padding: '2px 8px', borderRadius: 12 }}>
                Detached (No Finger)
              </span>
            ) : (
              <>
                <span style={{ color: cfg.color, fontSize: 20, fontWeight: 800 }}>
                  {lastValue != null ? lastValue : '—'}
                </span>
                {lastValue != null && (
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)' }}>
                    {cfg.unit}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={140}>
        <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-${vital}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={cfg.color} stopOpacity={0.16} />
              <stop offset="95%" stopColor={cfg.color} stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="t"
            tick={{ fill: '#64748b', fontSize: 10 }}
            interval="preserveStartEnd"
            axisLine={{ stroke: '#e2e8f0' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#64748b', fontSize: 10 }}
            domain={['auto','auto']}
            axisLine={false}
            tickLine={false}
            width={34}
          />
          <Tooltip content={<CustomTooltip unit={cfg.unit} color={cfg.color} />} />
          {cfg.lo != null && <ReferenceLine y={cfg.lo} stroke="#ef444450" strokeDasharray="3 3" />}
          {cfg.hi != null && <ReferenceLine y={cfg.hi} stroke="#ef444450" strokeDasharray="3 3" />}
          <Area
            type="monotone"
            dataKey="v"
            stroke={cfg.color}
            strokeWidth={2}
            fill={`url(#grad-${vital})`}
            dot={false}
            connectNulls={true}
            activeDot={{ r: 4, fill: cfg.color, stroke: '#ffffff', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
