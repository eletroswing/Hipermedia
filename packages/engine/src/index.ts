import Context, { type ConfigType } from "./core/context";
import NodeHlsServer from "./server/hsl_server";
import NodeHttpServer from "./server/http_server";
import NodeNotifyServer from "./server/notify_server";
import NodeRtmpServer from "./server/rtmp_server";
import type BaseSession from "./session/base_session";

export class Hipermedia {
	httpServer: NodeHttpServer;
	rtmpServer: NodeRtmpServer;
	notifyServer: NodeNotifyServer;
	hlsServer: NodeHlsServer;
	constructor(config: ConfigType) {
		Context.config = config;
		this.httpServer = new NodeHttpServer();
		this.rtmpServer = new NodeRtmpServer();
		this.notifyServer = new NodeNotifyServer();
		this.hlsServer = new NodeHlsServer();
	}

	on(eventName: string, listener: (session: BaseSession) => void) {
		Context.eventEmitter.on(eventName, listener);
	}

	run() {
		this.httpServer.run();
		this.rtmpServer.run();
		this.notifyServer.run();
		this.hlsServer.run();
	}
}
