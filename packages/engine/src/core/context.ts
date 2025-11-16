import EventEmitter from "node:events";
import type BroadcastServer from "@/server/broadcast_server";
import type BaseSession from "@/session/base_session";
import type HlsSession from "@/session/hls_session";

export type ConfigType = {
	rtmps?: {
		port: number;
		key: string;
		cert: string;
	};
	notify?: {
		url: string;
	};
	rtmp?: {
		port: number;
	};
	auth?: {
		play: boolean;
		secret: string;
		publish: boolean;
	};
	static?: {
		router: string;
		root: string;
	};
	http?: {
		port: number;
	};
	bind?: string;
	ffmpeg?: string;
	hls?: {
		active?: boolean;
		keep?: boolean;
	};
};

export const Context: {
	sessions: Map<string, BaseSession>;
	config: ConfigType;
	broadcasts: Map<string, BroadcastServer>;
	eventEmitter: EventEmitter;
	hlsSessions: Map<string, HlsSession>;
} = {
	config: {},

	sessions: new Map(),

	broadcasts: new Map(),
	hlsSessions: new Map(),

	eventEmitter: new EventEmitter(),
};

export default Context;
