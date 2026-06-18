import 'dotenv/config'
import * as Sentry from '@sentry/node'

// Init Sentry — no-op when SENTRY_DSN is not set
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'production',
    tracesSampleRate: 0.2,
  })
}

import { createServer } from 'http'
import { Server } from 'socket.io'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { latLngToH3 } from './lib/geo.js'
import { setIo } from './lib/io.js'
import { supabase } from './lib/supabase.js'
import thotsRouter from './routes/thots.js'
import authRouter from './routes/auth.js'
import commentsRouter from './routes/comments.js'
import reportsRouter from './routes/reports.js'
import adminRouter from './routes/admin.js'
import followsRouter from './routes/follows.js'
import usersRouter from './routes/users.js'
import messagesRouter from './routes/messages.js'
import pushRouter from './routes/push.js'
import { startDigestJob } from './jobs/digestEmail.js'
import { startDeletionCron } from './lib/deletionCron.js'

const app = express()
const httpServer = createServer(app)

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN?.split(',').map(s => s.trim()) || ['http://localhost:5173']

const io = new Server(httpServer, {
  cors: { origin: FRONTEND_ORIGIN, methods: ['GET', 'POST'] },
})

setIo(io)
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
app.use('/users', usersRouter)
app.use('/messages', messagesRouter)
app.use('/push', pushRouter)

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

  // Personal room — authenticated users join user:<id> for DM push
  socket.on('user:join', async ({ token }) => {
    if (!token) return
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return
    socket.join(`user:${user.id}`)
    socket.data.userId = user.id
  })
})

// Sentry error handler — must be registered after all routes
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app)
}


const PORT = process.env.PORT || 4000
startDeletionCron()

startDigestJob()
httpServer.listen(PORT, () => {
  console.log(`Thots server running on port ${PORT}`)
})
