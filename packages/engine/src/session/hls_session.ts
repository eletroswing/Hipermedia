import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import Context from "@/core/context";
import logger from "@/core/logger";

export default class HlsSession {
	streamPath: string;
	outputDir: string;
	ffmpegProcess: ChildProcess | null = null;
	isRunning = false;

	constructor(streamPath: string, outputDir: string) {
		this.streamPath = streamPath;
		this.outputDir = outputDir;
	}

	start = () => {
		if (this.isRunning) return;
		this.isRunning = true;

		// Small delay to ensure FLV stream is ready (reduced for faster startup)
		setTimeout(() => this.startFfmpeg(), 100);
	};

	private startFfmpeg = () => {
		if (!this.isRunning) return;

		const playlistPath = path.join(this.outputDir, "index.m3u8");
		const segmentPath = path.join(this.outputDir, "segment%03d.ts");

		// Build FLV URL from stream path
		const httpPort = Context.config.http?.port ?? 8000;
		const flvUrl = `http://127.0.0.1:${httpPort}${this.streamPath}.flv`;

		logger.info(`HLS session starting ffmpeg with input: ${flvUrl}`);

		// Start ffmpeg process using HTTP FLV input
		this.ffmpegProcess = spawn("ffmpeg", [
			"-hide_banner",
			"-loglevel",
			"warning",
			// Input options
			"-fflags",
			"+genpts+discardcorrupt",
			"-i",
			flvUrl,
			// Video: copy (no re-encode)
			"-c:v",
			"copy",
			// Audio: AAC for HLS compatibility
			"-c:a",
			"aac",
			"-b:a",
			"128k",
			"-ar",
			"44100",
			// Timestamp handling
			"-copyts",
			"-start_at_zero",
			// HLS output
			"-f",
			"hls",
			"-hls_time",
			"4",
			"-hls_list_size",
			"10",
			"-hls_flags",
			"append_list+omit_endlist+independent_segments",
			"-hls_segment_type",
			"mpegts",
			"-hls_start_number_source",
			"epoch",
			"-hls_segment_filename",
			segmentPath,
			playlistPath,
		]);

		this.ffmpegProcess.stderr?.on("data", (data) => {
			const msg = data.toString().trim();
			if (msg && !msg.includes("frame=")) {
				logger.debug(`HLS ffmpeg [${this.streamPath}]: ${msg}`);
			}
		});

		this.ffmpegProcess.on("close", (code) => {
			logger.info(`HLS ffmpeg process exited with code ${code} for ${this.streamPath}`);
			this.isRunning = false;
		});

		this.ffmpegProcess.on("error", (err) => {
			logger.error(`HLS ffmpeg process error for ${this.streamPath}: ${err.message}`);
			this.isRunning = false;
		});

		logger.info(`HLS session started for ${this.streamPath}`);
	};

	stop = () => {
		this.isRunning = false;

		if (this.ffmpegProcess) {
			this.ffmpegProcess.kill("SIGTERM");
			this.ffmpegProcess = null;
		}

		logger.info(`HLS session stopped for ${this.streamPath}`);
	};
}
