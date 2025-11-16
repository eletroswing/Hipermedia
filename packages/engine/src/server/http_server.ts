import http from "node:http";
import ServerRoutes from "@api/routes/server";
import SessionRoutes from "@api/routes/sessions";
import cors from "cors";
import express, { type Request as Req, type Response as Res } from "express";
import H2EBridge from "http2-express";
import Context from "@/core/context";
import logger from "@/core/logger";
import FlvSession from "@/session/flv_session";

export default class NodeHttpServer {
	httpServer:
		| http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>
		| undefined;
	constructor() {
		const app = H2EBridge(express);

		if (Context.config.static?.router && Context.config.static?.root) {
			// @ts-ignore
			app.use(
				Context.config.static.router,
				express.static(Context.config.static.root),
			);
		}

		// @ts-ignore
		app.use(cors());

		// @ts-ignore
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
			},
		);
	};

	handleFlv = (req: Req, res: Res) => {
		const session = new FlvSession(req, res);
		session.run();
	};
}
