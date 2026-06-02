import { io } from 'socket.io-client'

let _socket = null

export function getSocket() {
  if (!_socket) {
    _socket = io(import.meta.env.VITE_API_URL || 'http://localhost:4000', {
      autoConnect: false,
      transports: ['websocket'],
    })
  }
  return _socket
}
