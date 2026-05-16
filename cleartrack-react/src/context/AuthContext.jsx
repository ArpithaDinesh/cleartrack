import { createContext, useContext, useState, useEffe ct } from 'react'
import { authAPI } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('cleartrack_token')
      if (!token) return setLoading(false)

      try {
        const data = await authAPI.getMe()
        setUser(data.user)
      } catch (err) {
        console.warn('Auth check failed, retrying...', err)
        // Retry after 2 seconds (handles cold starts)
        await new Promise(r => setTimeout(r, 2000))
        try {
          const data = await authAPI.getMe()
          setUser(data.user)
        } catch (e) {
          console.error('Auth check final failure', e)
          localStorage.removeItem('cleartrack_token')
        }
      } finally {
        setLoading(false)
      }
    }
    initAuth()
  }, [])

  const login = (token, userData) => {
    localStorage.setItem('cleartrack_token', token)
    setUser(userData)
  }

  const logout = () => {
    localStorage.removeItem('cleartrack_token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
