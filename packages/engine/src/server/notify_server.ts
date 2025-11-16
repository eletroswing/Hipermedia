import Context from "../core/context.js";
import type BaseSession from "../session/base_session.js";

export default class NodeNotifyServer {
	run() {
		if (!Context.config.notify?.url) {
			return;
		}
		Context.eventEmitter.on("prePlay", (session) => {
			this.notify("prePlay", session);
		});

		Context.eventEmitter.on("postPlay", (session) => {
			this.notify("postPlay", session);
		});

		Context.eventEmitter.on("donePlay", (session) => {
			this.notify("donePlay", session);
		});

		Context.eventEmitter.on("prePublish", (session) => {
			this.notify("postPublish", session);
		});

		Context.eventEmitter.on("postPublish", (session) => {
			this.notify("postPublish", session);
		});

		Context.eventEmitter.on("donePublish", (session) => {
			this.notify("donePublish", session);
		});

		Context.eventEmitter.on("postRecord", (session) => {
			this.notify("postRecord", session);
		});

		Context.eventEmitter.on("doneRecord", (session) => {
			this.notify("doneRecord", session);
		});
	}

	notify(action: string, session: BaseSession) {
		if (!Context.config.notify?.url) return;
		fetch(Context.config.notify?.url, {
			method: "POST",
			body: JSON.stringify({
				id: session.id,
				ip: session.ip,
				app: session.streamApp,
				name: session.streamName,
				query: session.streamQuery,
				protocol: session.protocol,
				createtime: session.createTime,
				endtime: session.endTime,
				inbytes: session.inBytes,
				outbytes: session.outBytes,
				filePath: session.filePath,
				action: action,
			}),
		})
			.then((res) => {
				if (res.status !== 200) {
					session.close();
				}
			})
			.catch((_err) => {});
	}
}
