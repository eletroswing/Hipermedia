import AVPacket from "@/core/avpacket";
import logger from "@/core/logger";

const FLV_MEDIA_TYPE_AUDIO = 8;
const FLV_MEDIA_TYPE_VIDEO = 9;
const FLV_MEDIA_TYPE_SCRIPT = 18;

const FLV_PARSE_INIT = 0;
const FLV_PARSE_HEAD = 1;
const FLV_PARSE_TAGS = 2;
const FLV_PARSE_PREV = 3;

const FLV_FRAME_KEY = 1;

const FLV_AVC_SEQUENCE_HEADER = 0;
const FLV_CODECID_ExHeader = 9;
const FLV_CODECID_AAC = 10;
const FLV_CODECID_H264 = 7;

const FOURCC_AV1 = Buffer.from("av01");
const FOURCC_VP9 = Buffer.from("vp09");
const FOURCC_HEVC = Buffer.from("hvc1");

const VideoPacketTypeSequenceStart = 0;
const VideoPacketTypeCodedFrames = 1;
const VideoPacketTypeCodedFramesX = 3;
const VideoPacketTypeMetadata = 4;

const AudioPacketTypeSequenceStart = 0;

export default class Flv {
	parserBuffer: Buffer<ArrayBuffer>;
	parserState: number;
	parserHeaderBytes: number;
	parserTagBytes: number;
	parserTagType: number;
	parserTagSize: number;
	parserTagTime: number;
	parserTagCapacity: number;
	parserTagData: Buffer<ArrayBuffer>;
	parserPreviousBytes: number;
	constructor() {
		this.parserBuffer = Buffer.alloc(13);
		this.parserState = FLV_PARSE_INIT;
		this.parserHeaderBytes = 0;
		this.parserTagBytes = 0;
		this.parserTagType = 0;
		this.parserTagSize = 0;
		this.parserTagTime = 0;
		this.parserTagCapacity = 1024 * 1024;
		this.parserTagData = Buffer.alloc(this.parserTagCapacity);
		this.parserPreviousBytes = 0;
	}

	onPacketCallback = (_avpacket: AVPacket) => {};

	parserData = (buffer: Buffer) => {
		let s = buffer.length;
		let n = 0;
		let p = 0;
		while (s > 0) {
			switch (this.parserState) {
				case FLV_PARSE_INIT:
					n = 13 - this.parserHeaderBytes;
					n = n <= s ? n : s;
					buffer.copy(this.parserBuffer, this.parserHeaderBytes, p, p + n);
					this.parserHeaderBytes += n;
					s -= n;
					p += n;
					if (this.parserHeaderBytes === 13) {
						this.parserState = FLV_PARSE_HEAD;
						this.parserHeaderBytes = 0;
					}
					break;
				case FLV_PARSE_HEAD:
					n = 11 - this.parserHeaderBytes;
					n = n <= s ? n : s;
					buffer.copy(this.parserBuffer, this.parserHeaderBytes, p, p + n);
					this.parserHeaderBytes += n;
					s -= n;
					p += n;
					if (this.parserHeaderBytes === 11) {
						this.parserState = FLV_PARSE_TAGS;
						this.parserHeaderBytes = 0;
						this.parserTagType = this.parserBuffer[0] as number;
						this.parserTagSize = this.parserBuffer.readUintBE(1, 3);
						this.parserTagTime =
							((this.parserBuffer[4] as number) << 16) |
							((this.parserBuffer[5] as number) << 8) |
							(this.parserBuffer[6] as number) |
							((this.parserBuffer[7] as number) << 24);
						logger.trace(
							`parser tag type=${this.parserTagType} time=${this.parserTagTime} size=${this.parserTagSize} `,
						);
					}
					break;
				case FLV_PARSE_TAGS:
					this.parserTagAlloc(this.parserTagSize);
					n = this.parserTagSize - this.parserTagBytes;
					n = n <= s ? n : s;
					buffer.copy(this.parserTagData, this.parserTagBytes, p, p + n);
					this.parserTagBytes += n;
					s -= n;
					p += n;
					if (this.parserTagBytes === this.parserTagSize) {
						this.parserState = FLV_PARSE_PREV;
						this.parserTagBytes = 0;
					}
					break;
				case FLV_PARSE_PREV:
					n = 4 - this.parserPreviousBytes;
					n = n <= s ? n : s;
					buffer.copy(this.parserBuffer, this.parserPreviousBytes, p, p + n);
					this.parserPreviousBytes += n;
					s -= n;
					p += n;
					if (this.parserPreviousBytes === 4) {
						this.parserState = FLV_PARSE_HEAD;
						this.parserPreviousBytes = 0;
						const parserPreviousNSize = this.parserBuffer.readUint32BE();
						if (parserPreviousNSize === this.parserTagSize + 11) {
							const packet = Flv.parserTag(
								this.parserTagType,
								this.parserTagTime,
								this.parserTagSize,
								this.parserTagData,
							);
							this.onPacketCallback(packet);
						} else {
							return "flv tag parser error";
						}
					}
					break;
			}
		}
		return null;
	};

