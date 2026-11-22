import { useState, useEffect, useRef } from 'react'
import api from '../api'

function Avatar({ name, color }) {
  return (
    <div style={{
      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
      background: color || 'linear-gradient(135deg,#8b5cf6,#6d28d9)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 13, fontWeight: 700, color: 'white'
    }}>{name?.[0]?.toUpperCase()}</div>
  )
}

function dateSep(ts) {
  const d = new Date(ts)
  const today = new Date()
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString())     return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ChatPanel({ currentUserId, otherUserId, otherName }) {
  const [messages, setMessages] = useState([])
  const [input, setInput]       = useState('')
  const [wsConnected, setWsConnected] = useState(false)
  const bottomRef = useRef(null)
  const wsRef     = useRef(null)

  const fetchMessages = async () => {
    if (!otherUserId || !currentUserId) return
    try {
      const { data } = await api.get(`/api/messages/${currentUserId}/${otherUserId}`)
      setMessages(data)
    } catch (err) {
      console.error('Fetch messages error:', err)
    }
  }

  useEffect(() => {
    setMessages([])
    fetchMessages()
    if (!currentUserId || !otherUserId) return

    wsRef.current?.close()
    const wsHost = window.location.hostname || 'localhost'
    const socket = new WebSocket(`ws://${wsHost}:8001/ws/chat/${currentUserId}`)
    wsRef.current = socket

    socket.onopen = () => setWsConnected(true)
    socket.onclose = () => setWsConnected(false)
    socket.onerror = () => setWsConnected(false)

    socket.onmessage = e => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.event === 'chat') {
          const fromOther = Number(msg.sender_id) === Number(otherUserId) && Number(msg.receiver_id) === Number(currentUserId)
          const fromMe    = Number(msg.sender_id) === Number(currentUserId) && Number(msg.receiver_id) === Number(otherUserId)
          if (fromOther || fromMe) {
            setMessages(prev => {
              if (prev.some(m => m.id === msg.id)) return prev
              return [...prev, msg]
            })
          }
        }
      } catch (err) {}
    }

    const poll = setInterval(fetchMessages, 2500)
    return () => {
      socket.close()
      clearInterval(poll)
    }
  }, [currentUserId, otherUserId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async e => {
    e.preventDefault()
    if (!input.trim() || !otherUserId || !currentUserId) return

    if (Number(currentUserId) === Number(otherUserId)) {
      alert("Notice: You are signed into the same user ID in this tab. To test two-way live chat between doctor and patient, open an Incognito window and log in as the patient (patient1 / patient123).")
      return
    }

    const text = input.trim()
    setInput('')

    try {
      const { data } = await api.post('/api/messages', {
        sender_id: Number(currentUserId),
        receiver_id: Number(otherUserId),
        message: text
      })
      if (data) {
        setMessages(prev => {
          if (prev.some(m => m.id === data.id)) return prev
          return [...prev, data]
        })
      }
      setTimeout(fetchMessages, 400)
    } catch (err) {
      console.error('Failed to send message:', err)
      fetchMessages()
    }
  }

  // Group messages with date separators
  const grouped = []
  let lastDate = null
  messages.forEach(m => {
    const sep = dateSep(m.timestamp)
    if (sep !== lastDate) { grouped.push({ type: 'sep', label: sep }); lastDate = sep }
    grouped.push({ type: 'msg', ...m })
  })

  const isSelfChat = Number(currentUserId) === Number(otherUserId)

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: '#ffffff', border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)'
    }}>

      {/* Header */}
      <div style={{
        padding: '14px 20px', borderBottom: '1px solid var(--border-default)',
        background: '#ffffff', display: 'flex', alignItems: 'center', gap: 12
      }}>
        <Avatar name={otherName} color="linear-gradient(135deg,#2563eb,#3b82f6)" />
        <div>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 }}>{otherName}</div>
          <div style={{ fontSize: 11.5, color: wsConnected ? '#166534' : 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: wsConnected ? '#10b981' : '#94a3b8', display: 'inline-block' }} />
            {wsConnected ? 'Live Socket Connected' : 'Auto-Sync Active'}
          </div>
        </div>
      </div>

      {isSelfChat && (
        <div style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a', padding: '10px 16px', color: '#92400e', fontSize: 12 }}>
          ⚠️ <strong>Single-Browser Session Detected:</strong> Both sides are sharing ID #{currentUserId}. To test real two-way live chat between doctor and patient, open an <strong>Incognito Window</strong> to sign in as the patient (patient1 / patient123) while keeping the doctor tab open here.
        </div>
      )}

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '18px 20px',
        display: 'flex', flexDirection: 'column', gap: 6,
        background: 'var(--bg-canvas)'
      }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 60, fontSize: 13.5 }}>
            No messages yet. Send a clinical message or inquiry 👋
          </div>
        )}

        {grouped.map((item, i) => {
          if (item.type === 'sep') return (
            <div key={`sep-${i}`} style={{ textAlign: 'center', margin: '12px 0 8px' }}>
              <span style={{
                background: '#ffffff', border: '1px solid var(--border-default)',
                color: 'var(--text-muted)', fontSize: 11, fontWeight: 600,
                padding: '3px 12px', borderRadius: 'var(--radius-full)',
                boxShadow: 'var(--shadow-xs)'
              }}>
                {item.label}
              </span>
            </div>
          )

          const isMine = Number(item.sender_id) === Number(currentUserId)
          const time = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

          if (item.message.startsWith('System:')) {
            const cleanText = item.message.replace(/^System:\s*/i, '')
            return (
              <div key={item.id ?? i} style={{ display: 'flex', justifyContent: 'center', margin: '14px 0' }}>
                <div style={{
                  background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b',
                  fontSize: 12, fontWeight: 600, padding: '7px 16px', borderRadius: 24,
                  display: 'flex', alignItems: 'center', gap: 7, maxWidth: '85%', boxShadow: 'var(--shadow-xs)'
                }}>
                  <span>🚨</span>
                  <span><strong>System Alert:</strong> {cleanText}</span>
                  <span style={{ fontSize: 10.5, opacity: 0.75, marginLeft: 4 }}>• {time}</span>
                </div>
              </div>
            )
          }

          return (
            <div key={item.id ?? i} style={{
              display: 'flex',
              flexDirection: isMine ? 'row-reverse' : 'row',
              alignItems: 'flex-end',
              gap: 8,
              marginBottom: 4
            }}>
              {/* Avatar — only for received */}
              {!isMine
                ? <Avatar name={item.sender_name || otherName} color="linear-gradient(135deg,#3b82f6,#2563eb)" />
                : <div style={{ width: 32 }} />
              }

              {/* Bubble */}
              <div style={{
                maxWidth: '68%',
                background: isMine ? 'var(--primary)' : '#ffffff',
                color: isMine ? '#ffffff' : 'var(--text-primary)',
                border: isMine ? '1px solid var(--primary)' : '1px solid var(--border-default)',
                padding: '10px 14px',
                borderRadius: isMine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                fontSize: 13.5, lineHeight: 1.5,
                boxShadow: 'var(--shadow-xs)',
                wordBreak: 'break-word'
              }}>
                {!isMine && (
                  <div style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 700, marginBottom: 2 }}>
                    {item.sender_name || otherName}
                  </div>
                )}
                <span>{item.message}</span>
                <div style={{
                  fontSize: 10,
                  color: isMine ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)',
                  marginTop: 4,
                  textAlign: 'right',
                  fontWeight: 500
                }}>
                  {time}{isMine && ' ✓✓'}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={send} style={{
        padding: '14px 18px', borderTop: '1px solid var(--border-default)',
        background: '#ffffff', display: 'flex', gap: 10, alignItems: 'center'
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) send(e) }}
          placeholder="Type a clinical message..."
          style={{
            flex: 1, padding: '10px 16px', background: '#ffffff',
            border: '1px solid var(--border-default)', borderRadius: 'var(--radius-full)',
            color: 'var(--text-primary)', fontSize: 13.5, outline: 'none',
            boxShadow: 'var(--shadow-xs)', transition: 'all 0.15s ease'
          }}
          onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.12)' }}
          onBlur={e  => { e.target.style.borderColor = 'var(--border-default)'; e.target.style.boxShadow = 'var(--shadow-xs)' }}
        />
        <button type="submit" disabled={!input.trim()} style={{
          width: 40, height: 40, borderRadius: '50%',
          background: input.trim() ? 'var(--primary)' : 'var(--bg-subtle)',
          border: 'none', color: input.trim() ? '#ffffff' : 'var(--text-muted)',
          cursor: input.trim() ? 'pointer' : 'default',
          fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s ease', flexShrink: 0,
          boxShadow: input.trim() ? '0 1px 3px rgba(37, 99, 235, 0.3)' : 'none'
        }}>➤</button>
      </form>
    </div>
  )
}
