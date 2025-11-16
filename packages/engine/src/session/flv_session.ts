import type { Request as Req, Response as Res } from "express";
import type AVPacket from "@/core/avpacket";
import Context from "@/core/context";
import logger from "@/core/logger";
import Flv from "@/protocol/flv";
import type BroadcastServer from "@/server/broadcast_server";
import BaseSession from "./base_session";

export default class FlvSession extends BaseSession {
	req: Req;
	res: Res;
	flv: Flv;
	isPublisher: boolean;
	broadcast: BroadcastServer | undefined;

	constructor(req: Req, res: Res) {
		super();
		this.req = req;
		this.res = res;
		this.ip = `${req.socket.remoteAddress}:${req.socket.remotePort}`;
		this.flv = new Flv();
		this.protocol = "flv";
		this.isPublisher = false;

		this.streamHost = req.hostname;
		this.streamApp = req.params.app as string;
		this.streamName = req.params.name as string;
		this.streamPath = `/${this.streamApp}/${this.streamName}`;
		this.streamQuery = req.query as { sign: string };

		this.broadcast = Context.broadcasts.get(this.streamPath);

		if (!this.broadcast) {
			res.status(404);
			res.socket?.end();
			this.onClose();
		}
	}

	run = () => {
		this.req.on("data", this.onData);
		this.req.on("error", this.onError);
		this.req.socket.on("close", this.onClose);

		if (this.isPublisher) {
			this.onPush();
		} else {
			this.onPlay();
		}
	};

	onPlay = () => {
		const err = this.broadcast?.postPlay(this);
		if (err != null) {
			logger.error(
				`FLV session ${this.id} ${this.ip} play ${this.streamPath} error, ${err}`,
			);
			this.close();
			return;
		}
		this.isPublisher = false;
		logger.info(
			`FLV session ${this.id} ${this.ip} start play ${this.streamPath}`,
		);
	};

	onPush = () => {
		const err = this.broadcast?.postPublish(this);
		if (err != null) {
			logger.error(
				`FLV session ${this.id} ${this.ip} push ${this.streamPath} error, ${err}`,
			);
			this.close();
			return;
		}
		this.isPublisher = true;
		this.flv.onPacketCallback = this.onPacket;
		logger.info(
			`FLV session ${this.id} ${this.ip} start push ${this.streamPath}`,
		);
	};

	onData = (data: Buffer) => {
		this.inBytes += data.length;
		const err = this.flv.parserData(data);
		if (err != null) {
			logger.error(
				`FLV session ${this.id} ${this.ip} parserData error, ${err}`,
			);
			this.close();
		}
	};

	onClose = () => {
		logger.info(`FLV session ${this.id} close`);
		if (this.isPublisher) {
			this.broadcast?.donePublish(this);
		} else {
			this.broadcast?.donePlay(this);
		}
	};

	onError = (err: string) => {
		logger.error(`FLV session ${this.id} ${this.ip} socket error, ${err}`);
	};

	onPacket = (packet: AVPacket) => {
		this.broadcast?.broadcastMessage(packet);
	};

	override sendBuffer = (buffer: Buffer) => {
		if (this.res instanceof WebSocket) {
			if (this.res.readyState !== WebSocket.OPEN) {
				return;
			}
			this.res.send(buffer);
		} else {
			if (this.res.writableEnded) {
				return;
			}
			this.res.write(buffer);
		}
		this.outBytes += buffer.length;
	};

	override close = () => {
		if (this.res instanceof WebSocket) {
			this.res.close();
		} else {
			this.res.end();
		}
	};
}
