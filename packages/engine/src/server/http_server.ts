import http from "node:http";
import ServerRoutes from "@api/routes/server";
import SessionRoutes from "@api/routes/sessions";
import cors from "cors";
import express, { type Request as Req, type Response as Res } from "express";
import Context from "@/core/context";
import logger from "@/core/logger";
import FlvSession from "@/session/flv_session";
import WebSocket, {WebSocketServer, type Server} from "ws"

export default class NodeHttpServer {
	httpServer:
		| http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>
		| undefined;
	wsServer: Server<typeof WebSocket, typeof http.IncomingMessage> | undefined;
	constructor() {
		const app = express();
		app.use(cors());
		app.all("/:app/:name.flv", this.handleFlv);
		app.use("/api/sessions", SessionRoutes);
		app.use("/api/server", ServerRoutes);

		if (Context.config.http?.port) {
			this.httpServer = http.createServer(app);
		}
	}

	run = () => {
		this.httpServer?.listen(
			Context.config.http?.port ?? 8000,
			Context.config.bind ?? "0.0.0.0",
			() => {
				logger.info(
					`HTTP server listening on port ${Context.config.bind}:${Context.config.http?.port ?? 8000}`,
				);
				logger.info(
					`WS server listening on port ${Context.config.bind}:${Context.config.http?.port ?? 8000}`,
				);
			},
		);

		this.wsServer = new WebSocketServer({ server: this.httpServer });
      this.wsServer.on("connection", (ws, req) => {
        this.handleFlv(req, ws);
      });
	};

	handleFlv = (req: Req | http.IncomingMessage, res: Res | WebSocket) => {
		const session = new FlvSession(req, res);
		session.run();
	};
}
