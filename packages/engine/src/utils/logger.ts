import pino from "pino";
import { SERVER_ID } from "@/integration/server";
import { redis } from "@/integration/redis"

export const logger = pino({}, {
  write: async (msg) => {
    const pinoObject = JSON.parse(msg)
    const logDate = new Date(pinoObject.time).toISOString()
    const logMessage = pinoObject.msg

    process.stdout.write(`[${logDate}] ${logMessage} \n`)

    redis
      .multi()
      .rpush(`hipermidia:server:${SERVER_ID}:logs`, msg)
      .ltrim(`hipermidia:server:${SERVER_ID}:logs`, -20, -1)
      .expire(`hipermidia:server:${SERVER_ID}:logs`, 300)
      .exec();
  }
})