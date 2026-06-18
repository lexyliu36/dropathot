// Shared Socket.io instance — avoids circular imports between index.js and routes.
let _io = null

export function setIo(io) {
  _io = io
}

export function getIo() {
  return _io
}
