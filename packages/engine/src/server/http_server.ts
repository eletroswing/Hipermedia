import http from "node:http";
import fs from "node:fs";
import ServerRoutes from "@api/routes/server";
import SessionRoutes from "@api/routes/sessions";
import cors from "cors";
import express, { type Request as Req, type Response as Res } from "express";
import Context from "@/core/context";
import logger from "@/core/logger";
import FlvSession from "@/session/flv_session";
import HlsServer from "@/server/hls_server";
import WebSocket, {WebSocketServer, type Server} from "ws"
import path from "node:path";

export default class NodeHttpServer {
	httpServer:
		| http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>
		| undefined;
	wsServer: Server<typeof WebSocket, typeof http.IncomingMessage> | undefined;
	hlsServer: HlsServer;
	constructor() {
		const app = express();
		app.use(cors());

		// HLS routes - must be before FLV routes
		app.get("/live/:app/:name/index.m3u8", this.handleHlsPlaylist);
		app.get("/live/:app/:name/:segment", this.handleHlsSegment);

		app.all("/:app/:name.flv", this.handleFlv);
		this.hlsServer = new HlsServer();
		
		app.use("/public", express.static(path.join(__dirname, "../../public")));
		app.get("/", (_req, res) => {
			res.sendFile(path.join(__dirname, "../../public", "index.html"));
			return
		});
		app.get("/active-streams", this.handleActiveStreams);
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

		// Start HLS server
		this.hlsServer.run();
	};

	handleFlv = (req: Req | http.IncomingMessage, res: Res | WebSocket) => {
		const session = new FlvSession(req, res);
		session.run();
	};

	handleHlsPlaylist = (req: Req, res: Res) => {
		const { app, name } = req.params;
		const streamPath = `/${app}/${name}`;

		const playlistPath = this.hlsServer.getPlaylistPath(streamPath);

		if (!playlistPath) {
			logger.debug(`HLS playlist not found for ${streamPath}`);
			res.status(404).json({ error: "Stream not found or not ready" });
			return;
		}

		res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
		res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
		res.setHeader("Access-Control-Allow-Origin", "*");

		const stream = fs.createReadStream(playlistPath);
		stream.pipe(res);
	};

	handleHlsSegment = (req: Req, res: Res) => {
		const { app, name, segment } = req.params;
		const streamPath = `/${app}/${name}`;

		if (!segment) {
			res.status(400).json({ error: "Segment name required" });
			return;
		}

		const segmentPath = this.hlsServer.getSegmentPath(streamPath, segment);

		if (!segmentPath) {
			logger.debug(`HLS segment not found: ${segment} for ${streamPath}`);
			res.status(404).json({ error: "Segment not found" });
			return;
		}

		res.setHeader("Content-Type", "video/mp2t");
		res.setHeader("Cache-Control", "public, max-age=60");
		res.setHeader("Access-Control-Allow-Origin", "*");

		const stream = fs.createReadStream(segmentPath);
		stream.pipe(res);
	};

	handleActiveStreams = (req: Req, res: Res) => {
		const host = req.get("host") ?? `${Context.config.bind ?? "127.0.0.1"}:${Context.config.http?.port ?? 8000}`;
		const activeStreams = this.hlsServer.getActiveStreamPaths().reduce(
			(acc, streamPath) => {
				const [, app, streamKey] = streamPath.split("/");
				if (!app || !streamKey) {
					return acc;
				}

				acc[streamKey] = `https://${host}/live/${app}/${encodeURIComponent(streamKey)}/index.m3u8`;
				return acc;
			},
			{} as Record<string, string>,
		);

		res.json(activeStreams);
	};
}
