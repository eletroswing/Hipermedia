import querystring from "node:querystring";
import { AVPacket } from "@/utils/av_packet";
import { logger } from "@/utils/logger"
import AMF, { type CmdObj, type InvokeMessage } from "@/lib/amf";
import { constants } from "./constants"
import { Packet } from "./packet"
import { generateS0S1S2 } from "./handshake"
import { parseTag } from "@/protocol/flv";

export type Query = {
  sign?: string
}

export type Request = {
  app: string;
  name: string;
  host: string;
  query: Query
}

export type RtmpPayload = {
  onConnectCallback?: (request: Request) => void
  onPlayCallback?: () => void
  onPushCallback?: () => void
  eventHandler?: () => void
  onDeleteStream?: (invokeMessage: InvokeMessage) => void
  onPacketCallback?: (avpacket: ReturnType<typeof AVPacket>) => void
  onOutputCallback?: (buffer: Buffer) => void
}

export const rtmp = (payload?: RtmpPayload) => {
  const handshakePayload = Buffer.alloc(constants.handshake.size);
  let handshakeState = constants.handshake.uninit;
  let handshakeBytes = 0;
  const parserBuffer = Buffer.alloc(constants.chunk.maxHeader);
  let parserState = constants.parse.init;
  let parserBytes = 0;
  let parserBasicBytes = 0;
  let parserPacket = Packet();
  const inPackets = new Map();
  let inChunkSize = constants.chunk.defaultSize;
  const outChunkSize = constants.chunk.maxSize;
  var streams = 0;
  var ackSize = 0
  var connectCmdObj = {};
  var streamApp = "";
  var streamHost = "";
  var objectEncoding = 0;
  var connectTime = new Date();
  var startTimestamp = Date.now();
  var streamName: string | undefined = ""
  var streamId = 0
  var streamQuery: Query | undefined = undefined

  const parserData = (buffer: Buffer) => {
    let bytes = buffer.length;
    let p = 0;
    let n = 0;
    while (bytes > 0) {
      switch (handshakeState) {
        case constants.handshake.uninit:
          handshakeState = constants.handshake.c0;
          handshakeBytes = 0;
          bytes -= 1;
          p += 1;
          break;
        case constants.handshake.c0:
          n = constants.handshake.size - handshakeBytes;
          n = n <= bytes ? n : bytes;
          buffer.copy(handshakePayload, handshakeBytes, p, p + n);
          handshakeBytes += n;
          bytes -= n;
          p += n;
          if (handshakeBytes === constants.handshake.size) {
            handshakeState = constants.handshake.c1;
            handshakeBytes = 0;
            const s0s1s2 = generateS0S1S2(handshakePayload);
            if (payload && payload.onOutputCallback) payload.onOutputCallback(s0s1s2)
          }
          break;
        case constants.handshake.c1:
          n = constants.handshake.size - handshakeBytes;
          n = n <= bytes ? n : bytes;
          buffer.copy(handshakePayload, handshakeBytes, p, n);
          handshakeBytes += n;
          bytes -= n;
          p += n;
          if (handshakeBytes === constants.handshake.size) {
            handshakeState = constants.handshake.c2;
            handshakeBytes = 0;
          }
          break;
        default:
          return chunkRead(buffer, p, bytes);
      }
    }
    return null;
  };

  const chunkRead = (data: Buffer, p: number, bytes: number) => {
    let size = 0;
    let offset = 0;
    let extended_timestamp = 0;

    while (offset < bytes) {
      switch (parserState) {
        case constants.parse.init:
          parserBytes = 1;
          parserBuffer[0] = data[p + offset++] as number;

          parserBasicBytes = 1;

          if (1 === ((parserBuffer[0] as number) & 0x3f)) parserBasicBytes = 3;
          if (0 === ((parserBuffer[0] as number) & 0x3f)) parserBasicBytes = 2;

          parserState = constants.parse.basicHeader;
          break;
        case constants.parse.basicHeader:
          while (parserBytes < parserBasicBytes && offset < bytes) {
            parserBuffer[parserBytes++] = data[
              p + offset++
            ] as number;
          }
          if (parserBytes >= parserBasicBytes) {
            parserState = constants.parse.messageHeader;
          }
          break;
        case constants.parse.messageHeader:
          size =
            (constants.message.headerSize[(parserBuffer[0] as number) >> 6] as number) +
            parserBasicBytes;
          while (parserBytes < size && offset < bytes) {
            parserBuffer[parserBytes++] = data[
              p + offset++
            ] as number;
          }
          if (parserBytes >= size) {
            packetParse();
            parserState = constants.parse.extendedTimestamp;
          }
          break;
        case constants.parse.extendedTimestamp:
          size =
            (constants.message.headerSize[parserPacket.header.fmt] as number) +
            parserBasicBytes;
          if (parserPacket.header.timestamp === 0xffffff) {
            size += 4;
          }
          while (parserBytes < size && offset < bytes) {
            parserBuffer[parserBytes++] = data[
              p + offset++
            ] as number;
          }
          if (parserBytes >= size) {
            extended_timestamp = parserPacket.header.timestamp;

            if (parserPacket.header.timestamp === 0xffffff) {
              extended_timestamp = parserBuffer.readUInt32BE(
                (constants.message.headerSize[parserPacket.header.fmt] as number) +
                parserBasicBytes,
              );
            }

            if (parserPacket.bytes === 0) {
              parserPacket.clock += extended_timestamp;

              if (constants.chunk.type.type0 === parserPacket.header.fmt) {
                parserPacket.clock = extended_timestamp;
              }
              packetAlloc();
            }
            parserState = constants.parse.payload;
          }
          break;
        case constants.parse.payload:
          size = Math.min(
            inChunkSize - (parserPacket.bytes % inChunkSize),
            parserPacket.header.length - parserPacket.bytes,
          );
          size = Math.min(size, bytes - offset);
          if (size > 0) {
            data.copy(
              parserPacket.payload,
              parserPacket.bytes,
              p + offset,
              p + offset + size,
            );
          }
          parserPacket.bytes += size;
          offset += size;

          if (parserPacket.bytes >= parserPacket.header.length) {
            parserState = constants.parse.init;
            parserPacket.bytes = 0;
            if (parserPacket.clock > 0xffffffff) break;
            packetHandler();
            break
          }

          if (0 === parserPacket.bytes % inChunkSize) parserState = constants.parse.init;
          break;
      }
    }
    return null;
  };

  const packetAlloc = () => {
    if (parserPacket.capacity < parserPacket.header.length) {
      parserPacket.payload = Buffer.alloc(
        parserPacket.header.length + 1024,
      );
      parserPacket.capacity = parserPacket.header.length + 1024;
    }
  };

  const packetParse = () => {
    const fmt = (parserBuffer[0] as number) >> 6;
    let cid = (parserBuffer[0] as number) & 0x3f;

    if (parserBasicBytes === 2) cid = 64 + (parserBuffer[1] as number);

    if (parserBasicBytes === 3) cid =
      (64 +
        (parserBuffer[1] as number) +
        (parserBuffer[2] as number)) <<
      8;

    parserPacket = inPackets.get(cid) ?? Packet({
      fmt,
      cid
    });
    inPackets.set(cid, parserPacket);
    parserPacket.header.fmt = fmt;
    parserPacket.header.cid = cid;
    chunkMessageHeaderRead();
  };

  const chunkMessageHeaderRead = () => {
    let offset = parserBasicBytes;

    // timestamp / delta
    if (parserPacket.header.fmt <= constants.chunk.type.type2) {
      parserPacket.header.timestamp = parserBuffer.readUIntBE(
        offset,
        3,
      );
      offset += 3;
    }

    // message length + type
    if (parserPacket.header.fmt <= constants.chunk.type.type1) {
      parserPacket.header.length = parserBuffer.readUIntBE(offset, 3);
      parserPacket.header.type = parserBuffer[offset + 3] as number;
      offset += 4;
    }

    if (parserPacket.header.fmt === constants.chunk.type.type0) {
      parserPacket.header.stream_id =
        parserBuffer.readUInt32LE(offset);
      offset += 4;
    }
    return offset;
  };

  const packetHandler = () => {
    switch (parserPacket.header.type) {
      case constants.message.type.setChunkSize:
      case constants.message.type.abort:
      case constants.message.type.acknowledgement:
      case constants.message.type.windowAckSize:
      case constants.message.type.setPeerBandwidth:
        return controlHandler();
      case constants.message.type.event:
        if (payload && payload.eventHandler) payload.eventHandler()
        return
      case constants.message.type.flexMessage:
      case constants.message.type.invoke:
        return invokeHandler();
      case constants.message.type.audio:
      case constants.message.type.video:
      case constants.message.type.flexStream: // AMF3
      case constants.message.type.data: // AMF0
        return dataHandler();
    }
  };

  const controlHandler = () => {
    const payload = parserPacket.payload;
    switch (parserPacket.header.type) {
      case constants.message.type.setChunkSize:
        inChunkSize = payload.readUInt32BE();
        break;
      case constants.message.type.abort:
        break;
      case constants.message.type.acknowledgement:
        break;
      case constants.message.type.windowAckSize:
        ackSize = payload.readUInt32BE();
        break;
      case constants.message.type.setPeerBandwidth:
        break;
    }
  };

  const dataHandler = () => {
    const packet = parseTag(
      {
        type: parserPacket.header.type,
        time: parserPacket.clock,
        size: parserPacket.header.length,
        data: parserPacket.payload
      }
    );

    if (payload && payload.onPacketCallback) payload.onPacketCallback(packet)
  };

  const onConnect = (invokeMessage: InvokeMessage) => {
    const url = new URL(invokeMessage.cmdObj.tcUrl);
    connectCmdObj = invokeMessage.cmdObj;
    streamApp = invokeMessage.cmdObj.app;
    streamHost = url.hostname;
    objectEncoding =
      invokeMessage.cmdObj.objectEncoding != null
        ? invokeMessage.cmdObj.objectEncoding
        : 0;
    connectTime = new Date();
    startTimestamp = Date.now();
    sendWindowACK(5000000);
    setPeerBandwidth(5000000, 2);
    setChunkSize(outChunkSize);
    respondConnect(invokeMessage.transId);
  };

  const respondConnect = (tid: number) => {
    const opt = {
      cmd: "_result",
      transId: tid,
      cmdObj: {
        fmsVer: "FMS/3,0,1,123",
        capabilities: 31,
      },
      info: {
        level: "status",
        code: "NetConnection.Connect.Success",
        description: "Connection succeeded.",
        objectEncoding: objectEncoding,
      },
    };
    sendInvokeMessage(0, opt);
  }

  const sendACK = (size: number) => {
    const rtmpBuffer = Buffer.from("02000000000004030000000000000000", "hex");
    rtmpBuffer.writeUInt32BE(size, 12);
    if (payload && payload.onOutputCallback) payload.onOutputCallback(rtmpBuffer);
  };

  const sendWindowACK = (size: number) => {
    const rtmpBuffer = Buffer.from("02000000000004050000000000000000", "hex");
    rtmpBuffer.writeUInt32BE(size, 12);
    if (payload && payload.onOutputCallback) payload.onOutputCallback(rtmpBuffer);
  };

  const setPeerBandwidth = (size: number, type: number) => {
    const rtmpBuffer = Buffer.from("0200000000000506000000000000000000", "hex");
    rtmpBuffer.writeUInt32BE(size, 12);
    rtmpBuffer[16] = type;
    if (payload && payload.onOutputCallback) payload.onOutputCallback(rtmpBuffer);
  };

  const setChunkSize = (size: number) => {
    const rtmpBuffer = Buffer.from("02000000000004010000000000000000", "hex");
    rtmpBuffer.writeUInt32BE(size, 12);
    if (payload && payload.onOutputCallback) payload.onOutputCallback(rtmpBuffer);
  };

  const sendStreamStatus = (st: number, id: number) => {
    const rtmpBuffer = Buffer.from(
      "020000000000060400000000000000000000",
      "hex",
    );
    rtmpBuffer.writeUInt16BE(st, 12);
    rtmpBuffer.writeUInt32BE(id, 14);
    if (payload && payload.onOutputCallback) payload.onOutputCallback(rtmpBuffer);
  };

  const onCreateStream = (invokeMessage: InvokeMessage) => respondCreateStream(invokeMessage.transId);
  const respondCreateStream = (tid: number) => {
    streams++;
    const opt = {
      cmd: "_result",
      transId: tid,
      cmdObj: null,
      info: streams,
    };
    sendInvokeMessage(0, opt);
  }

  const sendInvokeMessage = (
    sid: number,
    opt: {
      [k: string]: unknown;
      cmd: string;
    },
  ) => {
    const packet = Packet();
    packet.header.fmt = constants.chunk.type.type0;
    packet.header.cid = constants.chunk.channel.invoke;
    packet.header.type = constants.message.type.invoke;
    packet.header.stream_id = sid;
    packet.payload = AMF.encodeAmf0Cmd(opt) as Buffer<ArrayBuffer>;
    packet.header.length = packet.payload.length;
    const chunks = chunksCreate(packet);
    if (payload && payload.onOutputCallback) payload.onOutputCallback(chunks)
  };

  const invokeHandler = () => {
    const offset =
      parserPacket.header.type === constants.message.type.flexMessage ? 1 : 0;
    const content = parserPacket.payload.subarray(
      offset,
      parserPacket.header.length,
    );

    const invokeMessage = AMF.decodeAmf0Cmd(content);
    switch (invokeMessage.cmd) {
      case "connect":
        onConnect(invokeMessage as InvokeMessage);
        break;
      case "createStream":
        onCreateStream(invokeMessage as InvokeMessage);
        break;
      case "publish":
        onPublish(invokeMessage as InvokeMessage);
        break;
      case "play":
        onPlay(invokeMessage as InvokeMessage);
        break;
      case "deleteStream":
        if (payload && payload.onDeleteStream) payload.onDeleteStream(invokeMessage as InvokeMessage);
        break;
      default:
        logger.trace(`unhandle invoke message ${invokeMessage.cmd}`);
        break;
    }
  }

  const sendStatusMessage = (
    sid: number,
    level: string,
    code: string,
    description: string,
  ) => {
    const opt = {
      cmd: "onStatus",
      transId: 0,
      cmdObj: null,
      info: {
        level: level,
        code: code,
        description: description,
      },
    };
    sendInvokeMessage(sid, opt);
  }

  const respondPublish = () => {
    sendStatusMessage(
      streamId as number,
      "status",
      "NetStream.Publish.Start",
      `/${streamApp}/${streamName} is now published.`,
    );
  }

  const onPublish = (invokeMessage: InvokeMessage) => {
    streamName = invokeMessage.streamName.split("?")[0];
    streamQuery = querystring.parse(
      invokeMessage.streamName.split("?")[1] as string,
    ) as Query;
    streamId = parserPacket.header.stream_id;
    respondPublish();
    if (payload && payload.onConnectCallback) payload.onConnectCallback({
      app: streamApp,
      name: streamName as string,
      host: streamHost,
      query: streamQuery,
    });
    if (payload && payload.onPushCallback) payload.onPushCallback();
  };

  const onPlay = (invokeMessage: InvokeMessage) => {
    streamName = invokeMessage.streamName.split("?")[0];
    streamQuery = querystring.parse(
      invokeMessage.streamName.split("?")[1] as string,
    ) as Query;
    streamId = parserPacket.header.stream_id;
    respondPlay();
    if (payload && payload.onConnectCallback) payload.onConnectCallback({
      app: streamApp,
      name: streamName as string,
      host: streamHost,
      query: streamQuery,
    });
    if (payload && payload.onPlayCallback) payload.onPlayCallback();
  };

  const respondPlay = () => {
    sendStreamStatus(constants.stream.begin, streamId as number);
    sendStatusMessage(
      streamId as number,
      "status",
      "NetStream.Play.Reset",
      "Playing and resetting stream.",
    );
    sendStatusMessage(
      streamId as number,
      "status",
      "NetStream.Play.Start",
      "Started playing stream.",
    );
    sendRtmpSampleAccess(streamId as number);
  }

  const sendDataMessage = (
    opt: {
      [k: string]: unknown;
      cmd: string;
    },
    sid: number,
  ) => {
    const packet = Packet();
    packet.header.fmt = constants.chunk.type.type0;
    packet.header.cid = constants.chunk.channel.data;
    packet.header.type = constants.message.type.data;
    packet.payload = AMF.encodeAmf0Data(opt) as Buffer<ArrayBuffer>;
    packet.header.length = packet.payload.length;
    packet.header.stream_id = sid;
    const chunks = chunksCreate(packet);
    if (payload && payload.onOutputCallback) payload.onOutputCallback(chunks);
  }

  const sendRtmpSampleAccess = (sid: number) => {
    const opt = {
      cmd: "|RtmpSampleAccess",
      bool1: false,
      bool2: false,
    };
    sendDataMessage(opt, sid);
  }

  return {
    parserData,
    chunkRead,
    packetAlloc,
    packetParse,
    chunkMessageHeaderRead,
    packetHandler,
    controlHandler,
    dataHandler,
    onConnect,
    respondConnect,
    sendACK,
    sendWindowACK,
    setPeerBandwidth,
    setChunkSize,
    sendStreamStatus,
    onCreateStream,
    respondCreateStream,
    sendInvokeMessage,
    sendStatusMessage,
    invokeHandler,
    respondPublish,
    onPublish,
    onPlay,
    respondPlay,
    sendDataMessage,
    sendRtmpSampleAccess,
  }
}

