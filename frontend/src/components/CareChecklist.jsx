import { useEffect, useState } from 'react'
import api from '../api'

const PRIORITY_COLORS = {
  high:   { bg: '#fef2f2', text: '#991b1b', border: '#fecaca' },
  medium: { bg: '#fffbeb', text: '#92400e', border: '#fde68a' },
  low:    { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
}

export default function CareChecklist({ patientId, isDoctor = false, isCaregiver = false, careStatus = 'POST_TREATMENT_RECOVERY' }) {
  const [tasks, setTasks] = useState([])
  const [filter, setFilter] = useState('all') // all, pending, completed
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newTask, setNewTask] = useState({
    title: '', category: 'Wound Dressing', instructions: '',
    scheduled_time: '09:00 AM', priority: 'medium'
  })

  const isReadOnly = careStatus === 'RECOVERY_COMPLETED'

  const fetchTasks = () => {
    api.get(`/api/recovery/${patientId}/tasks`)
      .then(r => setTasks(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchTasks()
    const interval = setInterval(fetchTasks, 5000)
    return () => clearInterval(interval)
  }, [patientId])

  const completeTask = async (taskId) => {
    if (isReadOnly) return
    try {
      await api.post(`/api/recovery/tasks/${taskId}/complete`)
      fetchTasks()
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to complete task')
    }
  }

  const deleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to discontinue this care task?')) return
    try {
      await api.delete(`/api/recovery/tasks/${taskId}`)
      fetchTasks()
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete task')
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      await api.post(`/api/recovery/${patientId}/tasks`, newTask)
      setShowAddModal(false)
      setNewTask({ title: '', category: 'Wound Dressing', instructions: '', scheduled_time: '09:00 AM', priority: 'medium' })
      fetchTasks()
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to create care task')
    }
  }

  const filteredTasks = tasks.filter(t => {
    if (filter === 'pending') return t.status === 'pending'
    if (filter === 'completed') return t.status === 'completed'
    return true
  })

  const pendingCount = tasks.filter(t => t.status === 'pending').length
  const completedCount = tasks.filter(t => t.status === 'completed').length
  const completionPct = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0

  return (
    <div style={{
      background: '#ffffff', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)',
      padding: '22px 24px', marginBottom: 22, boxShadow: 'var(--shadow-sm)'
    }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>📋</span>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>
              Doctor-Assigned Daily Care Checklist
            </h3>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 12.5, margin: '4px 0 0 0' }}>
            Post-treatment scheduled recovery activities, instructions, and adherence log
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isDoctor && !isReadOnly && (
            <button onClick={() => setShowAddModal(true)} style={{
              padding: '8px 16px', background: 'var(--primary)',
              border: 'none', borderRadius: 'var(--radius-sm)', color: '#ffffff', fontWeight: 600, fontSize: 12.5,
              cursor: 'pointer', boxShadow: '0 1px 3px rgba(37,99,235,0.25)', transition: 'all 0.15s ease'
            }}>
              + Assign Task
            </button>
          )}
        </div>
      </div>

      {isReadOnly && (
        <div style={{
          background: 'var(--bg-subtle)', border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-sm)', padding: '10px 14px', color: 'var(--text-secondary)',
          fontSize: 12.5, marginBottom: 16
        }}>
          ℹ️ Recovery care plan has been completed. This checklist is archived for historical clinical review.
        </div>
      )}

      {/* Progress Bar */}
      {tasks.length > 0 && (
        <div style={{ marginBottom: 18, background: 'var(--bg-canvas)', border: '1px solid var(--border-default)', padding: '12px 16px', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12.5 }}>
            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Daily Adherence Progress</span>
            <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{completedCount} of {tasks.length} Completed ({completionPct}%)</span>
          </div>
          <div style={{ height: 7, background: '#e2e8f0', borderRadius: 9999, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${completionPct}%`,
              background: 'linear-gradient(90deg, var(--primary), #3b82f6)',
              borderRadius: 9999, transition: 'width 0.4s ease'
            }} />
          </div>
        </div>
      )}

      {/* Tabs Filter */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 16,
        background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', padding: 4,
        border: '1px solid var(--border-default)', width: 'fit-content'
      }}>
        {[
          ['all', `All Tasks (${tasks.length})`],
          ['pending', `Pending (${pendingCount})`],
          ['completed', `Completed (${completedCount})`]
        ].map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)} style={{
            background: filter === key ? '#ffffff' : 'transparent',
            border: 'none', borderRadius: 'var(--radius-sm)', padding: '6px 14px',
            color: filter === key ? 'var(--primary)' : 'var(--text-muted)',
            fontSize: 12.5, fontWeight: filter === key ? 600 : 500, cursor: 'pointer',
            boxShadow: filter === key ? 'var(--shadow-xs)' : 'none',
            transition: 'all 0.15s ease'
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* Task List */}
      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 12 }}>Loading care checklist...</div>
      ) : filteredTasks.length === 0 ? (
        <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, background: 'var(--bg-canvas)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-default)' }}>
          No {filter !== 'all' ? filter : ''} care tasks found.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredTasks.map(task => {
            const isDone = task.status === 'completed'
            const pStyle = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium

            return (
              <div key={task.id} style={{
                background: isDone ? 'var(--bg-canvas)' : '#ffffff',
                border: `1px solid ${isDone ? 'var(--border-default)' : 'var(--border-default)'}`,
                borderRadius: 'var(--radius-md)', padding: '14px 16px', display: 'flex', justifyContent: 'space-between',
                alignItems: 'flex-start', gap: 14, opacity: isDone ? 0.85 : 1, transition: 'all 0.15s ease',
                boxShadow: isDone ? 'none' : 'var(--shadow-xs)'
              }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flex: 1 }}>
                  {/* Complete Button / Checkbox */}
                  <button
                    disabled={isDone || isReadOnly}
                    onClick={() => completeTask(task.id)}
                    style={{
                      width: 24, height: 24, borderRadius: 6,
                      border: `2px solid ${isDone ? 'var(--success)' : 'var(--border-strong)'}`,
                      background: isDone ? 'var(--success)' : '#ffffff',
                      color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: isDone || isReadOnly ? 'default' : 'pointer', flexShrink: 0, marginTop: 2,
                      fontSize: 13, fontWeight: 700, transition: 'all 0.15s ease'
                    }}
                    title={isDone ? 'Completed' : 'Click to mark complete'}
                  >
                    {isDone ? '✓' : ''}
                  </button>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{
                        fontSize: 14, fontWeight: 600,
                        color: isDone ? 'var(--text-muted)' : 'var(--text-primary)',
                        textDecoration: isDone ? 'line-through' : 'none'
                      }}>
                        {task.title}
                      </span>
                      <span style={{
                        fontSize: 11, background: 'var(--bg-subtle)', color: 'var(--text-secondary)',
                        padding: '2px 8px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-default)', fontWeight: 500
                      }}>
                        {task.category}
                      </span>
                      <span style={{
                        fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', padding: '1px 7px',
                        borderRadius: 'var(--radius-full)', background: pStyle.bg, color: pStyle.text, border: `1px solid ${pStyle.border}`
                      }}>
                        {task.priority}
                      </span>
                    </div>

                    {task.instructions && (
                      <div style={{ color: 'var(--text-secondary)', fontSize: 12.5, marginBottom: 6, lineHeight: 1.45 }}>
                        {task.instructions}
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11.5, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                      <span>⏰ Scheduled: <strong style={{ color: 'var(--text-secondary)' }}>{task.scheduled_time || 'Anytime today'}</strong></span>
                      {isDone && task.completed_by_name && (
                        <span style={{ color: 'var(--success-text)', fontWeight: 600 }}>
                          ✓ Completed by {task.completed_by_name} ({task.completed_by_role}) at {task.completed_at ? new Date(task.completed_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : 'Today'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {isDoctor && !isReadOnly && (
                  <button onClick={() => deleteTask(task.id)} style={{
                    background: 'transparent', border: 'none', color: 'var(--text-light)',
                    fontSize: 14, cursor: 'pointer', padding: 4, borderRadius: 4
                  }}
                    onMouseOver={e => e.currentTarget.style.color = 'var(--danger)'}
                    onMouseOut={e => e.currentTarget.style.color = 'var(--text-light)'}
                    title="Discontinue task"
                  >
                    🗑️
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add Task Modal */}
      {showAddModal && (
        <div className="saas-modal-backdrop">
          <div className="saas-modal-content">
            <h3 style={{ color: 'var(--text-primary)', fontSize: 17, fontWeight: 700, marginBottom: 16 }}>Assign New Care Task</h3>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, marginBottom: 5 }}>Task Title</label>
                <input required placeholder="e.g., Deep Breathing Spirometry" value={newTask.title}
                  onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                  className="saas-input" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, marginBottom: 5 }}>Category</label>
                  <select value={newTask.category} onChange={e => setNewTask({ ...newTask, category: e.target.value })}
                    className="saas-input">
                    <option>Wound Dressing</option>
                    <option>Breathing Exercise</option>
                    <option>Physiotherapy</option>
                    <option>Medication</option>
                    <option>Vitals Check</option>
                    <option>Dietary</option>
                    <option>Appointment</option>
                    <option>General</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, marginBottom: 5 }}>Priority</label>
                  <select value={newTask.priority} onChange={e => setNewTask({ ...newTask, priority: e.target.value })}
                    className="saas-input">
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, marginBottom: 5 }}>Scheduled Time / Frequency</label>
                <input placeholder="e.g. 08:00 AM, Every 2 hours" value={newTask.scheduled_time}
                  onChange={e => setNewTask({ ...newTask, scheduled_time: e.target.value })}
                  className="saas-input" />
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, marginBottom: 5 }}>Instructions</label>
                <textarea rows={3} placeholder="Specific care instructions..." value={newTask.instructions}
                  onChange={e => setNewTask({ ...newTask, instructions: e.target.value })}
                  className="saas-input" style={{ resize: 'vertical' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="saas-btn saas-btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="saas-btn saas-btn-primary">
                  Assign Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
