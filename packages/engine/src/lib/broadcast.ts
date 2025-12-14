import crypto from "node:crypto";
import { AVPacket } from "@/utils/av_packet";
import { createMessage } from "@/protocol/rtmp/client"
import type { BaseSession } from "@/protocol/rtmp/session";
import { eventEmitter } from "@/utils/config"

export const broadcast = () => {
	let publisher: null | BaseSession = null
	const subscribers: Map<string, BaseSession> = new Map<string, BaseSession>()
	let rtmpMetaData: null | Buffer = null
	let rtmpAudioHeader: null | Buffer = null
	let rtmpVideoHeader: null | Buffer = null
	let rtmpGopCache: Set<unknown> = new Set()
	const id: string = crypto.randomUUID()

	const postPlay = (session: BaseSession) => {
		if (session.config().ip !== "") {
			eventEmitter.emit("prePlay", session);
			eventEmitter.emit("postPlay", session);
		}

		if (rtmpMetaData != null) {
			session.sendBuffer(rtmpMetaData);
		}
		if (rtmpAudioHeader != null) {
			session.sendBuffer(rtmpAudioHeader);
		}
		if (rtmpVideoHeader != null) {
			session.sendBuffer(rtmpVideoHeader);
		}
		if (rtmpGopCache !== null) {
			rtmpGopCache.forEach((v) => {
				session.sendBuffer(v as Buffer<ArrayBuffer>);
			});
		}
		subscribers.set(session.config().id, session);
		return null;
	}

	const donePlay = (session: BaseSession) => {
		session.config().endTime = Date.now();
		if (session.config().ip !== "") eventEmitter.emit("donePlay", session.config());
		subscribers.delete(session.config().id);
	};

	const postPublish = (session: BaseSession) => {
		eventEmitter.emit("prePublish", session);
		eventEmitter.emit("postPublish", session);

		if (publisher) return `streamPath=${session.config().streamPath} already has a publisher`;

		publisher = session;
		return null;
	};

	const donePublish = (session: BaseSession) => {
		if (session === publisher) {
			session.config().endTime = Date.now();
			eventEmitter.emit("donePublish", session);
			publisher = null;
			rtmpMetaData = null;
			rtmpAudioHeader = null;
			rtmpVideoHeader = null;
			rtmpGopCache.clear();
		}
	};

	const broadcastMessage = (packet: ReturnType<typeof AVPacket>) => {
		const rtmpMessage = createMessage(packet);
		switch (packet.flags) {
			case 0:
				rtmpAudioHeader = Buffer.from(rtmpMessage);
				break;
			case 1:
				rtmpGopCache?.add(rtmpMessage);
				break;
			case 2:
				rtmpVideoHeader = Buffer.from(rtmpMessage);
				break;
			case 3:
				rtmpGopCache?.clear();
				rtmpGopCache = new Set();
				rtmpGopCache.add(rtmpMessage);
				break;
			case 4:
				rtmpGopCache?.add(rtmpMessage);
				break;
			case 5:
				rtmpMetaData = Buffer.from(rtmpMessage);
				break;
		}
		if (rtmpGopCache && rtmpGopCache.size > 4096) {
			rtmpGopCache.clear();
		}
		subscribers.forEach((v, _k) => {
			v.sendBuffer(rtmpMessage);
		});
	};

	const config = () => ({
		publisher,
		subscribers,
		rtmpMetaData,
		rtmpAudioHeader,
		rtmpVideoHeader,
		rtmpGopCache,
		id
	})

	return {
		postPlay,
		donePlay,
		postPublish,
		donePublish,
		broadcastMessage,
		config
	}
}