export const createMessage = (avpacket: ReturnType<typeof AVPacket>) => {
  const rtmpPacket = Packet();
  rtmpPacket.header.fmt = constants.message.format.f0;
  switch (avpacket.codec_type) {
    case 8:
      rtmpPacket.header.cid = constants.chunk.channel.audio;
      break;
    case 9:
      rtmpPacket.header.cid = constants.chunk.channel.video;
      break;
    case 18:
      rtmpPacket.header.cid = constants.chunk.channel.data;
      break;
  }
  rtmpPacket.header.length = avpacket.size;
  rtmpPacket.header.type = avpacket.codec_type;
  rtmpPacket.header.timestamp = avpacket.dts;
  rtmpPacket.clock = avpacket.dts;
  rtmpPacket.payload = avpacket.data;
  return chunksCreate(rtmpPacket);
};

export const chunkBasicHeaderCreate = (fmt: number, cid: number) => {
  let out: Buffer;
  if (cid >= 64 + 255) {
    out = Buffer.alloc(3);
    out[0] = (fmt << 6) | 1;
    out[1] = (cid - 64) & 0xff;
    out[2] = ((cid - 64) >> 8) & 0xff;
  } else if (cid >= 64) {
    out = Buffer.alloc(2);
    out[0] = (fmt << 6) | 0;
    out[1] = (cid - 64) & 0xff;
  } else {
    out = Buffer.alloc(1);
    out[0] = (fmt << 6) | cid;
  }
  return out;
};

