import Context, { type ConfigType } from "./core/context";
import NodeHttpServer from "./server/http_server";
import NodeRtmpServer from "./server/rtmp_server";
import type BaseSession from "./session/base_session";

export class Hipermedia {
	httpServer: NodeHttpServer;
	rtmpServer: NodeRtmpServer;
	constructor(config: ConfigType) {
		Context.config = config;
		this.httpServer = new NodeHttpServer();
		this.rtmpServer = new NodeRtmpServer();
	}

	on(eventName: string, listener: (session: BaseSession) => void) {
		Context.eventEmitter.on(eventName, listener);
	}

	run() {
		this.httpServer.run();
		this.rtmpServer.run();
	}
}
