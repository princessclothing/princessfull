import React, { memo, useCallback, useMemo, useState } from 'react'
import OrderStatusBadge from './OrderStatusBadge'

// ── Fulfillment step icons ───────────────────────────────────────────────────
const FULFILLMENT_STEPS = [
  { key: 'etiquetaDisponivel', label: 'Etiqueta disponível' },
  { key: 'etiquetaImportada',  label: 'Etiqueta no ERP'    },
  { key: 'picking',            label: 'Picking'            },
  { key: 'packing',            label: 'Packing'            },
  { key: 'transportadora',     label: 'Entregue transp.'   },
]

const FulfillmentIcons = ({ status = {} }) => (
  <div className="flex items-center gap-1" aria-label="etapas de fulfillment">
    {FULFILLMENT_STEPS.map((step) => (
      <span
        key={step.key}
        title={`${step.label}: ${status[step.key] ? 'concluído' : 'pendente'}`}
        className={`text-base leading-none ${status[step.key] ? 'opacity-100' : 'opacity-25'}`}
      >
        {status[step.key] ? '✅' : '⭕'}
      </span>
    ))}
  </div>
)

// ── Sort icon ────────────────────────────────────────────────────────────────
const SortIcon = ({ field, sortField, sortDir }) => {
  if (sortField !== field) return <span aria-hidden className="ml-1 text-gray-300 text-[10px]">⇅</span>
  return <span aria-hidden className="ml-1 text-purple-600 text-[10px]">{sortDir === 'asc' ? '↑' : '↓'}</span>
}

