import createHttpError from 'http-errors'
import { createClient } from 'redis'

type RedisClient = ReturnType<typeof createClient>

export abstract class Redis {
    static client: RedisClient

    static start() {
        Redis.client = createClient({
            url: process.env.REDIS_URL
        })

        Redis.client.on('connect', Redis.connect)
        Redis.client.on('ready', Redis.ready)
        Redis.client.on("error", Redis.error)
        Redis.client.on("end", Redis.end)
        process.on("SIGINT", Redis.disconnect)
        Redis.client.connect()
    }

    static ready() {
        console.log("Client connected to redis and ready to use")
    }

    static connect() {
        console.log("Client connected to redis")
    }

    static error(error) {
        console.log(error.message)
    }

    static end() {
        console.log("Client disconneceted to redis")
    }

    static disconnect() {
        Redis.client.quit()
    }

    static set(key: string, value: string, ttl = -1) {
        return new Promise(async (resolve, reject) => {
            await Redis.client.set(key, value, {
                EX: ttl
            })
                .catch((error) => {
                    console.log(error.message)
                    reject(createHttpError.InternalServerError())
                })

            resolve(true)
        })
    }

    static get(key: string): Promise<string> {
        return new Promise(async (resolve, reject) => {
            const value = await Redis.client.get(key)
                .catch((error) => {
                    console.log(error.message)
                    reject(createHttpError.InternalServerError())
                })

            resolve(value ? value.toString() : '')
        })
    }

    static delete(key: string) {
        return new Promise(async (resolve, reject) => {
            await Redis.client.del(key)
                .catch((error) => {
                    console.log(error.message)
                    reject(createHttpError.InternalServerError())
                })

            resolve(true)
        })
    }
}