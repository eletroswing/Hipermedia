import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import EventEmitter from "node:events";
import fs from "node:fs";
import Context from "@/core/context";
import logger from "@/core/logger";

const isHlsFile = (filename: string) =>
	filename.endsWith(".ts") || filename.endsWith(".m3u8");

export default class HlsSession extends EventEmitter {
	errored: boolean;
	ffmpegExec: ChildProcessWithoutNullStreams | undefined;
	outPath: string | undefined;
	streamApp: string;
	streamName: string;

	constructor(app: string, name: string) {
		super();
		this.streamApp = app;
		this.streamName = name;
		this.errored = false;

		if (Context.config.hls?.active) {
			if (!Context.config.ffmpeg) {
				this.errored = true;
				this.onError("You need to set the ffmpeg if you want to use hls.");
			}
		}
	}

	onError = (error: string) => {
		logger.error(error);
	};

	run = () => {
		if (this.errored) return;
		const inPath = `http://${Context.config.bind ?? "0.0.0.0"}:${Context.config.http?.port ?? 8080}/${this.streamApp}/${this.streamName}.flv`;
		const ouPath = `${Context.config.static?.root ?? "./media"}/${this.streamApp}/${this.streamName}`;

		this.outPath = ouPath;

		const mapHls = `${ouPath}/index.m3u8`;
		logger.info(
			`[ HLS ] ${this.streamApp}/${this.streamName} to ${ouPath}/index.m3u8`,
		);

		if (!fs.existsSync(Context.config.static?.root ?? "./media"))
			fs.mkdirSync(Context.config.static?.root ?? "./media");
		if (
			!fs.existsSync(
				`${Context.config.static?.root ?? "./media"}/${this.streamApp}`,
			)
		)
			fs.mkdirSync(
				`${Context.config.static?.root ?? "./media"}/${this.streamApp}`,
			);
		if (!fs.existsSync(ouPath)) fs.mkdirSync(ouPath);

		const argv = [
			"-y",
			"-i",
			inPath,
			"-c:v",
			"libx264",
			"-preset",
			"veryfast",
			"-r",
			"30",
			"-g",
			"60",
			"-keyint_min",
			"60",
			"-sc_threshold",
			"0",
			"-force_key_frames",
			"expr:gte(t,n_forced*2)",
			"-c:a",
			"aac",
			"-b:a",
			"128k",
			"-map",
			"0:v",
			"-map",
			"0:a?",
			"-f",
			"hls",
			"-hls_time",
			"2",
			"-hls_list_size",
			"7",
			"-hls_flags",
			"delete_segments",
			mapHls,
		];

		this.ffmpegExec = spawn(Context.config.ffmpeg as string, argv);

		this.ffmpegExec.on("error", (e: string) => {
			this.onError(`[ FFMPEG ] ${e}`);
		});

		this.ffmpegExec.stdout.on("data", (data) => {
			logger.info(`[ FFLOG ] ${data}`);
		});

		this.ffmpegExec.on("close", (_code: number) => this.onClose());
	};

	onClose = () => {
		if (this.errored) return;
		logger.info(`[ HLS ] ${this.streamApp}/${this.streamName} was ended`);
		this.ffmpegExec?.kill();

		this.clearCache();
		this.emit("close");
	};

	clearCache = () => {
		if (this.errored || this.outPath) return;
		if (Context.config.hls?.keep) return;

		fs.readdir(this.outPath as string, (err, files) => {
			if (err) return;
			files
				.filter((filename) => isHlsFile(filename))
				.forEach((filename) => {
					fs.unlinkSync(`${this.outPath}/${filename}`);
				});
		});
	};

	close = () => {
		if (this.errored) return;
		this.onClose();
	};
}
