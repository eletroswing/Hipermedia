import fs from "node:fs";
import path from "node:path";
import type { ConfigType } from "@/core/context";
import { Hipermedia } from "@/index";

const config: ConfigType = {
	bind: "0.0.0.0",
	notify: {
		url: "",
	},
	auth: {
		play: false,
		publish: false,
		secret: "nodemedia2017privatekey",
	},
	rtmp: {
		port: 1935,
	},
	rtmps: {
		port: 1936,
		key: "./key.pem",
		cert: "./cert.pem",
	},
	http: {
		port: 8000,
	},
	ffmpeg: "/usr/bin/ffmpeg",
	hls: {
		active: true,
	},
	static: {
		root: "./media",
		router: "/",
	},
};

if (config.rtmps?.key && !fs.existsSync(config.rtmps.key)) {
	config.rtmps.key = path.join(__dirname, config.rtmps.key);
}
if (config.rtmps?.cert && !fs.existsSync(config.rtmps.cert)) {
	config.rtmps.cert = path.join(__dirname, config.rtmps.cert);
}

const hipermedia = new Hipermedia(config);
hipermedia.run();
