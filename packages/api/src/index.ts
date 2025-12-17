import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { getInfo } from "./modules/server"
import { getAllStreams, getOneStream } from "./modules/stream"

new Elysia()
  .use(cors())
  .get("/metrics", () => {
    return getInfo()
  })
  .get("/streams", () => getAllStreams())
  .get("/stream", async ({ query, set }) => {
    set.headers["content-type"] = "application/vnd.apple.mpegurl"
    set.headers["content-disposition"] = "attachment; filename=playlist.m3u8"
    return await getOneStream(query.key)
  }, {
    query: t.Object({
      key: t.String()
    })
  })
  .listen(process.env.PORT || 3001, ({ url, port }) => {
    console.log(`[API] 🦊 Running on ${url.hostname}:${port}...`);
  });
