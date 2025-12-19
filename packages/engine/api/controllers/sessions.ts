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

export function getSessionInfo() {
	return {
		flv: getFlvSessions(),
		rtmp: getRtmpSessions(),
	};
}
