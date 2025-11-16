import os, { type CpuInfo } from "node:os";
import Context from "@/core/context";

function cpuAverage() {
	let totalIdle = 0,
		totalTick = 0;
	const cpus = os.cpus();

	for (let i = 0, len = cpus.length; i < len; i++) {
		const cpu = cpus[i];

		if (!cpu?.times) continue;

		for (const type in cpu?.times) {
			totalTick += (cpu.times as Record<string, number>)[type] as number;
		}

		totalIdle += cpu.times.idle;
	}

	return { idle: totalIdle / cpus.length, total: totalTick / cpus.length };
}

function percentageCPU() {
	return new Promise((resolve) => {
		const startMeasure = cpuAverage();
		setTimeout(() => {
			const endMeasure = cpuAverage();
			const idleDifference = endMeasure.idle - startMeasure.idle;
			const totalDifference = endMeasure.total - startMeasure.total;

			//Calculate the average percentage CPU usage
			const percentageCPU = 100 - ~~((100 * idleDifference) / totalDifference);
			resolve(percentageCPU);
		}, 100);
	});
}

export async function getServerInfo() {
	const cpuLoad = await percentageCPU();
	return {
		os: {
			arch: os.arch(),
			platform: os.platform(),
			release: os.release(),
		},
		cpu: {
			num: os.cpus().length,
			load: cpuLoad,
			model: ((os.cpus() as CpuInfo[])[0] as CpuInfo).model,
			speed: ((os.cpus() as CpuInfo[])[0] as CpuInfo).speed,
		},
		mem: {
			totle: os.totalmem(),
			free: os.freemem(),
		},
		nodejs: {
			uptime: Math.floor(process.uptime()),
			version: process.version,
			mem: process.memoryUsage(),
		},
		serverConfig: Context.config,
	};
}
