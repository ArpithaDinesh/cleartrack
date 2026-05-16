import { createContext, useContext, useState, useEffect } from 'react'
import { authAPI } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('cleartrack_token')
    if (token) {
      // Try once, then retry once more on failure (handles Vercel cold starts)
      authAPI.getMe()
        .then(data => setUser(data.user))
        .catch(() => {
          // Retry after 2 seconds for cold start
          return new Promise(resolve => setTimeout(resolve, 2000))
            .then(() => authAPI.getMe())
            .then(data => setUser(data.user))
            .catch(() => localStorage.removeItem('cleartrack_token'))
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
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
