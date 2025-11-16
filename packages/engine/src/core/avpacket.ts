export default class AVPacket {
	codec_id: number;
	duration: number;
	codec_type: number;
	flags: number;
	dts: number;
	offset: number;
	pts: number;
	size: number;
	data: Buffer<ArrayBuffer>;

	constructor() {
		this.codec_id = 0;
		this.codec_type = 0;
		this.duration = 0;
		this.flags = 0;
		this.pts = 0;
		this.dts = 0;
		this.size = 0;
		this.offset = 0;
		this.data = Buffer.alloc(0);
	}
}
