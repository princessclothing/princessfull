import React, { useState } from 'react'

// Props expected:
// {
//   order: {
//     id, refCliente,
//     status: { etiquetaDisponivel, etiquetaImportada, picking, packing, transportadora },
//     timeline: [{ stage, date, note? }],
//     billingAddress:  { name?, line1, city, state, zip },
//     shippingAddress: { name?, line1, city, state, zip },
//     products: [{ sku, name?, qtyRequested, qtyShipped }],
//     lastDeliveryOrders: [...],
//     chatHistory: [{ user, message, time, isOwn? }],
//   },
//   onPrintLabel, onCancel, onUpdate
// }

const carriers = [
  'Mercado Livre Envios', 'Correios', 'Loggi', 'OLIST Fulfillment',
  'Retirar no Local', 'Magalu Entregas', 'Mercado Livre Flex',
  'Kangu', 'B2W Fulfillment', 'FBA Amazon', 'Total Express', 'Lalamove',
  'Mercado Livre Full', 'Jadlog', 'OLIST Coleta',
  'Dreng Transportadora', 'Shopee (Pegaki)',
]

const FULFILLMENT_STEPS = [
  { key: 'etiquetaDisponivel', emoji: '🏷️',  label: 'Etiqueta disponível' },
  { key: 'etiquetaImportada',  emoji: '📥',  label: 'Etiqueta no ERP'     },
  { key: 'picking',            emoji: '🔍',  label: 'Picking'             },
  { key: 'packing',            emoji: '📦',  label: 'Packing'             },
  { key: 'transportadora',     emoji: '🚚',  label: 'Entregue transp.'    },
]

// ── Section card wrapper ─────────────────────────────────────────────────────
const Card = ({ title, children, className = '' }) => (
  <div className={`bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden ${className}`}>
    {title && (
      <div className="px-4 py-3 border-b border-gray-100">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">{title}</p>
      </div>
    )}
    <div className="p-4">{children}</div>
  </div>
)

