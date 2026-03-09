/**
 * AuthContext — estado global de autenticação.
 *
 * Fornece:
 *   user              — { id, email, name, role, mustChangePassword } ou null
 *   token             — JWT string ou null
 *   login(email, password)     — POST /auth/login
 *   logout()                   — limpa estado e localStorage
 *   changePassword(newPassword) — POST /auth/change-password
 *   loading           — true enquanto verifica token salvo na inicialização
 */
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'

function normalizeBase(url) {
  if (!url) return '/api'
  url = url.replace(/\/+$/, '')
  if (!url.endsWith('/api')) url += '/api'
  return url
}
const API_BASE = normalizeBase(import.meta.env.VITE_API_URL)

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null)
  const [token, setToken]   = useState(null)
  const [loading, setLoading] = useState(true)

  // Na inicialização, tenta restaurar sessão do localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem('accessToken')
    const savedUser  = localStorage.getItem('authUser')
    if (savedToken && savedUser) {
      try {
        // Verifica se o token ainda não expirou (decode simples do payload base64)
        const payload = JSON.parse(atob(savedToken.split('.')[1]))
        if (payload.exp * 1000 > Date.now()) {
          setToken(savedToken)
          setUser(JSON.parse(savedUser))
        } else {
          localStorage.removeItem('accessToken')
          localStorage.removeItem('authUser')
        }
      } catch {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('authUser')
      }
    }
    setLoading(false)
  }, [])

  const login = useCallback(async (email, password) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.message || `Erro ${res.status}`)
    }

    localStorage.setItem('accessToken', data.token)
    localStorage.setItem('authUser', JSON.stringify(data.user))
    setToken(data.token)
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('authUser')
    setToken(null)
    setUser(null)
  }, [])

  const changePassword = useCallback(async (newPassword) => {
    const savedToken = localStorage.getItem('accessToken')
    const res = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(savedToken ? { Authorization: `Bearer ${savedToken}` } : {}),
      },
      body: JSON.stringify({ newPassword }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.message || `Erro ${res.status}`)

    // Atualiza o user em memória e localStorage removendo a flag
    setUser(prev => {
      if (!prev) return prev
      const updated = { ...prev, mustChangePassword: false }
      localStorage.setItem('authUser', JSON.stringify(updated))
      return updated
    })
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, login, logout, changePassword, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}
