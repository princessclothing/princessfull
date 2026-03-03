import { useEffect, useState, useRef, useCallback } from 'react'
import { getPusherClient } from '../lib/pusherClient'

// Channel name must match what the backend publishes to.
// For single-tenant installs without shopId, use 'private-orders'.
// Pass shopId prop to scope to one tenant: private-orders-{shopId}
const getChannel = (shopId) =>
  shopId ? `private-orders-${shopId}` : 'private-orders'

export default function useRealtimeOrders(orders, setOrders, { shopId, onResync } = {}) {
  const [newOrderAlert, setNewOrderAlert] = useState(null)
  const [connected, setConnected] = useState(false)
  const channelRef    = useRef(null)
  const isMounted     = useRef(true)
  // named handler refs so we can unbind them precisely
  const connectedRef    = useRef(null)
  const disconnectedRef = useRef(null)

  // onResync is called when Pusher reconnects so the parent can re-fetch
  // any orders that arrived while the socket was offline
  const handleResync = useCallback(() => {
    if (onResync) onResync()
  }, [onResync])

  useEffect(() => {
    // Pusher not configured — skip silently
    const pusherClient = getPusherClient()
    if (!pusherClient) return

    isMounted.current = true
    const channelName = getChannel(shopId)
    const channel = pusherClient.subscribe(channelName)
    channelRef.current = channel

    const handleNew = data => {
      if (!data || !data.id) return
      setOrders(prev => {
        if (prev.some(o => o.id === data.id)) return prev
        if (isMounted.current) setNewOrderAlert({ type: 'new', order: data })
        return [data, ...prev]
      })
    }
    const handleUpdated = data => {
      if (!data || !data.id) return
      setOrders(prev => prev.map(o => (o.id === data.id ? { ...o, ...data } : o)))
      if (isMounted.current) setNewOrderAlert({ type: 'updated', order: data })
    }
    const handleCancelled = data => {
      if (!data || !data.id) return
      setOrders(prev => prev.map(o => (o.id === data.id ? { ...o, status: { ...o.status, transportadora: true } } : o)))
      if (isMounted.current) setNewOrderAlert({ type: 'cancelled', order: data })
    }

    channel.bind('new-order', handleNew)
    channel.bind('order-updated', handleUpdated)
    channel.bind('order-cancelled', handleCancelled)

    // FIX: store named handlers so we can unbind them precisely on cleanup
    connectedRef.current = () => {
      if (isMounted.current) setConnected(true)
    }
    disconnectedRef.current = () => {
      if (isMounted.current) setConnected(false)
    }
    // FIX: resync after reconnect — any events received while offline are lost;
    // trigger a REST refetch so the list stays consistent
    const reconnectedHandler = () => {
      if (isMounted.current) {
        setConnected(true)
        handleResync()
      }
    }

    pusherClient.connection.bind('connected',    connectedRef.current)
    pusherClient.connection.bind('disconnected', disconnectedRef.current)
    pusherClient.connection.bind('reconnected',  reconnectedHandler)

    setConnected(pusherClient.connection.state === 'connected')

    return () => {
      isMounted.current = false

      // FIX: unbind named connection listeners to prevent memory leaks
      pusherClient.connection.unbind('connected',    connectedRef.current)
      pusherClient.connection.unbind('disconnected', disconnectedRef.current)
      pusherClient.connection.unbind('reconnected',  reconnectedHandler)

      if (channelRef.current) {
        channelRef.current.unbind_all()
        pusherClient.unsubscribe(channelName)
      }
    }
  }, [setOrders, shopId, handleResync])

  const clearAlert = () => setNewOrderAlert(null)

  return { newOrderAlert, clearAlert, connected }
}
