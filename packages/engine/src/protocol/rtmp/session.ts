import crypto from "node:crypto";
import type { Socket } from "@/index"
import { rtmp } from "./client"
import { broadcast } from "@/lib/broadcast"
import type { Request, Query } from "./client"
import { broadcasts } from "@/utils/config"
import { logger } from "@/utils/logger"
import type { AVPacket } from "@/utils/av_packet";
import { redis } from "@/integration/redis"
import { SERVER_ID } from "@/integration/server";

type BaseSessionConfig = {
  id: string;
  ip: string;
  streamHost: string;
  streamApp: string;
  streamName: string;
  streamPath: string;
  streamQuery?: Query | null;
  createTime: number;
  endTime: number;
  videoCodec: number;
  videoWidth: number;
  videoHeight: number;
  videoFramerate: number;
  videoDatarate: number;
  audioCodec: number;
  audioChannels: number;
  audioSamplerate: number;
  audioDatarate: number;
  inBytes: number;
  outBytes: number;
  filePath: string;
}

export type BaseSession = {
  sendBuffer: (buffer: Buffer) => void
  close: () => void
  config: () => BaseSessionConfig
}

export const session = (sock: Socket) => {
  let streamQuery: { sign?: string } | null = null;
  const id: string = crypto.randomBytes(32).toString("hex");
  const ip: string = `${sock.remoteAddress}:${sock.remotePort}`;;
  let streamHost: string = "";
  let streamApp: string = "";
  let streamName: string = "";
  let streamPath: string = "";
  const createTime: number = Date.now();
  const endTime: number = 0;
  const videoCodec: number = 0;
  const videoWidth: number = 0;
  const videoHeight: number = 0;
  const videoFramerate: number = 0;
  const videoDatarate: number = 0;
  const audioCodec: number = 0;
  const audioChannels: number = 0;
  const audioSamplerate: number = 0;
  const audioDatarate: number = 0;
  let inBytes: number = 0;
  let outBytes: number = 0;
  const filePath: string = "";
  const socket: Socket = sock;
  let broadcastClient = broadcast();
  let isPublisher = false;

  const onConnect = (request: Request) => {
    streamApp = request.app;
    streamName = request.name;
    streamHost = request.host;
    streamPath = `/${request.app}/${request.name}`;
    streamQuery = request.query;
    broadcastClient = broadcasts.get(streamPath) ?? broadcast();
    broadcasts.set(streamPath, broadcastClient);
  }

  const onClose = () => {
    logger.info(`[RTMP Session] ${ip} close`);

    if (isPublisher) {
      broadcastClient.donePublish({
        close: close,
        config: config,
        sendBuffer: sendBuffer
      });
      broadcasts.delete(streamPath);
      stopTransmuting()
      return
    }

    broadcastClient.donePlay({
      close: close,
      config: config,
      sendBuffer: sendBuffer
    });
  };

  const startTransmuting = async () => {
    logger.info(`[RTMP Session] ${ip} Start Transmuxing`);
    await redis.setex(`hipermidia:server:${SERVER_ID}:stream:${streamApp}/${streamName}`, 60, "true")
  }

  const stopTransmuting = async () => {
    logger.info(`[RTMP Session] ${ip} Stop Transmuxing`);
    await redis.del(`hipermidia:server:${SERVER_ID}:stream:${streamApp}/${streamName}`)
  }

  const onError = (error: Error) => logger.info(`[RTMP Session] ${ip} socket error, ${error.name}: ${error.message}`);
  const sendBuffer = (buffer: Buffer) => {
    outBytes += buffer.length;
    socket.write(buffer);
  };

  const close = () => {
    socket.end();
    onClose()
  };

  const onPlay = () => {
    const err = broadcastClient.postPlay({
      close: close,
      config: config,
      sendBuffer: sendBuffer
    });

    if (err != null) {
      logger.info(`[RTMP Session] ${ip} play ${streamPath} error, ${err}`);

      socket.end();
      return;
    }
    isPublisher = false;
    logger.info(`[RTMP Session] ${ip} start play ${streamPath}`);
  };

  const onPush = () => {
    const err = broadcastClient.postPublish({
      close: close,
      config: config,
      sendBuffer: sendBuffer
    });
    if (err != null) {
      logger.info(`[RTMP Session] ${ip} push ${streamPath} error, ${err}`);
      socket.end();
      return;
    }
    isPublisher = true;
    logger.info(`[RTMP Session] ${ip} start push ${streamPath}`);
    startTransmuting()
  };

  const onOutput = (buffer: Buffer) => {
    socket.write(buffer);
  };

  const onPacket = (packet: ReturnType<typeof AVPacket>) => {
    broadcastClient.broadcastMessage(packet);
  };

  const onData = (data: Buffer) => {
    inBytes += data.length;
    const err = rtmpClient.parserData(data);
    if (err != null) {
      logger.info(`[RTMP Session] ${ip} parserData error, ${err}`);
      socket.end();
    }
  };

  const rtmpClient = rtmp({
    onConnectCallback: onConnect,
    onPlayCallback: onPlay,
    onPushCallback: onPush,
    onOutputCallback: onOutput,
    onPacketCallback: onPacket
  });

  const config = () => ({
    streamQuery,
    id,
    ip,
    streamHost,
    streamApp,
    streamName,
    streamPath,
    createTime,
    endTime,
    videoCodec,
    videoWidth,
    videoHeight,
    videoFramerate,
    videoDatarate,
    audioCodec,
    audioChannels,
    audioSamplerate,
    audioDatarate,
    inBytes,
    outBytes,
    filePath,
    socket,
    broadcastClient,
    isPublisher,
  })

  return {
    onData,
    onError,
    onClose
  }
}
