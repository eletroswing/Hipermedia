import { logger } from "@/utils/logger"
import { session } from "@/protocol/rtmp/session"
import { SERVER_ID } from "@/integration/server";
import "@/asynchronous/server_monitoring";
import "@/asynchronous/uploader";

type Body = {
  session: ReturnType<typeof session>
}

export type Socket = Bun.Socket<Body>
const port = Number(process.env.RTMP_PORT ?? 1935)

Bun.listen<Body>({
  hostname: "0.0.0.0",
  port: port,
  socket: {
    open(socket) {
      const currentSession = session(socket)
      socket.data = { session: currentSession }
    },

    data(socket, data) {
      socket.data.session.onData(data)
    },

    close(socket) {
      socket.data.session.onClose()
    },

    error(socket, err) {
      socket.data.session.onError(err)
    },
  },
});

logger.info(`[HIPERMEDIA] Using the following server id: ${SERVER_ID}`)
logger.info(`[RTMP SERVER] Server Listening At ${port}`)
