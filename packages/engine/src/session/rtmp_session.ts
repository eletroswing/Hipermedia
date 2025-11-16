import type { Socket } from "node:net";
import type AVPacket from "@/core/avpacket";
import Context from "@/core/context";
import logger from "@/core/logger";
import Rtmp from "@/protocol/rtmp";
import BroadcastServer from "@/server/broadcast_server";
import BaseSession from "./base_session";

export default class RtmpSession extends BaseSession {
	socket: Socket;
	rtmp: Rtmp;
	broadcast: BroadcastServer;
	isPublisher: boolean | undefined;
	constructor(socket: Socket) {
		super();
		this.socket = socket;
		this.ip = `${socket.remoteAddress}:${socket.remotePort}`;
		this.protocol = "rtmp";
		this.rtmp = new Rtmp();
		this.broadcast = new BroadcastServer();
	}

	run = () => {
		this.rtmp.onConnectCallback = this.onConnect;
		this.rtmp.onPlayCallback = this.onPlay;
		this.rtmp.onPushCallback = this.onPush;
		this.rtmp.onOutputCallback = this.onOutput;
		this.rtmp.onPacketCallback = this.onPacket;
		this.socket.on("data", this.onData);
		this.socket.on("close", this.onClose);
		this.socket.on("error", this.onError);
	};

	onConnect = (request: object) => {
		const req: {
			app: string;
			name: string;
			host: string;
			query: { sign: string };
		} = request as {
			app: string;
			name: string;
			host: string;
			query: { sign: string };
		};
		this.streamApp = req.app;
		this.streamName = req.name;
		this.streamHost = req.host;
		this.streamPath = `/${req.app}/${req.name}`;
		this.streamQuery = req.query;
		this.broadcast =
			Context.broadcasts.get(this.streamPath) ?? new BroadcastServer();
		Context.broadcasts.set(this.streamPath, this.broadcast);
	};

	onPlay = () => {
		const err = this.broadcast?.postPlay(this);
		if (err != null) {
			logger.error(
				`RTMP session ${this.id} ${this.ip} play ${this.streamPath} error, ${err}`,
			);
			this.socket.end();
			return;
		}
		this.isPublisher = false;
		logger.info(
			`RTMP session ${this.id} ${this.ip} start play ${this.streamPath}`,
		);
	};

	onPush = () => {
		const err = this.broadcast?.postPublish(this);
		if (err != null) {
			logger.error(
				`RTMP session ${this.id} ${this.ip} push ${this.streamPath} error, ${err}`,
			);
			this.socket.end();
			return;
		}
		this.isPublisher = true;
		logger.info(
			`RTMP session ${this.id} ${this.ip} start push ${this.streamPath}`,
		);
	};

	onOutput = (buffer: Buffer) => {
		this.socket.write(buffer);
	};

	onPacket = (packet: AVPacket) => {
		this.broadcast?.broadcastMessage(packet);
	};

	onData = (data: Buffer) => {
		this.inBytes += data.length;
		const err = this.rtmp.parserData(data);
		if (err != null) {
			logger.error(
				`RTMP session ${this.id} ${this.ip} parserData error, ${err}`,
			);
			this.socket.end();
		}
	};

	onClose = () => {
		logger.info(`RTMP session ${this.id} close`);
		if (this.isPublisher) {
			this.broadcast?.donePublish(this);
			Context.broadcasts.delete(this.streamPath);
		} else {
			this.broadcast?.donePlay(this);
		}
	};

	onError = (error: Error) => {
		logger.info(
			`RTMP session ${this.id} socket error, ${error.name}: ${error.message}`,
		);
	};

	override sendBuffer = (buffer: Buffer) => {
		this.outBytes += buffer.length;
		this.socket.write(buffer);
	};

	override close = () => {
		this.socket.end();
	};
}
