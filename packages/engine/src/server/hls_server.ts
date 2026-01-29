import fs from "node:fs";
import path from "node:path";
import Context from "@/core/context";
import logger from "@/core/logger";
import HlsSession from "@/session/hls_session";

const HLS_ROOT = path.join(process.cwd(), "hls");

export default class HlsServer {
	private cleanupInterval: ReturnType<typeof setInterval> | null = null;
	private hlsSessions: Map<string, HlsSession> = new Map();

	constructor() {
		if (!fs.existsSync(HLS_ROOT)) {
			fs.mkdirSync(HLS_ROOT, { recursive: true });
		}
	}

	run = () => {
		this.cleanupInterval = setInterval(() => {
			this.cleanupOldSegments();
		}, 10000);

		Context.eventEmitter.on("postPublish", (session) => {
			this.startHlsSession(session.streamPath);
		});

		Context.eventEmitter.on("donePublish", (session) => {
			this.stopHlsSession(session.streamPath);
		});

		logger.info(`HLS server started, output directory: ${HLS_ROOT}`);
	};

	stop = () => {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
			this.cleanupInterval = null;
		}

		for (const [streamPath, session] of this.hlsSessions) {
			session.stop();
			this.hlsSessions.delete(streamPath);
		}
	};

	startHlsSession = (streamPath: string) => {
		if (this.hlsSessions.has(streamPath)) {
			logger.warn(`HLS session for ${streamPath} already exists`);
			return;
		}

		const outputDir = this.getOutputDir(streamPath);
		if (!fs.existsSync(outputDir)) {
			fs.mkdirSync(outputDir, { recursive: true });
		}

		const hlsSession = new HlsSession(streamPath, outputDir);
		hlsSession.start();
		this.hlsSessions.set(streamPath, hlsSession);

		logger.info(`HLS session started for ${streamPath}`);
	};

	stopHlsSession = (streamPath: string) => {
		const session = this.hlsSessions.get(streamPath);
		if (session) {
			session.stop();
			this.hlsSessions.delete(streamPath);
			const dir = this.getOutputDir(streamPath)
			fs.rmSync(dir, {recursive: true})
			logger.info(`HLS session stopped for ${streamPath}`);
		}
	};

	getOutputDir = (streamPath: string): string => {
		const sanitized = streamPath.replace(/^\//, "").replace(/\//g, "_");
		return path.join(HLS_ROOT, sanitized);
	};

	getPlaylistPath = (streamPath: string): string | null => {
		const outputDir = this.getOutputDir(streamPath);
		const playlistPath = path.join(outputDir, "index.m3u8");

		if (fs.existsSync(playlistPath)) {
			return playlistPath;
		}
		return null;
	};

	getSegmentPath = (streamPath: string, segment: string): string | null => {
		const outputDir = this.getOutputDir(streamPath);
		const segmentPath = path.join(outputDir, segment);

		if (fs.existsSync(segmentPath) && segment.endsWith(".ts")) {
			return segmentPath;
		}
		return null;
	};

	isStreamActive = (streamPath: string): boolean => {
		return this.hlsSessions.has(streamPath);
	};

	private cleanupOldSegments = () => {
		const maxAge = 60000; // 60 seconds
		const now = Date.now();

		if (!fs.existsSync(HLS_ROOT)) return;

		const streamDirs = fs.readdirSync(HLS_ROOT);

		for (const dir of streamDirs) {
			const streamPath = `/${dir.replace(/_/g, "/")}`;
			const outputDir = path.join(HLS_ROOT, dir);

			if (!fs.statSync(outputDir).isDirectory()) continue;

			// If stream is not active, cleanup all files after a delay
			if (!this.isStreamActive(streamPath)) {
				const files = fs.readdirSync(outputDir);
				let allOld = true;

				for (const file of files) {
					const filePath = path.join(outputDir, file);
					const stat = fs.statSync(filePath);
					if (now - stat.mtimeMs < maxAge * 2) {
						allOld = false;
						break;
					}
				}

				if (allOld && files.length > 0) {
					for (const file of files) {
						fs.unlinkSync(path.join(outputDir, file));
					}
					fs.rmdirSync(outputDir);
					logger.debug(`Cleaned up inactive HLS directory: ${outputDir}`);
				}
				continue;
			}

			// For active streams, only cleanup old segments (keep last N)
			const files = fs.readdirSync(outputDir);
			const segments = files
				.filter((f) => f.endsWith(".ts"))
				.map((f) => ({
					name: f,
					path: path.join(outputDir, f),
					mtime: fs.statSync(path.join(outputDir, f)).mtimeMs,
				}))
				.sort((a, b) => a.mtime - b.mtime);

			// Keep at least 5 segments for active streams
			const toDelete = segments.slice(0, Math.max(0, segments.length - 10));

			for (const segment of toDelete) {
				if (now - segment.mtime > maxAge) {
					fs.unlinkSync(segment.path);
					logger.debug(`Deleted old HLS segment: ${segment.name}`);
				}
			}
		}
	};

	static getHlsRoot = (): string => HLS_ROOT;
}
