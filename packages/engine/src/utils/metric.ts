import { broadcasts } from "@/utils/config";
import os, { type CpuInfo } from "node:os";

const getNumberOfStreams = () => {
  return Object.keys(Object.fromEntries(broadcasts)).length
}

const getCpuAverage = () => {
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

const getCpuPercentage = () => {
  return new Promise((resolve) => {
    const startMeasure = getCpuAverage();
    setTimeout(() => {
      const endMeasure = getCpuAverage();
      const idleDifference = endMeasure.idle - startMeasure.idle;
      const totalDifference = endMeasure.total - startMeasure.total;

      const percentageCPU = 100 - ~~((100 * idleDifference) / totalDifference);
      resolve(percentageCPU);
    }, 100);
  });
}

export const getServerMetrics = async () => {
  const cpuLoad = await getCpuPercentage();
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
    streams: getNumberOfStreams()
  };
}

