import net, { type Server, type Socket } from "node:net";
import Context from "@/core/context";
import logger from "@/core/logger";
import RtmpSession from "@/session/rtmp_session";

export default class NodeRtmpServer {
	tcpServer: Server | undefined;
	constructor() {
		if (Context.config.rtmp?.port) {
			this.tcpServer = net.createServer(this.handleRequest);
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
	};

	handleRequest = (socket: Socket) => {
		const session = new RtmpSession(socket);
		session.run();
	};
}
