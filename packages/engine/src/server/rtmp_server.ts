import fs from "node:fs";
import net, { type Server, type Socket } from "node:net";
import tls from "node:tls";
import Context from "@/core/context";
import logger from "@/core/logger";
import RtmpSession from "@/session/rtmp_session";

export default class NodeRtmpServer {
	tcpServer: Server | undefined;
	tlsServer: tls.Server | undefined;
	constructor() {
		if (Context.config.rtmp?.port) {
			this.tcpServer = net.createServer(this.handleRequest);
		}
		if (Context.config.rtmps?.port) {
			const opt = {
				key: fs.readFileSync(Context.config.rtmps.key),
				cert: fs.readFileSync(Context.config.rtmps.cert),
			};
			this.tlsServer = tls.createServer(opt, this.handleRequest);
		}
	}

	run = () => {
		this.tcpServer?.listen(
			Context.config.rtmp?.port ?? 1935,
			Context.config.bind ?? "0.0.0.0",
			() => {
				logger.info(
					`Rtmp Server listening on port ${Context.config.bind}:${Context.config.rtmp?.port ?? 1935}`,
				);
			},
		);
		this.tlsServer?.listen(
			Context.config.rtmps?.port ?? 1936,
			Context.config.bind ?? "0.0.0.0",
			() => {
				logger.info(
					`Rtmps Server listening on port ${Context.config.bind}:${Context.config.rtmps?.port ?? 1936}`,
				);
			},
		);
	};

	handleRequest = (socket: Socket) => {
		const session = new RtmpSession(socket);
		session.run();
	};
}
