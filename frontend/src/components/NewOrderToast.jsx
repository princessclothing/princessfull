import React, { useEffect } from 'react'

export default function NewOrderToast({ alert, onClick, onClose }) {
  // alert { type: 'new'|'updated'|'cancelled', order }
  if (!alert) return null

  const { type, order } = alert
  const color = type === 'new' ? 'bg-green-600' : 'bg-yellow-600'
  const emoji = type === 'new' ? '🔔' : '⚠️'
  const text = type === 'new'
    ? `🔔 Novo pedido recebido! #${order.id}`
    : `⚠️ Pedido atualizado #${order.id}`

  useEffect(() => {
    const id = setTimeout(onClose, 5000)
    return () => clearTimeout(id)
  }, [onClose])

  return (
    <div
      className={`fixed top-4 right-4 max-w-xs px-4 py-3 rounded-lg text-white shadow-lg cursor-pointer ${color} animate-fade-in`}
      onClick={onClick}
    >
      {text}
    </div>
  )
}
