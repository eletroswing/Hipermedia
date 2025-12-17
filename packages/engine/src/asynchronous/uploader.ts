/*

import nodePath from "node:path"
import fs from "node:fs"
import chokidar from "chokidar";
import { SERVER_ID, TMP_DIR } from "@/integration/server";
import { uploadFile } from "@/integration/s3";
import { redis } from "@/integration/redis"

const watcher = chokidar.watch(TMP_DIR, {
persistent: true,
ignoreInitial: true,
usePolling: true,
interval: 100,
});

watcher.on("change", async (path) => {
if (!path.endsWith("index.m3u8")) return
await new Promise(res => setTimeout(res, 50));
let originalContent = fs.readFileSync(path).toString()
const fileContent = fs.readFileSync(path).toString().split("\n").filter(line => line.startsWith("segments_"))

for (const segment of fileContent) {
const segmentPath = nodePath.join(path.replace("index.m3u8", ""), segment)
const slicedKey = path.split(nodePath.sep)
const key = `${slicedKey[slicedKey.length - 3]}/${slicedKey[slicedKey.length - 2]}`

var uploaded = await redis.get(`hipermidia:server:${SERVER_ID}:file:${`${key}/${segment}`}`)
if (!uploaded) {
  const url = await uploadFile(segmentPath, `${key}/${segment}`)
  await redis.setex(`hipermidia:server:${SERVER_ID}:file:${`${key}/${segment}`}`, 60, url)
  uploaded = url
}
originalContent = originalContent.replaceAll(segment, uploaded)
await redis.setex(`hipermidia:server:${SERVER_ID}:stream:${key}`, 60, originalContent)

// record the stream
// get what already exists from the stream
var recorded = await redis.get(`hipermidia:server:${SERVER_ID}:record:${key}`)
if (!recorded) recorded = `#EXTM3U
#EXT-X-VERSION:6
#EXT-X-TARGETDURATION:2
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-INDEPENDENT-SEGMENTS
#EXT-X-ENDLIST`
//check if already is on the list
if (!recorded.includes(segment)) {
  //remove last line 
  let split = recorded.split("\n")
  split.pop()
  recorded = split.join("\n")

  //add item to manifest
  recorded += `
#EXTINF:2.000000,
${uploaded}
#EXT-X-ENDLIST`

  await redis.setex(`hipermidia:server:${SERVER_ID}:record:${key}`, 300, recorded)
  //write the recording
  fs.writeFileSync(nodePath.join(path.replace("index.m3u8", ""), "recorded.m3u8"), recorded)
  await uploadFile(nodePath.join(path.replace("index.m3u8", ""), "recorded.m3u8"), `${key}/recorded.m3u8`)
}

}
});*/