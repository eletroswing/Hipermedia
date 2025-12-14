import { redis } from "./../integration/redis";
import { findRecordedFiles } from "./../integration/s3";

export async function getAllStreams() {
  const allStreams = await redis.keys("hipermidia:*:stream:*")
  return allStreams
}

export async function getOneStream(key: string) {
  const allStreams = await redis.get(key)
  return allStreams
}

export async function getAllRecordings() {
  return await findRecordedFiles()
}