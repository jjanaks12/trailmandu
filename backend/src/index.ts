import express from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'
import morgan from 'morgan'
import path from 'node:path'
import { execSync } from 'node:child_process'

import './alias'
import 'dotenv/config'

import router from '@/routes'
import { Redis } from '@/app/lib/services/redis.service'

const PORT = process.env.PORT || 3000
const MAX_RETRIES = 3
let retryCount = 0

function killPortProcess(port: number | string) {
    try {
        const result = execSync(`lsof -t -i :${port}`, { encoding: 'utf-8' }).trim()
        if (result) {
            const pids = result.split('\n').map((p) => p.trim()).filter(Boolean)
            pids.forEach((pid) => {
                console.warn(`[Server] Port ${port} in use by PID ${pid}. Killing it...`)
                process.kill(Number(pid), 'SIGKILL')
            })
            return true
        }
    } catch {
        // No process found on port — safe to ignore
    }
    return false
}

function startServer() {
    const app = express()
    const __basedir = path.join(__dirname, 'resources')

    app.use(morgan('dev'))
    app.use(cors())
    app.use(bodyParser.json({
        limit: '50mb'
    }))
    app.use(router)

    const server = app.listen(PORT, () => {
        Redis.start()
        console.log(`Server is running on http://localhost:${PORT}`)
        retryCount = 0 // reset on successful start
    })

    server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`[Server] Port ${PORT} already in use.`)
            const killed = killPortProcess(PORT)
            if (killed) {
                console.log(`[Server] Killed process on port ${PORT}. Restarting in 1s...`)
                setTimeout(startServer, 1000)
            } else {
                console.error(`[Server] Could not free port ${PORT}. Falling back to crash handler.`)
                handleCrash(err)
            }
        } else {
            console.error('[Server] Error:', err.message)
            handleCrash(err)
        }
    })

    return { app, server, __basedir }
}

function handleCrash(err: Error) {
    if (retryCount < MAX_RETRIES) {
        retryCount++
        console.error(`[Server] Crashed. Restarting... (attempt ${retryCount}/${MAX_RETRIES})`)
        setTimeout(startServer, 1000)
    } else {
        console.error(`[Server] Crashed ${MAX_RETRIES} times. Giving up. Last error:`, err.message)
        process.exit(1)
    }
}

process.on('uncaughtException', (err) => {
    console.error('[uncaughtException]', err)
    handleCrash(err)
})

process.on('unhandledRejection', (reason) => {
    console.error('[unhandledRejection]', reason)
    handleCrash(reason instanceof Error ? reason : new Error(String(reason)))
})

const { app, server, __basedir } = startServer()

export { app, server, __basedir }