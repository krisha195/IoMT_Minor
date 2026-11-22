import axios from 'axios'

const host = (typeof window !== 'undefined' && window.location.hostname) ? window.location.hostname : 'localhost'
const api = axios.create({ baseURL: `http://${host}:8001` })

api.interceptors.request.use(cfg => {
  const user = JSON.parse(localStorage.getItem('user') || 'null')
  if (user?.token) cfg.headers.Authorization = `Bearer ${user.token}`
  return cfg
})

export default api
