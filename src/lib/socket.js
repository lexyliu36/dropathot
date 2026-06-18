import { io } from 'socket.io-client'

let _socket = null
let _userToken = null  // remember the token so reconnects can re-join the room

export function getSocket() {
  if (!_socket) {
    _socket = io(import.meta.env.VITE_API_URL || 'http://localhost:4000', {
      autoConnect: false,
      // Start with polling so Railway's proxy can establish the connection,
      // then upgrade to WebSocket once the session is open
      transports: ['polling', 'websocket'],
    })

    // Re-join personal room after any reconnect (e.g. network drop, server restart)
    _socket.on('connect', () => {
      if (_userToken) {
        _socket.emit('user:join', { token: _userToken })
      }
    })
  }
  return _socket
}

/**
 * Join the authenticated user's personal socket room (user:<id>).
 * Call once after login — also called automatically on every reconnect.
 */
export function joinUserRoom(token) {
  if (!token) return
  _userToken = token  // store for reconnects
  const socket = getSocket()
  if (socket.connected) {
    socket.emit('user:join', { token })
  } else {
    // connect() is idempotent — safe to call even if already connecting
    socket.connect()
    // the 'connect' handler above will emit user:join once connected
  }
}
