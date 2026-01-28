import fs from "node:fs";
import path from "node:path";
import type { ConfigType } from "@/core/context";
import { Hipermedia } from "@/index";

const config: ConfigType = {
	bind: "0.0.0.0",
	rtmp: {
		port: 1935,
	},
	http: {
		port: 8000,
	}
};

const hipermedia = new Hipermedia(config);
hipermedia.run();