export const chunksCreate = (packet: ReturnType<typeof Packet>) => {
  const header = packet.header;
  const payload = packet.payload;
  let payloadSize = header.length;
  const chunkSize = constants.chunk.maxSize;
  let chunksOffset = 0;
  let payloadOffset = 0;
  const chunkBasicHeader = chunkBasicHeaderCreate(
    header.fmt,
    header.cid,
  );
  const chunkBasicHeader3 = chunkBasicHeaderCreate(
    constants.chunk.type.type3,
    header.cid,
  );
  const chunkMessageHeader = chunkMessageHeaderCreate(header);
  const useExtendedTimestamp = header.timestamp >= 0xffffff;
  const headerSize =
    chunkBasicHeader.length +
    chunkMessageHeader.length +
    (useExtendedTimestamp ? 4 : 0);
  let n = headerSize + payloadSize + Math.floor(payloadSize / chunkSize);

  if (useExtendedTimestamp) {
    n += Math.floor(payloadSize / chunkSize) * 4;
  }
  if (!(payloadSize % chunkSize)) {
    n -= 1;
    if (useExtendedTimestamp) {
      //TODO CHECK
      n -= 4;
    }
  }

  const chunks = Buffer.alloc(n);
  chunkBasicHeader.copy(chunks, chunksOffset);
  chunksOffset += chunkBasicHeader.length;
  chunkMessageHeader.copy(chunks, chunksOffset);
  chunksOffset += chunkMessageHeader.length;
  if (useExtendedTimestamp) {
    chunks.writeUInt32BE(header.timestamp, chunksOffset);
    chunksOffset += 4;
  }
  while (payloadSize > 0) {
    if (payloadSize > chunkSize) {
      payload.copy(
        chunks,
        chunksOffset,
        payloadOffset,
        payloadOffset + chunkSize,
      );
      payloadSize -= chunkSize;
      chunksOffset += chunkSize;
      payloadOffset += chunkSize;
      chunkBasicHeader3.copy(chunks, chunksOffset);
      chunksOffset += chunkBasicHeader3.length;
      if (useExtendedTimestamp) {
        chunks.writeUInt32BE(header.timestamp, chunksOffset);
        chunksOffset += 4;
      }
    } else {
      payload.copy(
        chunks,
        chunksOffset,
        payloadOffset,
        payloadOffset + payloadSize,
      );
      payloadSize -= payloadSize;
      chunksOffset += payloadSize;
      payloadOffset += payloadSize;
    }
  }
  return chunks;
};

const chunkMessageHeaderCreate = (header: {
  fmt: number;
  timestamp: number;
  length: number;
  type: number;
  stream_id: number;
}) => {
  const out = Buffer.alloc(constants.message.headerSize[header.fmt % 4] as number);
  if (header.fmt <= constants.chunk.type.type2) {
    out.writeUIntBE(
      header.timestamp >= 0xffffff ? 0xffffff : header.timestamp,
      0,
      3,
    );
  }

  if (header.fmt <= constants.chunk.type.type1) {
    out.writeUIntBE(header.length, 3, 3);
    out.writeUInt8(header.type, 6);
  }

  if (header.fmt === constants.chunk.type.type0) {
    out.writeUInt32LE(header.stream_id, 7);
  }
  return out;
};

