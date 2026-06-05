import { io } from 'socket.io-client'

let _socket = null

export function getSocket() {
  if (!_socket) {
    _socket = io(import.meta.env.VITE_API_URL || 'http://localhost:4000', {
      autoConnect: false,
      // Start with polling so Railway's proxy can establish the connection,
      // then upgrade to WebSocket once the session is open
      transports: ['polling', 'websocket'],
    })
  }
  return _socket
}
