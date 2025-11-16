import crypto from "node:crypto";
import type AVPacket from "@/core/avpacket";
import Context from "@/core/context";
import Flv from "@/protocol/flv";
import Rtmp from "@/protocol/rtmp";
import type BaseSession from "@/session/base_session";

export default class BroadcastServer {
	publisher: null | BaseSession;
	subscribers: Map<string, BaseSession>;
	flvHeader: Buffer<ArrayBuffer>;
	flvMetaData: null | Buffer;
	flvAudioHeader: null | Buffer;
	flvVideoHeader: null | Buffer;
	rtmpMetaData: null | Buffer;
	rtmpAudioHeader: null | Buffer;
	rtmpVideoHeader: null | Buffer;
	flvGopCache: null | Set<unknown>;
	rtmpGopCache: null | Set<unknown>;

	constructor() {
		this.publisher = null;
		this.subscribers = new Map();
		this.flvHeader = Flv.createHeader(true, true);
		this.flvMetaData = null;
		this.flvAudioHeader = null;
		this.flvVideoHeader = null;
		this.rtmpMetaData = null;
		this.rtmpAudioHeader = null;
		this.rtmpVideoHeader = null;
		this.flvGopCache = null;
		this.rtmpGopCache = null;
	}

	verifyAuth = (authKey: string, session: BaseSession) => {
		if (authKey === "") {
			return true;
		}
		const signStr = session.streamQuery?.sign;
		if (signStr?.split("-")?.length !== 2) {
			return false;
		}
		const now = (Date.now() / 1000) | 0;
		const exp = parseInt(signStr.split("-")[0] as string);
		const shv = signStr.split("-")[1];
		const str = `${session.streamPath}-${exp}-${authKey}`;
		if (exp < now) {
			return false;
		}
		const md5 = crypto.createHash("md5");
		const ohv = md5.update(str).digest("hex");
		return shv === ohv;
	};

	postPlay = (session: BaseSession) => {
		if (session.ip !== "") {
			Context.eventEmitter.emit("prePlay", session);
		}

		if (Context.config.auth?.play && session.ip !== "") {
			if (!this.verifyAuth(Context.config.auth?.secret, session)) {
				return `play stream ${session.streamPath} authentication verification failed`;
			}
		}
		if (session.ip !== "") {
			Context.eventEmitter.emit("postPlay", session);
		}
		switch (session.protocol) {
			case "flv":
				session.sendBuffer(this.flvHeader);
				if (this.flvMetaData !== null) {
					session.sendBuffer(this.flvMetaData);
				}
				if (this.flvAudioHeader !== null) {
					session.sendBuffer(this.flvAudioHeader);
				}
				if (this.flvVideoHeader !== null) {
					session.sendBuffer(this.flvVideoHeader);
				}
				if (this.flvGopCache !== null) {
					this.flvGopCache.forEach((v) => {
						session.sendBuffer(v as Buffer<ArrayBuffer>);
					});
				}
				break;
			case "rtmp":
				if (this.rtmpMetaData != null) {
					session.sendBuffer(this.rtmpMetaData);
				}
				if (this.rtmpAudioHeader != null) {
					session.sendBuffer(this.rtmpAudioHeader);
				}
				if (this.rtmpVideoHeader != null) {
					session.sendBuffer(this.rtmpVideoHeader);
				}
				if (this.rtmpGopCache !== null) {
					this.rtmpGopCache.forEach((v) => {
						session.sendBuffer(v as Buffer<ArrayBuffer>);
					});
				}
		}

		this.subscribers.set(session.id, session);
		return null;
	};

	donePlay = (session: BaseSession) => {
		session.endTime = Date.now();
		if (session.ip !== "") {
			Context.eventEmitter.emit("donePlay", session);
		}
		this.subscribers.delete(session.id);
	};

	postPublish = (session: BaseSession) => {
		Context.eventEmitter.emit("prePublish", session);

		if (Context.config.auth?.publish) {
			if (!this.verifyAuth(Context.config.auth?.secret, session)) {
				return `publish stream ${session.streamPath} authentication verification failed`;
			}
		}

		Context.eventEmitter.emit("postPublish", session);
		if (this.publisher == null) {
			this.publisher = session;
		} else {
			return `streamPath=${session.streamPath} already has a publisher`;
		}
		return null;
	};

	donePublish = (session: BaseSession) => {
		if (session === this.publisher) {
			session.endTime = Date.now();
			Context.eventEmitter.emit("donePublish", session);
			this.publisher = null;
			this.flvMetaData = null;
			this.flvAudioHeader = null;
			this.flvVideoHeader = null;
			this.rtmpMetaData = null;
			this.rtmpAudioHeader = null;
			this.rtmpVideoHeader = null;
			this.flvGopCache?.clear();
			this.rtmpGopCache?.clear();
		}
	};

	broadcastMessage = (packet: AVPacket) => {
		const flvMessage = Flv.createMessage(packet);
		const rtmpMessage = Rtmp.createMessage(packet);
		switch (packet.flags) {
			case 0:
				this.flvAudioHeader = Buffer.from(flvMessage);
				this.rtmpAudioHeader = Buffer.from(rtmpMessage);
				break;
			case 1:
				this.flvGopCache?.add(flvMessage);
				this.rtmpGopCache?.add(rtmpMessage);
				break;
			case 2:
				this.flvVideoHeader = Buffer.from(flvMessage);
				this.rtmpVideoHeader = Buffer.from(rtmpMessage);
				break;
			case 3:
				this.flvGopCache?.clear();
				this.rtmpGopCache?.clear();
				this.flvGopCache = new Set();
				this.rtmpGopCache = new Set();
				this.flvGopCache.add(flvMessage);
				this.rtmpGopCache.add(rtmpMessage);
				break;
			case 4:
				this.flvGopCache?.add(flvMessage);
				this.rtmpGopCache?.add(rtmpMessage);
				break;
			case 5:
				this.flvMetaData = Buffer.from(flvMessage);
				this.rtmpMetaData = Buffer.from(rtmpMessage);
				break;
		}
		if (this.flvGopCache && this.flvGopCache.size > 4096) {
			this.flvGopCache.clear();
		}
		if (this.rtmpGopCache && this.rtmpGopCache.size > 4096) {
			this.rtmpGopCache.clear();
		}
		this.subscribers.forEach((v, _k) => {
			switch (v.protocol) {
				case "flv":
					v.sendBuffer(flvMessage);
					break;
				case "rtmp":
					v.sendBuffer(rtmpMessage);
			}
		});
	};
}
