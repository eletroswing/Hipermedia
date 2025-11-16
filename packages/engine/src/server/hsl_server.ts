import fs from "node:fs";
import Context from "@/core/context";
import logger from "@/core/logger";
import type BaseSession from "@/session/base_session";
import HlsSession from "@/session/hls_session";

export default class NodeHlsServer {
	errored: boolean;

	constructor() {
		this.errored = true;

		if (Context.config.hls?.active) {
			if (!Context.config.ffmpeg) {
				this.onError("You need to set the ffmpeg if you want to use hls.");
				return;
			}

			this.errored = false;
		}
	}

	onError = (error: string) => {
		logger.error(error);
	};

	run = () => {
		if (this.errored) return;

		if (!fs.existsSync(Context.config.ffmpeg as string)) {
			this.onError("[ HLS ] Error initializing hls. FFmpeg not found.");
			this.errored = true;
			return;
		}

		if (!fs.existsSync(Context.config.static?.root ?? "./media"))
			fs.mkdirSync(Context.config.static?.root ?? "./media");

		Context.eventEmitter.on("postPublish", this.onPostPublish);
		Context.eventEmitter.on("donePublish", this.onDonePublish);

		logger.info("[ HLS ] Server Initialized.");
	};

	onPostPublish = (session: BaseSession) => {
		const key = `${session.streamApp}/${session.streamName}`;
		const hlsSessionExists = Context.hlsSessions.get(key);
		if (hlsSessionExists) return;

		const hlsSession = new HlsSession(session.streamApp, session.streamName);

		hlsSession.on("close", () => {
			const key = `${session.streamApp}/${session.streamName}`;
			Context.hlsSessions.delete(key);
		});

		Context.hlsSessions.set(key, hlsSession);
		hlsSession.run();
	};

	onDonePublish = (session: BaseSession) => {
		const key = `${session.streamApp}/${session.streamName}`;
		const hlsSession = Context.hlsSessions.get(key);
		if (hlsSession) {
			hlsSession.close();
			Context.hlsSessions.delete(key);
		}
	};
}
