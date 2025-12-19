import EventEmitter from "node:events";
import type BroadcastServer from "@/server/broadcast_server";
import type BaseSession from "@/session/base_session";

export type ConfigType = {
	rtmp?: {
		port: number;
	};
	http?: {
		port: number;
	};
	bind?: string;
};

export const Context: {
	sessions: Map<string, BaseSession>;
	config: ConfigType;
	broadcasts: Map<string, BroadcastServer>;
	eventEmitter: EventEmitter;
} = {
	config: {},

	sessions: new Map(),

	broadcasts: new Map(),

	eventEmitter: new EventEmitter(),
};

export default Context;
