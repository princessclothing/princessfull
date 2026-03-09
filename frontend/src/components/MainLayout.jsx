import React, { useState } from 'react'
import ManualOrderModal from './ManualOrderModal'
import { useAuth } from '../context/AuthContext'

const NAV_ITEMS = [
  { key: 'orders',        emoji: '📦', label: 'Ordens de Expedição'   },
  { key: 'returns',       emoji: '🔄', label: 'Devoluções'            },
  { key: 'inbound',       emoji: '📥', label: 'Entradas de Mercadoria' },
  { key: 'inventory',     emoji: '📊', label: 'Estoque'               },
  { key: 'invoices',      emoji: '🧾', label: 'Faturas'               },
  { key: 'subscriptions', emoji: '📋', label: 'Assinaturas'           },
  { key: 'tasks',         emoji: '✅', label: 'Tarefas'               },
  { key: 'tickets',       emoji: '🎫', label: 'Chamados'              },
  { key: 'security',      emoji: '🔒', label: 'Conexão e Segurança'   },
  { key: 'documents',     emoji: '📁', label: 'Documentos'            },
]

export default function MainLayout({ children, title, breadcrumb, activeKey, onNavigate = () => {}, user = {} }) {
  const [collapsed, setCollapsed] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const { logout } = useAuth()

  const initials = user.name
    ? user.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : 'U'

  return (
    <div className="min-h-screen flex bg-gray-50 text-slate-800" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Sidebar ── */}
      <aside className={`flex flex-col shrink-0 bg-white border-r border-gray-100 transition-all duration-200 ease-in-out ${collapsed ? 'w-[68px]' : 'w-56'}`}>

        {/* Logo */}
        <div className="flex items-center gap-2.5 px-3 h-14 border-b border-gray-100">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-700 text-white text-xs font-bold shrink-0">PF</div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-slate-800 truncate leading-tight">Princess Full</p>
              <p className="text-[10px] text-gray-400 leading-tight">Painel de Expedição</p>
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-2 px-1.5 space-y-0.5">
          {NAV_ITEMS.map(item => {
            const active = activeKey === item.key
            return (
              <button
                key={item.key}
                type="button"
                title={item.label}
                onClick={() => onNavigate(item.key)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors select-none text-left
                  ${active ? 'bg-purple-50 text-purple-700 font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-slate-800'}
                  ${collapsed ? 'justify-center' : ''}`}
              >
                <span className="text-[15px] shrink-0 leading-none">{item.emoji}</span>
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            )
          })}
        </nav>

        {/* User footer */}
        <div className="px-2.5 py-3 border-t border-gray-100">
          <div className={`flex items-center gap-2.5 ${collapsed ? 'justify-center' : ''}`}>
            <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[11px] font-bold shrink-0">{initials}</div>
            {!collapsed && (
              <div className="flex-1 overflow-hidden leading-tight min-w-0">
                <p className="text-xs font-medium text-slate-800 truncate">{user.name || 'Usuário'}</p>
                <p className="text-[10px] text-gray-400 truncate capitalize">{user.role || user.company || 'Empresa'}</p>
              </div>
            )}
            {!collapsed && (
              <button
                onClick={logout}
                title="Sair"
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                aria-label="Sair"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(s => !s)}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          className="border-t border-gray-100 py-2 text-[11px] text-gray-400 hover:text-purple-600 hover:bg-gray-50 transition-colors w-full text-center"
        >
          {collapsed ? '›' : '‹ recolher'}
        </button>
      </aside>

      {/* ── Main column ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <header className="flex items-center justify-between gap-4 px-5 h-14 bg-white border-b border-gray-100 shrink-0">

          {/* Left */}
          <div className="flex items-center gap-4 min-w-0">
            <nav aria-label="breadcrumb" className="text-xs text-gray-400 hidden sm:block shrink-0">
              {breadcrumb || (
                <ol className="flex items-center gap-1.5">
                  <li>Home</li>
                  <li>/</li>
                  <li className="text-slate-600 font-medium">{title || 'Dashboard'}</li>
                </ol>
              )}
            </nav>

            <label className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 w-56">
              <span className="text-gray-400 text-xs">🔍</span>
              <input
                type="search"
                placeholder="Buscar pedidos, SKUs…"
                className="bg-transparent text-xs text-slate-700 placeholder-gray-400 focus:outline-none w-full"
                aria-label="Busca global"
              />
            </label>
          </div>

          {/* Right */}
          <div className="flex items-center gap-2 shrink-0">
            <button aria-label="Notificações" className="p-2 rounded-lg text-gray-500 hover:bg-gray-50 text-sm transition-colors">🔔</button>

            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-purple-700 text-white text-xs font-semibold hover:bg-purple-800 active:scale-[.98] transition-all"
            >
              + Nova Ordem
            </button>

            <div className="flex items-center gap-2 pl-1">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-medium text-slate-800 leading-tight">{user.name || 'Usuário'}</p>
                <p className="text-[10px] text-gray-400 leading-tight">Princess Full</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-purple-700 text-white flex items-center justify-center text-xs font-bold">{initials}</div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-5">
          <div className="max-w-screen-xl mx-auto">{children}</div>
        </main>
      </div>

      {/* Manual Order Modal */}
      <ManualOrderModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={() => setModalOpen(false)}
      />
    </div>
  )
}
