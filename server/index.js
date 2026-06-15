import 'dotenv/config'
import { createServer } from 'http'
import { Server } from 'socket.io'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { latLngToH3 } from './lib/geo.js'
import thotsRouter from './routes/thots.js'
import authRouter from './routes/auth.js'
import commentsRouter from './routes/comments.js'
import reportsRouter from './routes/reports.js'
import adminRouter from './routes/admin.js'
import followsRouter from './routes/follows.js'
import messagesRouter from './routes/messages.js'
import { startDigestJob } from './jobs/digestEmail.js'
import { startDeletionCron } from './lib/deletionCron.js'

const app = express()
const httpServer = createServer(app)

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN?.split(',').map(s => s.trim()) || ['http://localhost:5173']

const io = new Server(httpServer, {
  cors: { origin: FRONTEND_ORIGIN, methods: ['GET', 'POST'] },
})

app.use(helmet({ crossOriginResourcePolicy: false }))

const corsOptions = { origin: FRONTEND_ORIGIN, credentials: true, optionsSuccessStatus: 204 }
app.use(cors(corsOptions))
app.options('*', cors(corsOptions))   // explicit preflight for all routes
app.use(express.json())
app.use(cookieParser())

// Make io available in route handlers
app.use((req, _res, next) => {
  req.io = io
  next()
})

app.use('/thots', thotsRouter)
app.use('/auth', authRouter)
app.use('/comments', commentsRouter)
app.use('/reports', reportsRouter)
app.use('/admin', adminRouter)
app.use('/follows', followsRouter)
app.use('/messages', messagesRouter)

app.get('/health', (_req, res) => res.json({ ok: true }))

// Socket.io — H3 room subscriptions
io.on('connection', (socket) => {
  socket.on('subscribe', ({ lat, lng }) => {
    if (typeof lat !== 'number' || typeof lng !== 'number') return
    const cell = latLngToH3(lat, lng)
    socket.join(cell)
    socket.data.cell = cell
  })

  socket.on('unsubscribe', () => {
    if (socket.data.cell) {
      socket.leave(socket.data.cell)
      socket.data.cell = null
    }
  })
})

const PORT = process.env.PORT || 4000
startDeletionCron()

startDigestJob()
httpServer.listen(PORT, () => {
  console.log(`Thots server running on port ${PORT}`)
})
