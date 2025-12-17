import { redis } from "./../integration/redis";

export async function getAllStreams() {
  const allStreams = await redis.keys("hipermidia:*:stream:*")
  return allStreams
}

export async function getOneStream(key: string) {
  const allStreams = await redis.get(key)
  return allStreams
}
