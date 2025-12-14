import { AVPacket } from "@/utils/av_packet";
import { constants } from "./constants"

export const parseTag = (payload: {
  type: number,
  time: number,
  size: number,
  data: Buffer<ArrayBuffer>
}) => {
  const { type, time, size, data } = payload
  const packet = AVPacket()

  packet.codec_type = type;
  packet.pts = time;
  packet.dts = time;
  packet.size = size;
  packet.data = data;
  let codecID

  if (type === constants.flv.media_type.audio) {
    const soundFormat = (data[0] as number) >> 4;
    packet.codec_id = soundFormat;
    packet.flags = 1;
    if (soundFormat !== constants.flv.codec_id.ex) {
      if (soundFormat === constants.flv.codec_id.aac) {
        if (data[1] === 0) {
          packet.flags = 0;
        }
      }
    } else {
      const audioPacketType = (data[0] as number) & 0x0f;
      if (audioPacketType === constants.packet_type.audio.sequence_start) {
        packet.flags = 0;
      }
    }
  } else if (type === constants.flv.media_type.video) {
    const frameType = ((data[0] as number) >> 4) & 0b0111;
    codecID = (data[0] as number) & 0x0f;
    const isExHeader = (((data[0] as number) >> 4) & 0b1000) !== 0;

    if (isExHeader) {
      const VideoPacketType = (data[0] as number) & 0x0f;
      const fourCC = data.subarray(1, 5);
      if (
        fourCC.compare(constants.four_cc.av1) === 0 ||
        fourCC.compare(constants.four_cc.vp9) === 0 ||
        fourCC.compare(constants.four_cc.hevc) === 0
      ) {
        packet.codec_id = fourCC.readUint32BE();
        if (VideoPacketType === constants.packet_type.video.sequence_start) {
          packet.flags = 2;
        } else if (
          VideoPacketType === constants.packet_type.video.coded_frames ||
          VideoPacketType === constants.packet_type.video.coded_frames_x
        ) {
          if (frameType === constants.flv.frame.key) {
            packet.flags = 3;
          } else {
            packet.flags = 4;
          }
        } else if (VideoPacketType === constants.packet_type.video.metadata) {
          packet.flags = 6;
        }

        if (fourCC.compare(constants.four_cc.hevc) === 0) {
          if (VideoPacketType === constants.packet_type.video.coded_frames) {
            const cts = data.readUintBE(5, 3);
            packet.pts = packet.dts + cts;
          }
        }
      }
    } else {
      const cts = data.readUintBE(2, 3);
      const VideoPacketType = data[1];
      packet.codec_id = codecID;
      packet.pts = packet.dts + cts;
      packet.flags = 4;
      if (codecID === constants.flv.codec_id.h264) {
        if (VideoPacketType === constants.flv.avc.sequence.header) {
          packet.flags = 2;
        } else {
          if (frameType === constants.flv.frame.key) {
            packet.flags = 3;
          } else {
            packet.flags = 4;
          }
        }
      }
    }
  } else if (type === constants.flv.media_type.script) {
    packet.flags = 5;
  }

  return packet
};