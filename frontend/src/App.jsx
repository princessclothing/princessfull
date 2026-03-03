/**
 * App.jsx — Root component for FulfillPanel
 * Uses MainLayout as the shell; fetches orders from /api/orders.
 */
import React, { useCallback, useEffect, useState } from 'react'
import MainLayout          from './components/MainLayout'
import OrdersTable         from './components/OrdersTable'
import OrderDetail         from './components/OrderDetail'
import NewOrderToast       from './components/NewOrderToast'
import useRealtimeOrders   from './hooks/useRealtimeOrders'

// API_BASE determines where frontend should send HTTP requests
// - by default we use the relative `/api` path which Vercel rewrites
// - if the user supplies VITE_API_URL (e.g. in staging), we ensure it
//   always ends with `/api` so endpoints resolve correctly and avoid
//   accidentally requesting the SPA HTML.
function normalizeBase(url) {
  if (!url) return '/api';
  // strip trailing slash
  url = url.replace(/\/+$/, '');
  // ensure '/api' suffix
  if (!url.endsWith('/api')) url += '/api';
  return url;
}
const API_BASE = normalizeBase(import.meta.env.VITE_API_URL);

async function apiFetch(path, opts = {}) {
  const token = localStorage.getItem('accessToken')
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  })

  // read raw text first so we can attempt JSON parsing safely
  const text = await res.text()

  if (!res.ok) {
    let body = {}
    try { body = JSON.parse(text) } catch {}
    throw new Error(body.message || `HTTP ${res.status}`)
  }

  // successful, try parse JSON but fall back to raw text
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

// ── Placeholder for pages not yet built ────────────────────────────────────
const PAGE_META = {
  returns:       { emoji: '🔄', title: 'Devoluções',              desc: 'Gestão de devoluções e estornos.' },
  inbound:       { emoji: '📥', title: 'Entradas de Mercadoria',  desc: 'Recebimento e conferência de mercadorias.' },
  inventory:     { emoji: '📊', title: 'Estoque',                 desc: 'Visão consolidada de estoque por SKU.' },
  invoices:      { emoji: '🧾', title: 'Faturas',                 desc: 'Faturas e cobranças do plano.' },
  subscriptions: { emoji: '📋', title: 'Assinaturas',             desc: 'Gerenciar assinatura e limites.' },
  tasks:         { emoji: '✅', title: 'Tarefas',                 desc: 'Checklist de tarefas operacionais.' },
  tickets:       { emoji: '🎫', title: 'Chamados',                desc: 'Suporte e chamados em aberto.' },
  security:      { emoji: '🔒', title: 'Conexão e Segurança',     desc: 'Tokens de integração e permissões.' },
  documents:     { emoji: '📁', title: 'Documentos',              desc: 'Repositório de documentos e NFs.' },
}

function PlaceholderPage({ pageKey }) {
  const meta = PAGE_META[pageKey] || { emoji: '🔧', title: pageKey, desc: 'Em construção.' }
  return (
    <div className="flex flex-col items-center justify-center h-96 gap-4 text-center">
      <span className="text-6xl">{meta.emoji}</span>
      <h2 className="text-xl font-semibold text-slate-800">{meta.title}</h2>
      <p className="text-sm text-gray-500 max-w-xs">{meta.desc}</p>
      <span className="px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-medium">Em breve</span>
    </div>
  )
}

