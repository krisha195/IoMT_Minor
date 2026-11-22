import axios from 'axios'

const host = (typeof window !== 'undefined' && window.location.hostname) ? window.location.hostname : 'localhost'
export const apiBaseURL = (import.meta.env.VITE_API_BASE_URL || `http://${host}:8001`).replace(/\/+$/, '')

export function getWebSocketUrl(path) {
  const url = new URL(path, `${apiBaseURL}/`)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.toString()
}

const api = axios.create({ baseURL: apiBaseURL })

api.interceptors.request.use(cfg => {
  const user = JSON.parse(localStorage.getItem('user') || 'null')
  if (user?.token) cfg.headers.Authorization = `Bearer ${user.token}`
  return cfg
})

export default api