const OrderDetail = ({ order, onPrintLabel, onCancel, onUpdate, onLabelUpload }) => {
  const [selectedCarrier, setSelectedCarrier] = useState('')
  const [files, setFiles] = useState({ danfe: null, others: [] })
  const [labelUploading, setLabelUploading] = useState(false)
  const [labelUploadError, setLabelUploadError] = useState(null)
  const [chatInput, setChatInput] = useState('')
  const [saving, setSaving] = useState(false)

  const handleFileChange = (field, evt) => {
    const file = evt.target.files[0]
    setFiles(prev => ({ ...prev, [field]: file }))
  }

  // Upload da etiqueta imediatamente ao selecionar o arquivo
  const handleLabelFileChange = async (evt) => {
    const file = evt.target.files[0]
    if (!file) return
    setLabelUploading(true)
    setLabelUploadError(null)
    try {
      if (!onLabelUpload) throw new Error('Upload não configurado')
      const url = await onLabelUpload(order.id, file)
      console.log('[Label] Uploaded:', url)
    } catch (err) {
      setLabelUploadError(err.message)
    } finally {
      setLabelUploading(false)
      evt.target.value = '' // reset input
    }
  }

  const handleSaveShipment = async () => {
    if (!selectedCarrier) {
      alert('Selecione uma transportadora');
      return;
    }
    
    setSaving(true);
    try {
      // In a real implementation, upload files to storage (S3, Cloudinary, etc.)
      // and send file URLs along with carrier info to backend
      const updateData = {
        transportadora: selectedCarrier,
        files: {
          danfe: files.danfe?.name || null,
          label: files.label?.name || null,
          others: files.others?.name || null,
        }
      };
      
      if (onUpdate) {
        await onUpdate(order.id, updateData);
      }
      
      alert(`Ordem atualizada!\nTransportadora: ${selectedCarrier}\nDANFE: ${files.danfe?.name || 'Não anexado'}`);
    } catch (err) {
      alert(`Erro ao salvar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  const status = order?.status ?? {}

  return (
    <div className="space-y-4" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Header card ───────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">

          {/* Left: IDs + steps */}
          <div className="space-y-3">
            <div>
              <h1 className="text-lg font-bold text-slate-800 leading-tight">Ordem #{order.numeroBling || order.id}</h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                {order.numeroBling && (
                  <p className="text-xs text-gray-500">
                    Nº Bling: <span className="font-semibold text-purple-700">{order.numeroBling}</span>
                  </p>
                )}
                {order.numeroLoja && (
                  <p className="text-xs text-gray-500">
                    Nº Marketplace: <span className="font-semibold text-slate-700 font-mono">{order.numeroLoja}</span>
                  </p>
                )}
                {order.marketplace && (
                  <p className="text-xs text-gray-400">Loja: {order.marketplace}</p>
                )}
              </div>
            </div>

            {/* 5-step fulfillment progress */}
            <div className="flex items-center gap-2">
              {FULFILLMENT_STEPS.map((step, i) => {
                const done = !!status[step.key]
                return (
                  <React.Fragment key={step.key}>
                    <div className="flex flex-col items-center gap-1" title={step.label}>
                      <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 text-sm transition-all ${done ? 'border-purple-600 bg-purple-50 text-purple-700' : 'border-gray-200 bg-gray-50 text-gray-400'}`}>
                        {done ? '✓' : step.emoji}
                      </div>
                      <span className={`text-[9px] leading-tight text-center max-w-[52px] ${done ? 'text-purple-700 font-medium' : 'text-gray-400'}`}>{step.label}</span>
                    </div>
                    {i < FULFILLMENT_STEPS.length - 1 && (
                      <div className={`h-px w-6 shrink-0 -mt-4 ${done ? 'bg-purple-300' : 'bg-gray-200'}`} aria-hidden />
                    )}
                  </React.Fragment>
                )
              })}
            </div>
          </div>

          {/* Right: action buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={onPrintLabel}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-slate-700 hover:bg-gray-50 transition-colors"
            >
              🏷️ Etiqueta
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-lg border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              Cancelar Ordem
            </button>
          </div>
        </div>
      </div>

      {/* ── 2-col grid: timeline + addresses ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Rastreio — aparece quando disponível */}
        {order.rastreio && (
          <Card title="📦 Rastreamento" className="lg:col-span-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1">
                <p className="text-xs text-gray-500 mb-1">Código de rastreio</p>
                <p className="font-mono text-base font-semibold text-slate-800 tracking-wider">{order.rastreio}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => navigator.clipboard.writeText(order.rastreio)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-slate-600 hover:bg-gray-50 transition-colors"
                >
                  📋 Copiar
                </button>
                <a
                  href={`https://rastreamento.correios.com.br/app/index.php?s=${order.rastreio}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg border border-purple-200 text-xs font-medium text-purple-700 hover:bg-purple-50 transition-colors"
                >
                  🔍 Rastrear
                </a>
              </div>
            </div>
          </Card>
        )}

        {!order.rastreio && (
          <Card title="📦 Rastreamento" className="lg:col-span-2">
            <p className="text-xs text-gray-400 italic">Código de rastreio não disponível para este pedido.</p>
          </Card>
        )}

        {/* Timeline */}
        <Card title="Timeline de Fulfillment">
          <ol className="relative">
            {(order.timeline ?? []).map((t, idx, arr) => (
              <li key={idx} className="flex gap-3 pb-4 last:pb-0">
                {/* connector */}
                <div className="flex flex-col items-center">
                  <div className="w-2 h-2 rounded-full bg-purple-600 mt-1 shrink-0" />
                  {idx < arr.length - 1 && <div className="w-px flex-1 bg-gray-200 my-1" />}
                </div>
                {/* content */}
                <div>
                  <p className="text-sm font-medium text-slate-700 leading-tight">{t.stage}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{t.date}</p>
                  {t.note && <p className="text-xs text-gray-500 mt-0.5 italic">{t.note}</p>}
                </div>
              </li>
            ))}
            {(!order.timeline || order.timeline.length === 0) && (
              <p className="text-sm text-gray-400">Nenhum evento registrado.</p>
            )}
          </ol>
        </Card>

        {/* Addresses */}
        <div className="space-y-4">
          <Card title="Endereço de Cobrança">
            <address className="not-italic text-sm text-slate-700 space-y-0.5">
              {order.billingAddress?.name && <p className="font-medium">{order.billingAddress.name}</p>}
              <p>{order.billingAddress?.line1}</p>
              <p>{order.billingAddress?.city} — {order.billingAddress?.state}</p>
              <p className="text-gray-400 text-xs">{order.billingAddress?.zip}</p>
            </address>
          </Card>
          <Card title="Endereço de Entrega">
            <address className="not-italic text-sm text-slate-700 space-y-0.5">
              {order.shippingAddress?.name && <p className="font-medium">{order.shippingAddress.name}</p>}
              <p>{order.shippingAddress?.line1}</p>
              <p>{order.shippingAddress?.city} — {order.shippingAddress?.state}</p>
              <p className="text-gray-400 text-xs">{order.shippingAddress?.zip}</p>
            </address>
          </Card>
        </div>
      </div>

      {/* ── Products table ────────────────────────────────────────────────── */}
      <Card title="Produtos">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="pb-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider pr-4">SKU</th>
                <th className="pb-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider pr-4">Nome</th>
                <th className="pb-2 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider pr-4">Qtd Solicitada</th>
                <th className="pb-2 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Qtd Entregue</th>
              </tr>
            </thead>
            <tbody>
              {(order.products ?? []).map((p, i) => (
                <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                  <td className="py-2.5 pr-4 font-mono text-xs text-purple-700">{p.sku}</td>
                  <td className="py-2.5 pr-4 text-slate-700">{p.name ?? '—'}</td>
                  <td className="py-2.5 pr-4 text-right text-slate-700">{p.qtyRequested}</td>
                  <td className={`py-2.5 text-right font-medium ${p.qtyShipped < p.qtyRequested ? 'text-amber-600' : 'text-emerald-600'}`}>{p.qtyShipped}</td>
                </tr>
              ))}
              {(!order.products || order.products.length === 0) && (
                <tr><td colSpan={4} className="py-4 text-center text-sm text-gray-400">Sem produtos registrados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Carrier + uploads row ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Carrier */}
        <Card title="Transportadora">
          <div className="space-y-2">
            <label htmlFor="carrier-select" className="text-xs text-gray-500">Selecione a transportadora</label>
            <select
              id="carrier-select"
              value={selectedCarrier}
              onChange={e => setSelectedCarrier(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-slate-700 bg-white focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-200"
            >
              <option value="">-- selecione --</option>
              {carriers.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </Card>

        {/* Uploads */}
        <Card title="Documentos e Anexos">
          <div className="space-y-3">

            {/* Etiqueta de envio — upload com feedback e botão abrir */}
            <div className="space-y-1.5">
              <p className="text-xs text-gray-600 font-medium">Etiqueta de envio</p>
              {order.labelUrl ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-emerald-600 font-medium">✅ Etiqueta carregada</span>
                  <button
                    onClick={() => window.open(order.labelUrl, '_blank', 'noopener,noreferrer')}
                    className="px-3 py-1 rounded-md text-xs font-medium bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors"
                  >
                    📄 Abrir PDF
                  </button>
                  <label className="px-3 py-1 rounded-md text-xs font-medium border border-gray-200 text-slate-500 hover:bg-gray-50 cursor-pointer transition-colors">
                    Substituir
                    <input type="file" accept=".pdf,image/*" className="hidden" onChange={handleLabelFileChange} />
                  </label>
                </div>
              ) : (
                <label className={`flex items-center gap-2 cursor-pointer border-2 border-dashed rounded-lg px-3 py-2 transition-colors ${
                  labelUploading ? 'border-purple-300 bg-purple-50/50' : 'border-gray-200 hover:border-purple-400 hover:bg-purple-50/30'
                }`}>
                  {labelUploading ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-purple-500 shrink-0" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                      </svg>
                      <span className="text-xs text-purple-600">Enviando...</span>
                    </>
                  ) : (
                    <>
                      <span className="text-lg">📄</span>
                      <span className="text-xs text-gray-400">Escolher PDF da etiqueta</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    className="hidden"
                    disabled={labelUploading}
                    onChange={handleLabelFileChange}
                  />
                </label>
              )}
              {labelUploadError && (
                <p className="text-xs text-red-500">⚠️ {labelUploadError}</p>
              )}
            </div>

            {/* DANFE */}
            <div className="space-y-1.5">
              <p className="text-xs text-gray-600 font-medium">DANFE (NF-e)</p>
              {order.danfeUrl ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-emerald-600 font-medium">✅ NF-e disponível</span>
                  <button
                    onClick={() => window.open(order.danfeUrl, '_blank', 'noopener,noreferrer')}
                    className="px-3 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                  >
                    📑 Abrir DANFE
                  </button>
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">NF-e não emitida ou ainda não sincronizada.</p>
              )}
            </div>

            {/* Outros */}
            <div className="flex items-center justify-between gap-3">
              <label className="text-xs text-gray-600 font-medium w-36 shrink-0">Outros anexos</label>
              <div className="flex-1">
                <label className="flex items-center gap-2 cursor-pointer border border-dashed border-gray-200 rounded-lg px-3 py-1.5 hover:border-purple-400 hover:bg-purple-50/30 transition-colors">
                  <span className="text-gray-400 text-xs">{files.others?.name ? files.others.name : '0 arquivo(s)'}</span>
                  <input
                    type="file"
                    accept="*"
                    multiple
                    className="hidden"
                    onChange={e => handleFileChange('others', e)}
                  />
                </label>
              </div>
            </div>

          </div>
        </Card>
      </div>

      {/* Save shipment button */}
      <div className="flex justify-end">
        <button
          onClick={handleSaveShipment}
          disabled={saving || !selectedCarrier}
          className="px-6 py-2.5 rounded-lg bg-purple-700 text-white text-sm font-semibold hover:bg-purple-800 active:scale-[.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              Salvando...
            </>
          ) : (
            <>
              💾 Salvar Envio
            </>
          )}
        </button>
      </div>

      {/* ── Last delivery orders ──────────────────────────────────────────── */}
      {order.lastDeliveryOrders && order.lastDeliveryOrders.length > 0 && (
        <Card title="Pedidos da última entrega">
          <ul className="flex flex-wrap gap-2">
            {order.lastDeliveryOrders.map((o, i) => (
              <li key={i} className="px-2.5 py-1 rounded-full bg-gray-100 text-xs text-slate-700">{o}</li>
            ))}
          </ul>
        </Card>
      )}

      {/* ── Chat / internal history ───────────────────────────────────────── */}
      <Card title="Histórico de Comunicação">
        <div className="space-y-3">
          <div className="h-52 overflow-y-auto space-y-2 pr-1">
            {(order.chatHistory ?? []).map((m, i) => (
              <div key={i} className={`flex flex-col ${m.isOwn ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[10px] font-semibold text-slate-600">{m.user}</span>
                  <span className="text-[10px] text-gray-400">{m.time}</span>
                </div>
                <div className={`max-w-xs px-3 py-2 rounded-xl text-sm leading-snug ${m.isOwn ? 'bg-purple-700 text-white rounded-br-sm' : 'bg-gray-100 text-slate-700 rounded-bl-sm'}`}>
                  {m.message}
                </div>
              </div>
            ))}
            {(!order.chatHistory || order.chatHistory.length === 0) && (
              <p className="text-sm text-gray-400 text-center pt-8">Nenhuma mensagem ainda.</p>
            )}
          </div>

          {/* Chat input */}
          <div className="flex gap-2 border-t border-gray-100 pt-3">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder="Escreva uma nota interna…"
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-100 placeholder-gray-400"
              onKeyDown={e => e.key === 'Enter' && setChatInput('')}
            />
            <button
              onClick={() => setChatInput('')}
              className="px-4 py-2 rounded-lg bg-purple-700 text-white text-sm font-semibold hover:bg-purple-800 transition-colors"
            >
              Enviar
            </button>
          </div>
        </div>
      </Card>
    </div>
  )
}

export default OrderDetail