// ── Memoized row ─────────────────────────────────────────────────────────────
const OrderRow = memo(({ order, onView, onCancel, rowIndex }) => {
  const handleKeyDown = useCallback((e) => { if (e.key === 'Enter') onView(order.id) }, [order.id, onView])
  const handleCancel  = useCallback((e) => {
    e.stopPropagation()
    if (window.confirm(`Cancelar a ordem ${order.id}?`)) onCancel(order.id)
  }, [order.id, onCancel])
  const handleView = useCallback((e) => { e.stopPropagation(); onView(order.id) }, [order.id, onView])

  return (
    <tr
      className={`cursor-pointer border-b border-gray-100 transition-colors hover:bg-purple-50/40 ${rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label={`Ordem ${order.id}, ref ${order.refCliente}`}
    >
      <td className="px-4 py-3 font-mono text-sm font-semibold text-purple-700">{order.id}</td>
      <td className="px-4 py-3 text-sm text-slate-700">{order.refCliente}</td>
      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{order.dataIntegracao}</td>
      <td className="px-4 py-3"><FulfillmentIcons status={order.status} /></td>
      <td className="px-4 py-3"><OrderStatusBadge status={order.status} /></td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={handleView}
            className="px-2.5 py-1 rounded-md text-xs font-medium bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors"
          >
            Detalhes
          </button>
          <button
            onClick={handleCancel}
            className="px-2.5 py-1 rounded-md text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </td>
    </tr>
  )
})
OrderRow.displayName = 'OrderRow'

// ── Constants ────────────────────────────────────────────────────────────────
const VIRTUAL_THRESHOLD = 80
const VISIBLE_ROWS      = 15
const ROW_HEIGHT_PX     = 52

const COLUMNS = [
  { field: 'id',              label: 'Ordem de Expedi\u00e7\u00e3o' },
  { field: 'refCliente',      label: 'Ref. Pedido'           },
  { field: 'dataIntegracao',  label: 'Data Integra\u00e7\u00e3o'    },
  { field: null,              label: 'Fulfillment'            },
  { field: null,              label: 'Status'                 },
  { field: null,              label: 'A\u00e7\u00f5es'                },
]

// ── Main export ───────────────────────────────────────────────────────────────
const OrdersTable = ({
  orders        = [],
  onView        = () => {},
  onCancel      = () => {},
  onManualOrder = () => {},
  onSyncBling   = () => {},
  loading       = false,
  error         = null,
  connected     = false,
}) => {
  // ── filter state ──
  const [filterStatus,      setFilterStatus]      = useState('')
  const [filterMarketplace, setFilterMarketplace] = useState('')
  const [filterFrom,        setFilterFrom]        = useState('')
  const [filterTo,          setFilterTo]          = useState('')
  const [activeFilters,     setActiveFilters]     = useState({})

  // ── table state ──
  const [sortField, setSortField] = useState('dataIntegracao')
  const [sortDir,   setSortDir]   = useState('desc')
  const [scrollTop, setScrollTop] = useState(0)

  const applyFilters = () =>
    setActiveFilters({ status: filterStatus, marketplace: filterMarketplace, from: filterFrom, to: filterTo })

  const clearFilters = () => {
    setFilterStatus(''); setFilterMarketplace(''); setFilterFrom(''); setFilterTo('')
    setActiveFilters({})
  }

  const toggleSort = useCallback((field) => {
    setSortField(f => { setSortDir(d => (f === field ? (d === 'asc' ? 'desc' : 'asc') : 'asc')); return field })
  }, [])

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (activeFilters.status      && o.statusLabel !== activeFilters.status)      return false
      if (activeFilters.marketplace && o.marketplace  !== activeFilters.marketplace) return false
      if (activeFilters.from        && o.dataIntegracao < activeFilters.from)        return false
      if (activeFilters.to          && o.dataIntegracao > activeFilters.to)          return false
      return true
    })
  }, [orders, activeFilters])

  const sortedOrders = useMemo(() => {
    return [...filteredOrders].sort((a, b) => {
      const va = a[sortField] ?? '', vb = b[sortField] ?? ''
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ?  1 : -1
      return 0
    })
  }, [filteredOrders, sortField, sortDir])

  const useVirtual  = sortedOrders.length > VIRTUAL_THRESHOLD
  const startIndex  = useVirtual ? Math.max(0, Math.floor(scrollTop / ROW_HEIGHT_PX) - 2) : 0
  const endIndex    = useVirtual ? Math.min(sortedOrders.length, startIndex + VISIBLE_ROWS + 4) : sortedOrders.length
  const visibleOrders  = sortedOrders.slice(startIndex, endIndex)
  const topPadding     = useVirtual ? startIndex * ROW_HEIGHT_PX : 0
  const bottomPadding  = useVirtual ? (sortedOrders.length - endIndex) * ROW_HEIGHT_PX : 0

  const marketplaces = useMemo(() => [...new Set(orders.map(o => o.marketplace).filter(Boolean))], [orders])
  const statuses     = useMemo(() => [...new Set(orders.map(o => o.statusLabel).filter(Boolean))], [orders])

  return (
    <div className="flex gap-4 items-start">

      {/* ── Left filter panel ────────────────────────────────────────────── */}
      <aside className="w-52 shrink-0 bg-white border border-gray-100 rounded-xl p-4 space-y-4 shadow-sm sticky top-4" aria-label="Filtros">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Filtros</p>

        <div className="space-y-1">
          <label className="text-xs text-gray-500 font-medium">Status</label>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-slate-700 bg-white focus:outline-none focus:border-purple-400"
          >
            <option value="">Todos</option>
            {statuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-gray-500 font-medium">Marketplace</label>
          <select
            value={filterMarketplace}
            onChange={e => setFilterMarketplace(e.target.value)}
            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-slate-700 bg-white focus:outline-none focus:border-purple-400"
          >
            <option value="">Todos</option>
            {marketplaces.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-gray-500 font-medium">Per\u00edodo — De</label>
          <input
            type="date"
            value={filterFrom}
            onChange={e => setFilterFrom(e.target.value)}
            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:border-purple-400"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-gray-500 font-medium">At\u00e9</label>
          <input
            type="date"
            value={filterTo}
            onChange={e => setFilterTo(e.target.value)}
            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:border-purple-400"
          />
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <button
            onClick={applyFilters}
            className="w-full py-1.5 rounded-lg bg-purple-700 text-white text-xs font-semibold hover:bg-purple-800 transition-colors"
          >
            Aplicar
          </button>
          <button
            onClick={clearFilters}
            className="w-full py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Limpar filtros
          </button>
        </div>
      </aside>

      {/* ── Right: table card ────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">

        {/* Table toolbar */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <p className="text-sm font-semibold text-slate-700">Ordens de Expedição</p>
            <span
              title={connected ? 'Tempo real ativo' : 'Reconectando…'}
              className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                connected
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-amber-50 text-amber-700'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${
                connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
              }`} />
              {connected ? 'Tempo real ativo' : 'Reconectando…'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onSyncBling}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-slate-600 hover:bg-gray-50 transition-colors"
            >
              🔄 Sincronizar Bling
            </button>
            <button
              onClick={onManualOrder}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-purple-700 text-white text-xs font-semibold hover:bg-purple-800 transition-colors"
            >
              + Incluir ordem manualmente
            </button>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div role="status" aria-live="polite" className="flex items-center justify-center h-48 gap-3">
            <svg className="animate-spin h-6 w-6 text-purple-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            <span className="text-sm text-gray-500">Carregando ordens\u2026</span>
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div role="alert" className="flex items-center justify-center h-48 gap-3 text-red-600">
            <span className="text-2xl" aria-hidden>\u26a0\ufe0f</span>
            <div>
              <p className="text-sm font-semibold">Erro ao carregar ordens</p>
              <p className="text-xs text-gray-500">{error}</p>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && sortedOrders.length === 0 && (
          <div role="status" className="flex flex-col items-center justify-center h-48 gap-2 text-gray-400">
            <span className="text-4xl" aria-hidden>📦</span>
            <p className="text-sm">Nenhuma ordem encontrada para os filtros selecionados.</p>
          </div>
        )}

        {/* Table */}
        {!loading && !error && sortedOrders.length > 0 && (
          <div
            className={useVirtual ? 'overflow-auto h-[52rem]' : 'overflow-auto'}
            onScroll={useVirtual ? (e) => setScrollTop(e.currentTarget.scrollTop) : undefined}
            aria-label="tabela de ordens de expedi\u00e7\u00e3o"
          >
            <p className="sr-only">{sortedOrders.length} ordens carregadas</p>
            <table className="min-w-full text-sm" role="grid" aria-rowcount={sortedOrders.length}>
              <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-100">
                <tr>
                  {COLUMNS.map((col) => (
                    <th
                      key={col.label}
                      scope="col"
                      className={`px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider select-none whitespace-nowrap ${col.field ? 'cursor-pointer hover:text-purple-700' : ''}`}
                      onClick={col.field ? () => toggleSort(col.field) : undefined}
                      aria-sort={col.field && sortField === col.field ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                    >
                      {col.label}
                      {col.field && <SortIcon field={col.field} sortField={sortField} sortDir={sortDir} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {useVirtual && topPadding > 0 && <tr aria-hidden><td colSpan={6} style={{ height: topPadding }} /></tr>}
                {visibleOrders.map((order, i) => (
                  <OrderRow key={order.id} order={order} onView={onView} onCancel={onCancel} rowIndex={startIndex + i} />
                ))}
                {useVirtual && bottomPadding > 0 && <tr aria-hidden><td colSpan={6} style={{ height: bottomPadding }} /></tr>}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        {!loading && !error && (
          <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 text-xs text-gray-500 flex items-center justify-between">
            <span>
              {sortedOrders.length} ordem{sortedOrders.length !== 1 ? 's' : ''} encontrada{sortedOrders.length !== 1 ? 's' : ''}
              {orders.length !== sortedOrders.length && ` (de ${orders.length} total)`}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export default OrdersTable
