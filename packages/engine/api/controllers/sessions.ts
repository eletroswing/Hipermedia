import Context from "@/core/context";

function getFlvSessions() {
	const sessions = Context.sessions.values();
	const flvSessions = sessions.filter((session) => session.protocol === "flv");

	return Array.from(flvSessions).length;
}

function getRtmpSessions() {
	const sessions = Context.sessions.values();
	const rtpmSessions = sessions.filter(
		(session) => session.protocol === "Rtmp",
	);

	return Array.from(rtpmSessions).length;
}

function getHlsSessions() {
	const sessions = Context.hlsSessions.values();
	return Array.from(sessions).length;
}

export function getSessionInfo() {
	return {
		hls: getHlsSessions(),
		flv: getFlvSessions(),
		rtmp: getRtmpSessions(),
	};
}
