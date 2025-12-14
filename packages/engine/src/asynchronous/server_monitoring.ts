import { SERVER_ID } from "@/integration/server";
import { redis } from "@/integration/redis"
import { getServerMetrics } from "@/utils/metric"

setInterval(async () => {
  await redis.setex(`hipermidia:server:${SERVER_ID}:metrics`, 300, JSON.stringify(await getServerMetrics()))
}, 15_000) //15_seconds