export default function App() {
  // ── page navigation ──
  const [currentPage, setCurrentPage] = useState('orders')

  // ── orders list state ──
  const [orders,    setOrders]    = useState([])
  const [loading,   setLoading]   = useState(false)
  const [loadErr,   setLoadErr]   = useState(null)
  const [syncing,   setSyncing]   = useState(false)

  // ── detail/nav state ──
  const [selectedOrder, setSelectedOrder] = useState(null)   // full order object
  const [detailLoading, setDetailLoading] = useState(false)

  // ── user stub (replace with real auth context when ready) ──
  // shopId comes from the JWT payload in a real implementation;
  // For now, hardcode to match the main shop ID
  const shopId = '204794092'
  const user   = { name: 'Operador', company: 'FulfillPanel' }

  // Fetch order list — declared BEFORE useRealtimeOrders so onResync is ready
  const loadOrders = useCallback(async () => {
    setLoading(true)
    setLoadErr(null)
    try {
      const data = await apiFetch('/orders')
      setOrders(data.orders ?? [])
    } catch (err) {
      setLoadErr(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // ── real-time orders via Pusher ──
  const { newOrderAlert, clearAlert, connected } = useRealtimeOrders(
    orders,
    setOrders,
    { shopId, onResync: loadOrders }
  )

  useEffect(() => { loadOrders() }, [loadOrders])

  // Sync Bling
  const handleSyncBling = useCallback(async () => {
    setSyncing(true)
    try {
      // Hardcoded shopId for demo - in production, get from user context
      const result = await apiFetch('/bling/sync?shop_ids=204794092')
      console.log('Bling sync result:', result)
      alert(`Sincronização completa: ${result.synced} pedidos (páginas ${result.pagesFetched}/${result.maxPages})`)
      await loadOrders()
    } catch (err) {
      console.error('Bling sync error:', err)
      alert(`Erro ao sincronizar: ${err.message}`)
    } finally {
      setSyncing(false)
    }
  }, [loadOrders])
  // Update order
  const handleUpdateOrder = useCallback(async (orderId, updateData) => {
    try {
      await apiFetch(`/orders/${orderId}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData),
      });
      // Reload the order details
      if (selectedOrder && selectedOrder.id === orderId) {
        const updated = await apiFetch(`/orders/${orderId}`);
        setSelectedOrder(updated);
      }
      await loadOrders(); // Refresh list
    } catch (err) {
      throw new Error(err.message);
    }
  }, [selectedOrder, loadOrders]);
  // View order detail
  const handleView = useCallback(async (id) => {
    setDetailLoading(true)
    try {
      const order = await apiFetch(`/orders/${id}`)
      setSelectedOrder(order)
    } catch (err) {
      // fallback: find in already-loaded list
      const found = orders.find(o => o.id === id || o.dbId === id)
      if (found) setSelectedOrder(found)
      else alert(`Erro ao carregar ordem: ${err.message}`)
    } finally {
      setDetailLoading(false)
    }
  }, [orders])

  // Cancel order
  const handleCancel = useCallback(async (id) => {
    try {
      await apiFetch(`/orders/${id}`, { method: 'DELETE' })
      setOrders(prev => prev.filter(o => o.id !== id))
    } catch (err) {
      alert(`Erro ao cancelar: ${err.message}`)
    }
  }, [])

  const handleNavigate = useCallback((key) => {
    setSelectedOrder(null)
    setCurrentPage(key)
  }, [])

  // ── Non-orders pages ─────────────────────────────────────────────────────
  if (currentPage !== 'orders') {
    const meta = PAGE_META[currentPage] || { title: currentPage }
    return (
      <MainLayout
        user={user}
        activeKey={currentPage}
        onNavigate={handleNavigate}
        title={meta.title}
      >
        <PlaceholderPage pageKey={currentPage} />
      </MainLayout>
    )
  }

  // ── Detail view ──────────────────────────────────────────────────────────
  if (selectedOrder) {
    return (
      <MainLayout
        user={user}
        activeKey="orders"
        onNavigate={handleNavigate}
        title={`Ordem ${selectedOrder.id}`}
        breadcrumb={
          <ol className="flex items-center gap-1.5 text-xs text-gray-400">
            <li>
              <button
                onClick={() => setSelectedOrder(null)}
                className="hover:text-purple-700 transition-colors"
              >
                Ordens
              </button>
            </li>
            <li>/</li>
            <li className="text-slate-600 font-medium">{selectedOrder.id}</li>
          </ol>
        }
      >
        {detailLoading ? (
          <div className="flex items-center justify-center h-64 gap-3 text-gray-500">
            <svg className="animate-spin h-6 w-6 text-purple-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            Carregando detalhes…
          </div>
        ) : (
          <OrderDetail
            order={selectedOrder}
            onPrintLabel={()  => alert('Imprimir etiqueta: integração pendente')}
            onUpdate={handleUpdateOrder}
            onCancel={()      => {
              if (window.confirm(`Cancelar ordem ${selectedOrder.id}?`)) {
                handleCancel(selectedOrder.id)
                setSelectedOrder(null)
              }
            }}
          />
        )}
      </MainLayout>
    )
  }

  // ── List view ────────────────────────────────────────────────────────────
  return (
    <MainLayout
      user={user}
      activeKey="orders"
      onNavigate={handleNavigate}
      title="Ordens de Expedição"
    >
      {newOrderAlert && (
        <NewOrderToast
          alert={newOrderAlert}
          onClose={clearAlert}
          onView={(id) => { clearAlert(); handleView(id) }}
        />
      )}

      <OrdersTable
        orders={orders}
        loading={loading || syncing}
        error={loadErr}
        onView={handleView}
        onCancel={handleCancel}
        onManualOrder={() => {}}   // opens ManualOrderModal (handled inside OrdersTable header)
        onSyncBling={handleSyncBling}
        connected={connected}
      />
    </MainLayout>
  )
}
