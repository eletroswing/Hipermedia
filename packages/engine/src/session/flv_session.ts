import type { Request as Req, Response as Res } from "express";
import type AVPacket from "@/core/avpacket";
import Context from "@/core/context";
import logger from "@/core/logger";
import Flv from "@/protocol/flv";
import type BroadcastServer from "@/server/broadcast_server";
import BaseSession from "./base_session";
import http from "node:http"
import WebSocket from "ws"
import url from "node:url"

export default class FlvSession extends BaseSession {
	req: Req | http.IncomingMessage;
	res: Res | WebSocket;
	flv: Flv;
	isPublisher: boolean;
	broadcast: BroadcastServer | undefined;

	constructor(req: Req | http.IncomingMessage, res: Res | WebSocket) {
		super();
		this.req = req;
		this.res = res;
		this.ip = `${req.socket.remoteAddress}:${req.socket.remotePort}`;
		this.flv = new Flv();
		this.protocol = "flv";
		this.isPublisher = false;

		 if (this.res instanceof WebSocket) {
			let localReq: { url: string} = req as {url: string} 

      const urlInfo = url.parse(localReq.url, true);
      this.streamHost = req.headers.host?.split(":")[0] as string;
      this.streamPath = urlInfo.pathname!.split(".")[0] as string;
      this.streamApp = this.streamPath.split("/")[1] as string;
      this.streamName = this.streamPath.split("/")[2] as string;
      this.streamQuery = urlInfo.query as {sign: string};
      if (this.res.protocol.toLowerCase() === "post" || this.res.protocol.toLowerCase() === "publisher") {
        this.isPublisher = true;
      }
    } else {
			let localReq: {hostname: string, params: {app: string, name: string}, query: {sign: string}} = req as unknown as {hostname: string, params: {app: string, name: string}, query: {sign: string}}
      this.streamHost = localReq.hostname;
      this.streamApp = localReq.params.app;
      this.streamName = localReq.params.name;
			this.streamPath = `/${this.streamApp}/${this.streamName}`;
      this.streamQuery = localReq.query 
      if (this.req.method === "POST") {
        this.isPublisher = true;
      }
    }

		this.broadcast = Context.broadcasts.get(this.streamPath);

		if (!this.broadcast) {
		  if (this.res instanceof WebSocket) {
				(this.res as WebSocket).close()
				this.onClose();
				return
			} 
			(res as unknown as Res).status(404);
			(res as unknown as Res).socket?.end();
			this.onClose();
		}
	}

	run = () => {
		if (this.res instanceof WebSocket) {
      this.res.on("message", this.onData);
      this.res.on("close", this.onClose);
      this.res.on("error", this.onError);
    } else {
      this.req.on("data", this.onData);
      this.req.on("error", this.onError);
      this.req.socket.on("close", this.onClose);
    }

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

		Context.sessions.delete(this.id);
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
