import React, { useMemo, useState } from 'react'

const CARRIERS = [
  'Mercado Livre Envios',
  'Correios',
  'Loggi',
  'OLIST Fulfillment',
  'Retirar no Local',
  'Magalu Entregas',
  'Mercado Livre Flex',
  'Kangu',
  'B2W Fulfillment',
  'FBA Amazon',
  'Total Express',
  'Lalamove',
  'Mercado Livre Full',
  'Jadlog',
  'OLIST Coleta',
  'Dreng Transportadora',
  'Shopee (Pegaki)'
]

function Stepper({ step }) {
  const steps = ['Buscar Produto', 'Revisar Pedido', 'Entrega', 'Info Adicionais', 'Pagamento']
  return (
    <div className="flex items-center gap-4">
      {steps.map((label, i) => {
        const active = i === step
        const done = i < step
        return (
          <div key={label} className="flex items-center gap-3">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center ${done ? 'bg-green-100 text-green-700' : active ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {done ? 'âœ“' : i + 1}
            </div>
            <div className={`text-xs ${active ? 'font-semibold text-slate-900' : 'text-gray-500'}`}>{label}</div>
          </div>
        )
      })}
    </div>
  )
}

export default function ManualOrderModal({ isOpen, onClose, onConfirm }) {
  const [step, setStep] = useState(0)

  // Step 1: search
  const [skuQuery, setSkuQuery] = useState('')
  const [foundProduct, setFoundProduct] = useState(null)

  // Cart
  const [cart, setCart] = useState([])

  // Step 3: address
  const [selectedAddress, setSelectedAddress] = useState('end_local')

  // Step 4: additional info
  const [customerRef, setCustomerRef] = useState('')
  const [notes, setNotes] = useState('')
  const [carrier, setCarrier] = useState('')
  const [files, setFiles] = useState({ danfe: null, label: null, others: null })

  // Step 5: payment/summary
  const subtotal = useMemo(() => cart.reduce((s, p) => s + (p.qty * (p.price || 0)), 0), [cart])
  const shipping = 0
  const total = subtotal + shipping

  function mockSearch() {
    // simple mocked product
    if (!skuQuery) return setFoundProduct(null)
    setFoundProduct({
      sku: skuQuery.toUpperCase(),
      name: `Produto ${skuQuery.toUpperCase()}`,
      image: null,
      available: 12,
      expected: 5,
      price: 29.9
    })
  }

  function addToCart(qty = 1) {
    if (!foundProduct) return
    setCart((c) => {
      const exists = c.find((i) => i.sku === foundProduct.sku)
      if (exists) return c.map((i) => i.sku === exists.sku ? { ...i, qty: i.qty + qty } : i)
      return [...c, { sku: foundProduct.sku, name: foundProduct.name, qty, price: foundProduct.price }]
    })
    setFoundProduct(null)
    setSkuQuery('')
  }

  function removeFromCart(sku) {
    setCart((c) => c.filter((i) => i.sku !== sku))
  }

  function handleFileChange(e, key) {
    setFiles((f) => ({ ...f, [key]: e.target.files }))
  }

  function next() {
    // validation on step 3/4
    if (step === 3 && !customerRef.trim()) return alert('Ref. Pedido Cliente Ã© obrigatÃ³rio')
    if (step < 4) setStep((s) => s + 1)
  }

  function prev() {
    if (step > 0) setStep((s) => s - 1)
  }

  function submit() {
    const payload = { cart, selectedAddress, customerRef, notes, carrier, files }
    if (onConfirm) onConfirm(payload)
    onClose && onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-4xl mx-4 rounded-lg shadow-lg overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="space-y-2">
            <div className="text-lg font-semibold">Incluir Ordem Manual</div>
            <Stepper step={step} />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="text-sm px-3 py-2 rounded hover:bg-gray-50">Fechar</button>
          </div>
        </div>

        <div className="p-6">
          {step === 0 && (
            <div className="space-y-4">
              <div className="text-sm text-gray-600">Buscar produto por SKU</div>
              <div className="flex gap-3">
                <input value={skuQuery} onChange={(e) => setSkuQuery(e.target.value)} placeholder="Digite SKU" className="flex-1 border border-gray-100 rounded-md p-2" />
                <button onClick={mockSearch} className="px-4 py-2 bg-purple-600 text-white rounded-md">Buscar</button>
              </div>

              {foundProduct && (
                <div className="border border-gray-100 rounded-md p-3 flex items-center gap-4">
                  <div className="h-16 w-16 bg-gray-100 rounded flex items-center justify-center">Img</div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{foundProduct.name}</div>
                    <div className="text-xs text-gray-500">SKU: {foundProduct.sku}</div>
                    <div className="text-xs text-gray-500">DisponÃ­vel: {foundProduct.available} â€¢ Previsto: {foundProduct.expected}</div>
                    <div className="text-sm text-gray-800 mt-1">R$ {foundProduct.price.toFixed(2)}</div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <input type="number" defaultValue={1} min={1} className="w-20 border border-gray-100 rounded p-1 text-sm" id="qty-add" />
                    <button onClick={() => addToCart(Number(document.getElementById('qty-add').value) || 1)} className="px-3 py-2 bg-green-600 text-white rounded-md">Adicionar ao carrinho</button>
                  </div>
                </div>
              )}

              <div>
                <div className="text-sm font-semibold">Carrinho</div>
                <div className="mt-2 space-y-2">
                  {cart.length === 0 ? (
                    <div className="text-xs text-gray-500">Nenhum produto adicionado.</div>
                  ) : (
                    cart.map((p) => (
                      <div key={p.sku} className="flex items-center justify-between border border-gray-50 rounded p-2">
                        <div>
                          <div className="text-sm font-medium">{p.name}</div>
                          <div className="text-xs text-gray-500">SKU: {p.sku}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-sm">Qtd: {p.qty}</div>
                          <div className="text-sm">R$ {(p.price * p.qty).toFixed(2)}</div>
                          <button onClick={() => removeFromCart(p.sku)} className="text-xs text-red-600">Remover</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <div className="text-sm font-semibold mb-3">Revisar Pedido</div>
              <div className="space-y-2">
                {cart.length === 0 ? (
                  <div className="text-xs text-gray-500">Carrinho vazio.</div>
                ) : (
                  cart.map((p) => (
                    <div key={p.sku} className="flex items-center justify-between border border-gray-50 rounded p-2">
                      <div>
                        <div className="text-sm font-medium">{p.name}</div>
                        <div className="text-xs text-gray-500">SKU: {p.sku}</div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-sm">Qtd: {p.qty}</div>
                        <div className="text-sm">R$ {(p.price * p.qty).toFixed(2)}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="text-sm font-semibold mb-3">Entrega</div>
              <div className="space-y-3">
                <label className="text-xs text-gray-600">EndereÃ§o de entrega</label>
                <select value={selectedAddress} onChange={(e) => setSelectedAddress(e.target.value)} className="w-full border border-gray-100 rounded p-2">
                  <option value="end_local">Retirar no Local</option>
                  <option value="end_client">EndereÃ§o do Cliente</option>
                </select>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="text-sm font-semibold mb-3">InformaÃ§Ãµes Adicionais</div>
              <div className="grid grid-cols-1 gap-3">
                <label className="text-xs">Ref. Pedido Cliente (obrigatÃ³rio)</label>
                <input value={customerRef} onChange={(e) => setCustomerRef(e.target.value)} className="border border-gray-100 rounded p-2" />

                <label className="text-xs">ObservaÃ§Ãµes</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="border border-gray-100 rounded p-2" rows={3} />

                <label className="text-xs">Transportadora</label>
                <select value={carrier} onChange={(e) => setCarrier(e.target.value)} className="border border-gray-100 rounded p-2">
                  <option value="">Selecione</option>
                  {CARRIERS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs">DANFE (NF-e)</label>
                    <input type="file" onChange={(e) => handleFileChange(e, 'danfe')} className="w-full text-sm" />
                  </div>
                  <div>
                    <label className="text-xs">Etiqueta de envio</label>
                    <input type="file" onChange={(e) => handleFileChange(e, 'label')} className="w-full text-sm" />
                  </div>
                  <div>
                    <label className="text-xs">Outros anexos</label>
                    <input type="file" multiple onChange={(e) => handleFileChange(e, 'others')} className="w-full text-sm" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <div className="text-sm font-semibold mb-3">Pagamento & Resumo</div>
              <div className="border border-gray-50 rounded p-3">
                <div className="flex items-center justify-between"><div className="text-sm">Subtotal</div><div>R$ {subtotal.toFixed(2)}</div></div>
                <div className="flex items-center justify-between mt-2"><div className="text-sm">Frete</div><div>R$ {shipping.toFixed(2)}</div></div>
                <div className="flex items-center justify-between mt-3 font-semibold"><div>Total</div><div>R$ {total.toFixed(2)}</div></div>
              </div>
              <div className="mt-4 text-sm text-gray-600">Confirme os dados e clique em Confirmar para criar a ordem.</div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={prev} disabled={step === 0} className="px-3 py-2 rounded bg-white border border-gray-100 text-sm disabled:opacity-50">Anterior</button>
            {step < 4 && <button onClick={next} className="px-3 py-2 rounded bg-purple-600 text-white text-sm">PrÃ³ximo</button>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-2 rounded bg-white border border-gray-100 text-sm">Cancelar</button>
            {step === 4 && <button onClick={submit} className="px-4 py-2 rounded bg-green-600 text-white text-sm">Confirmar</button>}
          </div>
        </div>
      </div>
    </div>
  )
}