	parserTagAlloc = (size: number) => {
		if (this.parserTagCapacity < size) {
			this.parserTagCapacity = size * 2;
			const newBuffer = Buffer.alloc(this.parserTagCapacity);
			this.parserTagData.copy(newBuffer);
			this.parserTagData = newBuffer;
		}
	};

	static createHeader = (hasAudio: boolean, hasVideo: boolean) => {
		const buffer = Buffer.from([
			0x46, 0x4c, 0x56, 0x01, 0x00, 0x00, 0x00, 0x00, 0x09, 0x00, 0x00, 0x00,
			0x00,
		]);
		if (hasAudio) {
			(buffer[4] as number) |= 4;
		}

		if (hasVideo) {
			(buffer[4] as number) |= 1;
		}
		return buffer;
	};

	static createMessage = (avpacket: AVPacket) => {
		const buffer = Buffer.alloc(11 + avpacket.size + 4);
		buffer[0] = avpacket.codec_type;
		buffer.writeUintBE(avpacket.size, 1, 3);
		buffer[4] = (avpacket.dts >> 16) & 0xff;
		buffer[5] = (avpacket.dts >> 8) & 0xff;
		buffer[6] = avpacket.dts & 0xff;
		buffer[7] = (avpacket.dts >> 24) & 0xff;
		avpacket.data.copy(buffer, 11, 0, avpacket.size);
		buffer.writeUint32BE(11 + avpacket.size, 11 + avpacket.size);
		return buffer;
	};

	static parserTag = (
		type: number,
		time: number,
		size: number,
		data: Buffer<ArrayBuffer>,
	) => {
		const packet = new AVPacket();
		packet.codec_type = type;
		packet.pts = time;
		packet.dts = time;
		packet.size = size;
		packet.data = data;
		if (type === FLV_MEDIA_TYPE_AUDIO) {
			const soundFormat = (data[0] as number) >> 4;
			packet.codec_id = soundFormat;
			packet.flags = 1;
			if (soundFormat !== FLV_CODECID_ExHeader) {
				if (soundFormat === FLV_CODECID_AAC) {
					if (data[1] === 0) {
						packet.flags = 0;
					}
				}
			} else {
				const audioPacketType = (data[0] as number) & 0x0f;
				if (audioPacketType === AudioPacketTypeSequenceStart) {
					packet.flags = 0;
				}
			}
		} else if (type === FLV_MEDIA_TYPE_VIDEO) {
			const frameType = ((data[0] as number) >> 4) & 0b0111;
			const codecID = (data[0] as number) & 0x0f;
			const isExHeader = (((data[0] as number) >> 4) & 0b1000) !== 0;

			if (isExHeader) {
				const VideoPacketType = (data[0] as number) & 0x0f;
				const fourCC = data.subarray(1, 5);
				if (
					fourCC.compare(FOURCC_AV1) === 0 ||
					fourCC.compare(FOURCC_VP9) === 0 ||
					fourCC.compare(FOURCC_HEVC) === 0
				) {
					packet.codec_id = fourCC.readUint32BE();
					if (VideoPacketType === VideoPacketTypeSequenceStart) {
						packet.flags = 2;
					} else if (
						VideoPacketType === VideoPacketTypeCodedFrames ||
						VideoPacketType === VideoPacketTypeCodedFramesX
					) {
						if (frameType === FLV_FRAME_KEY) {
							packet.flags = 3;
						} else {
							packet.flags = 4;
						}
					} else if (VideoPacketType === VideoPacketTypeMetadata) {
						// const hdrMetadata = AMF.parseScriptData(packet.data.buffer, 5, packet.size);
						// logger.debug(`hdrMetadata:${JSON.stringify(hdrMetadata)}`);
						packet.flags = 6;
					}

					if (fourCC.compare(FOURCC_HEVC) === 0) {
						if (VideoPacketType === VideoPacketTypeCodedFrames) {
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
				if (codecID === FLV_CODECID_H264) {
					if (VideoPacketType === FLV_AVC_SEQUENCE_HEADER) {
						packet.flags = 2;
					} else {
						if (frameType === FLV_FRAME_KEY) {
							packet.flags = 3;
						} else {
							packet.flags = 4;
						}
					}
				}
			}
		} else if (type === FLV_MEDIA_TYPE_SCRIPT) {
			packet.flags = 5;
		}
		return packet;
	};
}
