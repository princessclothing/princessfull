/**
 * ChangePasswordPage — Tela de troca de senha obrigatória no primeiro acesso.
 */
import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'

const RULES = [
  { label: 'Mínimo 8 caracteres',               test: (p) => p.length >= 8 },
  { label: 'Pelo menos uma letra maiúscula',     test: (p) => /[A-Z]/.test(p) },
  { label: 'Pelo menos uma letra minúscula',     test: (p) => /[a-z]/.test(p) },
  { label: 'Pelo menos um número',               test: (p) => /\d/.test(p) },
]

function RuleItem({ ok, label }) {
  return (
    <li className={`flex items-center gap-1.5 text-xs transition-colors ${ok ? 'text-green-600' : 'text-gray-400'}`}>
      <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        {ok
          ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          : <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        }
      </svg>
      {label}
    </li>
  )
}

export default function ChangePasswordPage() {
  const { changePassword, user, logout } = useAuth()

  const [newPwd,     setNewPwd]     = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [showNew,    setShowNew]    = useState(false)
  const [showConf,   setShowConf]   = useState(false)
  const [error,      setError]      = useState('')
  const [loading,    setLoading]    = useState(false)

  const allRulesOk = RULES.every(r => r.test(newPwd))
  const passwordsMatch = newPwd === confirmPwd && confirmPwd.length > 0

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!allRulesOk) {
      setError('A senha não atende todos os requisitos.')
      return
    }
    if (!passwordsMatch) {
      setError('As senhas não conferem.')
      return
    }

    setLoading(true)
    try {
      await changePassword(newPwd)
      // AuthContext atualiza user.mustChangePassword = false → App redireciona automaticamente
    } catch (err) {
      setError(err.message || 'Erro ao alterar senha.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gray-50 px-4"
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8 gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-purple-700 text-white text-lg font-bold shadow-sm">
            FP
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold text-slate-800">Primeiro acesso</h1>
            <p className="text-sm text-gray-500">
              Olá{user?.name ? `, ${user.name}` : ''}! Defina uma nova senha para continuar.
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Nova senha */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5" htmlFor="newPwd">
                Nova senha
              </label>
              <div className="relative">
                <input
                  id="newPwd"
                  type={showNew ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={newPwd}
                  onChange={e => setNewPwd(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2.5 pr-10 rounded-lg border border-gray-200 text-sm text-slate-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(v => !v)}
                  tabIndex={-1}
                  aria-label={showNew ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                >
                  <EyeIcon open={showNew} />
                </button>
              </div>

              {/* Regras de senha */}
              {newPwd.length > 0 && (
                <ul className="mt-2 space-y-1 pl-0.5">
                  {RULES.map(r => (
                    <RuleItem key={r.label} label={r.label} ok={r.test(newPwd)} />
                  ))}
                </ul>
              )}
            </div>

            {/* Confirmar senha */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5" htmlFor="confirmPwd">
                Confirmar nova senha
              </label>
              <div className="relative">
                <input
                  id="confirmPwd"
                  type={showConf ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={confirmPwd}
                  onChange={e => setConfirmPwd(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full px-3 py-2.5 pr-10 rounded-lg border text-sm text-slate-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition
                    ${confirmPwd.length > 0
                      ? passwordsMatch ? 'border-green-300' : 'border-red-300'
                      : 'border-gray-200'}`}
                />
                <button
                  type="button"
                  onClick={() => setShowConf(v => !v)}
                  tabIndex={-1}
                  aria-label={showConf ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                >
                  <EyeIcon open={showConf} />
                </button>
              </div>
              {confirmPwd.length > 0 && !passwordsMatch && (
                <p className="text-xs text-red-500 mt-1">As senhas não conferem.</p>
              )}
            </div>

            {/* Erro geral */}
            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-700 text-xs rounded-lg px-3 py-2.5">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
                </svg>
                {error}
              </div>
            )}

            {/* Botão */}
            <button
              type="submit"
              disabled={loading || !allRulesOk || !passwordsMatch}
              className="w-full py-2.5 rounded-lg bg-purple-700 hover:bg-purple-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Salvando…
                </span>
              ) : 'Definir nova senha'}
            </button>
          </form>
        </div>

        <button
          onClick={logout}
          className="mt-4 w-full text-center text-xs text-gray-400 hover:text-gray-600 transition"
        >
          Sair e voltar ao login
        </button>
      </div>
    </div>
  )
}

function EyeIcon({ open }) {
  if (open) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-5.523 0-10-4.477-10-7s4.477-7 10-7a10.05 10.05 0 011.875.175M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
      </svg>
    )
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-.274.857-.677 1.66-1.192 2.386" />
    </svg>
  )
}
