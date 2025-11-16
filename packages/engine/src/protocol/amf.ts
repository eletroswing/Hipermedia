// amf0.ts

import { Buffer } from "buffer";
import logger from "../core/logger";

/**
 * Tipos AMF0 — tipagem rígida
 */

export type Amf0Primitive = number | string | boolean | null | undefined;

export interface Amf0Object {
	type?: "object";
	[key: string]: Amf0Value;
}

export interface Amf0TypedObject extends Amf0Object {
	__className__: string;
}

export interface Amf0Array {
	type: "array";
	items: Amf0Value[]; // represented as object with numeric keys or array
}

export interface Amf0StrictArray {
	type: "sarray";
	items: Amf0Value[];
}

export interface Amf0Ref {
	type: "ref";
	index: number;
}

export type Amf0Value =
	| Amf0Primitive
	| Amf0Object
	| Amf0TypedObject
	| Amf0Array
	| Amf0StrictArray
	| Amf0Ref;

/**
 * Decode / Encode result types
 */
export interface DecodeResult {
	len: number;
	value: Amf0Value;
}

/**
 * Decoder / Encoder function types
 */
type Decoder = (buf: Buffer) => DecodeResult;
type Encoder = (o: Amf0Value) => Buffer | null;

/**
 * AMF0 decode rules map (number => decoder)
 */
const amf0dRules: Record<number, Decoder> = {
	0: amf0decNumber,
	1: amf0decBool,
	2: amf0decString,
	3: amf0decObject,
	5: amf0decNull,
	6: amf0decUndefined,
	7: amf0decRef,
	8: amf0decArray,
	10: amf0decSArray,
	11: amf0decDate,
	12: amf0decLongString,
	15: amf0decXmlDoc,
	16: amf0decTypedObj,
};

/**
 * AMF0 encode rules map (string => encoder)
 * keys must match the output of amfType()
 */
const amf0eRules: Record<string, Encoder> = {
	string: amf0encString,
	integer: amf0encNumber,
	double: amf0encNumber,
	xml: amf0encXmlDoc,
	object: amf0encObject,
	array: amf0encArray,
	sarray: amf0encSArray,
	binary: amf0encString,
	true: (_v) => amf0encBool(true),
	false: (_v) => amf0encBool(false),
	undefined: () => amf0encUndefined(),
	null: () => amf0encNull(),
	ref: amf0encRef, // expects Amf0Ref
	date: (v) => {
		if (typeof v === "number") return amf0encDate(v);
		return null;
	},
	longstring: amf0encLongString,
	xmldoc: amf0encXmlDoc,
	typedobject: (v) => {
		// Not implemented in original; we delegate to amf0encTypedObj (throws)
		return amf0encTypedObj(v as Amf0TypedObject);
	},
};

function amf0encRef(index: Amf0Value) {
	const buf = Buffer.alloc(3);
	buf.writeUInt8(0x07, 0);
	buf.writeUInt16BE(index as number, 1);
	return buf;
}

/**
 * Determine AMF type (string key used by encoders)
 */
function amfType(o: Amf0Value): string {
	if (o === null) return "null";
	if (typeof o === "undefined") return "undefined";
	if (typeof o === "number") {
		// integer vs double
		if (Number.isInteger(o)) return "integer";
		return "double";
	}
	if (typeof o === "boolean") return o ? "true" : "false";
	if (typeof o === "string") return "string";

	// Objects
	if (typeof o === "object") {
		if (o === null) return "null"; // redundant but safe
		// Amf0Ref
		if ("type" in o && o.type === "ref") {
			return "ref";
		}
		// Strict array
		if ("type" in o && o.type === "sarray") return "sarray";
		// Array wrapper
		if ("type" in o && o.type === "array") return "array";
		// Typed object
		if ((o as Amf0TypedObject).__className__) return "typedobject";
		// Generic object
		return "object";
	}

	throw new Error("Unsupported type!");
}

/* =========================
   Decoder implementations
   ========================= */

/**
 * AMF0 Decode Number
 */
function amf0decNumber(buf: Buffer): DecodeResult {
	return { len: 9, value: buf.readDoubleBE(1) };
}

/**
 * AMF0 Decode Boolean
 */
function amf0decBool(buf: Buffer): DecodeResult {
	return { len: 2, value: buf.readUInt8(1) !== 0 };
}

/**
 * AMF0 Decode Null
 */
function amf0decNull(): DecodeResult {
	return { len: 1, value: null };
}

/**
 * AMF0 Decode Undefined
 */
function amf0decUndefined(): DecodeResult {
	return { len: 1, value: undefined };
}

/**
 * AMF0 Decode Date
 * Note: original implementation read double at offset 3 and ignored a 16-bit field
 */
function amf0decDate(buf: Buffer): DecodeResult {
	const ts = buf.readDoubleBE(3);
	return { len: 11, value: ts };
}

/**
 * AMF0 Decode Object (untagged properties until object-end 0x09)
 */
function amf0decObject(buf: Buffer): DecodeResult {
	const obj: Amf0Object = {};
	let iBuf = buf.slice(1);
	let len = 1;

	while (iBuf.readUInt8(0) !== 0x09) {
		const prop = amf0decUString(iBuf);
		len += prop.len;

		if (iBuf.length < prop.len) break;
		// If next byte is object-end
		if (iBuf.slice(prop.len).readUInt8(0) === 0x09) {
			len++;
			break;
		}
		if (prop.value === "") break;

		const val = amf0DecodeOne(iBuf.slice(prop.len));
		obj[prop.value as string] = val.value;
		len += val.len;
		iBuf = iBuf.slice(prop.len + val.len);
	}

	return { len: len, value: obj };
}

/**
 * AMF0 Decode Reference
 */
function amf0decRef(buf: Buffer): DecodeResult {
	const index = buf.readUInt16BE(1);
	return { len: 3, value: { type: "ref", index } as Amf0Ref };
}

/**
 * AMF0 Decode String (typed)
 */
function amf0decString(buf: Buffer): DecodeResult {
	const sLen = buf.readUInt16BE(1);
	return { len: 3 + sLen, value: buf.toString("utf8", 3, 3 + sLen) };
}

/**
 * AMF0 Decode Untyped String (no leading type byte)
 */
function amf0decUString(buf: Buffer): { len: number; value: string } {
	const sLen = buf.readUInt16BE(0);
	return { len: 2 + sLen, value: buf.toString("utf8", 2, 2 + sLen) };
}

/**
 * AMF0 Decode Long String
 */
function amf0decLongString(buf: Buffer): DecodeResult {
	const sLen = buf.readUInt32BE(1);
	return { len: 5 + sLen, value: buf.toString("utf8", 5, 5 + sLen) };
}

/**
 * AMF0 Decode Array (ECMA array: 32-bit count then object fields)
 */
function amf0decArray(buf: Buffer): DecodeResult {
	// skip 4 bytes count and decode contained object
	const obj = amf0decObject(buf.slice(4));
	return { len: 5 + obj.len, value: obj.value };
}

/**
 * AMF0 Decode XMLDoc (treated similarly to string)
 */
function amf0decXmlDoc(buf: Buffer): DecodeResult {
	const sLen = buf.readUInt16BE(1);
	return { len: 3 + sLen, value: buf.toString("utf8", 3, 3 + sLen) };
}

/**
 * AMF0 Decode Strict Array
 */
function amf0decSArray(buf: Buffer): DecodeResult {
	const arr: Amf0Value[] = [];
	let len = 5;
	let ret: DecodeResult;
	const count = buf.readUInt32BE(1);
	for (let i = 0; i < count; i++) {
		ret = amf0DecodeOne(buf.slice(len));
		arr.push(ret.value);
		len += ret.len;
	}
	return {
		len,
		value: { type: "sarray", items: amf0markSArray(arr) } as Amf0StrictArray,
	};
}

/**
 * AMF0 Decode Typed Object
 */
function amf0decTypedObj(buf: Buffer): DecodeResult {
	const className = amf0decString(buf);
	const obj = amf0decObject(buf.slice(className.len - 1));
	const typed = obj.value as Amf0Object;
	(typed as Amf0TypedObject).__className__ = className.value as string;
	return { len: className.len + obj.len - 1, value: typed as Amf0TypedObject };
}

/* =========================
   Encoder implementations
   ========================= */

/**
 * AMF0 Encode Number (double or integer uses same marker 0x00)
 */
function amf0encNumber(num: Amf0Value): Buffer | null {
	if (typeof num !== "number") return null;
	const buf = Buffer.alloc(9);
	buf.writeUInt8(0x00, 0);
	buf.writeDoubleBE(num, 1);
	return buf;
}

/**
 * AMF0 Encode Boolean
 */
function amf0encBool(flag: boolean): Buffer {
	const buf = Buffer.alloc(2);
	buf.writeUInt8(0x01, 0);
	buf.writeUInt8(flag ? 1 : 0, 1);
	return buf;
}

/**
 * AMF0 Encode Null
 */
function amf0encNull(): Buffer {
	const buf = Buffer.alloc(1);
	buf.writeUInt8(0x05, 0);
	return buf;
}

/**
 * AMF0 Encode Undefined
 */
function amf0encUndefined(): Buffer {
	const buf = Buffer.alloc(1);
	buf.writeUInt8(0x06, 0);
	return buf;
}

/**
 * AMF0 Encode Date
 */
function amf0encDate(ts: number): Buffer {
	const buf = Buffer.alloc(11);
	buf.writeUInt8(0x0b, 0);
	buf.writeInt16BE(0, 1);
	buf.writeDoubleBE(ts, 3);
	return buf;
}

/**
 * AMF0 Encode Object
 */
function amf0encObject(o: Amf0Value): Buffer | null {
	if (typeof o !== "object" || o === null) return null;
	const data = Buffer.from([0x03]); // type object
	// iterate keys
	let result = data;
	for (const k of Object.keys(o as object)) {
		// skip special keys that are not actual properties (ex: sarray marker)
		if (k === "type" && (o[k] === "sarray" || o[k] === "array")) continue;
		if (k === "__className__") continue; // typed objects encoded separately
		const keyBuf = amf0encUString(k);
		const valBuf = amf0EncodeOne((o as Record<string, Amf0Value>)[k]);
		result = Buffer.concat([result, keyBuf, valBuf]);
	}
	const termCode = Buffer.from([0x00, 0x00, 0x09]);
	return Buffer.concat([result, termCode]);
}

/**
 * Encode Untyped String (no leading type)
 */
function amf0encUString(str: string): Buffer {
	const data = Buffer.from(str, "utf8");
	const sLen = Buffer.alloc(2);
	sLen.writeUInt16BE(data.length, 0);
	return Buffer.concat([sLen, data]);
}

/**
 * AMF0 Encode String (with type byte 0x02)
 */
function amf0encString(strVal: Amf0Value): Buffer | null {
	if (typeof strVal !== "string") return null;
	const buf = Buffer.alloc(3);
	buf.writeUInt8(0x02, 0);
	buf.writeUInt16BE(Buffer.byteLength(strVal, "utf8"), 1);
	return Buffer.concat([buf, Buffer.from(strVal, "utf8")]);
}

/**
 * AMF0 Encode Long String
 */
function amf0encLongString(val: Amf0Value): Buffer | null {
	if (typeof val !== "string") return null;
	const buf = Buffer.alloc(5);
	buf.writeUInt8(0x0c, 0);
	buf.writeUInt32BE(Buffer.byteLength(val, "utf8"), 1);
	return Buffer.concat([buf, Buffer.from(val, "utf8")]);
}

/**
 * AMF0 Encode Array (ECMA array)
 */
function amf0encArray(a: Amf0Value): Buffer | null {
	// Accept either a wrapped array { type: "array", items: [...] } or plain JS array inside object
	let items: Amf0Value[] = [];
	if (Array.isArray(a)) {
		items = a;
	} else if (
		typeof a === "object" &&
		a !== null &&
		a.type &&
		Array.isArray((a as Amf0Array).items)
	) {
		items = (a as Amf0Array).items;
	} else if (typeof a === "object" && a !== null) {
		items = Object.values(a as object) as Amf0Value[];
	} else {
		return null;
	}

	const l = items.length;
	logger.debug("Array encode", l, a);
	const buf = Buffer.alloc(5);
	buf.writeUInt8(0x08, 0);
	buf.writeUInt32BE(l, 1);
	const data = amf0encObject(items as unknown as Amf0Value); // convert to object representation
	// data.subarray(1) used in original (skip object type byte)
	if (!data) return null;
	return Buffer.concat([buf, data.subarray(1)]);
}

/**
 * AMF0 Encode Strict Array
 */
function amf0encSArray(a: Amf0Value): Buffer | null {
	let items: Amf0Value[] = [];
	if (Array.isArray(a)) items = a;
	else if (typeof a === "object" && a !== null && (a as Amf0Array).items)
		items = (a as Amf0Array).items;
	else return null;

	logger.debug("Do strict array!");
	let buf = Buffer.alloc(5);
	buf.writeUInt8(0x0a, 0);
	buf.writeUInt32BE(items.length, 1);
	for (let i = 0; i < items.length; i++) {
		const enc = amf0EncodeOne(items[i]);
		buf = Buffer.concat([buf, enc]);
	}
	return buf;
}

/**
 * AMF0 Encode XMLDoc (like string but marker 0x0F)
 */
function amf0encXmlDoc(strVal: Amf0Value): Buffer | null {
	if (typeof strVal !== "string") return null;
	const buf = Buffer.alloc(3);
	buf.writeUInt8(0x0f, 0);
	buf.writeUInt16BE(Buffer.byteLength(strVal, "utf8"), 1);
	return Buffer.concat([buf, Buffer.from(strVal, "utf8")]);
}

/**
 * Helper to mark a JS array as sarray (strict)
 */
function amf0markSArray(a: Amf0Value[]): Amf0Value[] {
	// We return a standard array, but consumers will check for wrapper
	// We will not attach non-enumerable property to keep typing clean; instead use wrapper object
	return a;
}

/**
 * AMF0 Encode Typed Object - original was not implemented; keep throwing for now
 */
function amf0encTypedObj(_v?: Amf0TypedObject): Buffer | null {
	throw new Error("Error: Typed object encoding is not yet implemented!");
}

/* =========================
   Generic encode/decode helpers
   ========================= */

/**
 * Decode one value according to provided rules
 */
function amfXDecodeOne(
	rules: Record<number, Decoder>,
	buffer: Buffer,
): DecodeResult {
	const marker = buffer.readUInt8(0);
	const decoder = rules[marker];
	if (!decoder) {
		logger.error(`Unknown field ${marker}`);
		throw new Error(`Unknown AMF0 type marker: ${marker}`);
	}
	return decoder(buffer);
}

/**
 * Decode one AMF0 value
 */
export function amf0DecodeOne(buffer: Buffer): DecodeResult {
	return amfXDecodeOne(amf0dRules, buffer);
}

/**
 * Decode a whole buffer of AMF values according to rules and return in array
 */
export function amfXDecode(
	rules: Record<number, Decoder>,
	buffer: Buffer,
): Amf0Value[] {
	const resp: Amf0Value[] = [];
	let i = 0;
	while (i < buffer.length) {
		const res = amfXDecodeOne(rules, buffer.slice(i));
		i += res.len;
		resp.push(res.value);
	}
	return resp;
}

/**
 * Decode a buffer of AMF0 values
 */
export function amf0Decode(buffer: Buffer): Amf0Value[] {
	return amfXDecode(amf0dRules, buffer);
}

/**
 * Encode one value according to rules
 */
function amfXEncodeOne(rules: Record<string, Encoder>, o: Amf0Value): Buffer {
	const key = amfType(o);
	const f = rules[key];
	if (f) {
		const buf = f(o);
		if (!buf) throw new Error("Encoding returned null for type: " + key);
		return buf;
	}
	throw new Error("Unsupported type for encoding: " + key);
}

/**
 * Encode one AMF0 value
 */
export function amf0EncodeOne(o: Amf0Value): Buffer {
	return amfXEncodeOne(amf0eRules, o);
}

/**
 * Encode an array of values into a buffer
 */
export function amf0Encode(a: Amf0Value[]): Buffer {
	let buf = Buffer.alloc(0);
	a.forEach((o) => {
		buf = Buffer.concat([buf, amf0EncodeOne(o)]);
	});
	return buf;
}

/* =========================
   RTMP command/data maps and helpers
   ========================= */

const rtmpCmdCode: Record<string, string[]> = {
	_result: ["transId", "cmdObj", "info"],
	_error: ["transId", "cmdObj", "info", "streamId"],
	onStatus: ["transId", "cmdObj", "info"],
	releaseStream: ["transId", "cmdObj", "streamName"],
	getStreamLength: ["transId", "cmdObj", "streamId"],
	getMovLen: ["transId", "cmdObj", "streamId"],
	FCPublish: ["transId", "cmdObj", "streamName"],
	FCUnpublish: ["transId", "cmdObj", "streamName"],
	FCSubscribe: ["transId", "cmdObj", "streamName"],
	onFCPublish: ["transId", "cmdObj", "info"],
	connect: ["transId", "cmdObj", "args"],
	call: ["transId", "cmdObj", "args"],
	createStream: ["transId", "cmdObj"],
	close: ["transId", "cmdObj"],
	play: ["transId", "cmdObj", "streamName", "start", "duration", "reset"],
	play2: ["transId", "cmdObj", "params"],
	deleteStream: ["transId", "cmdObj", "streamId"],
	closeStream: ["transId", "cmdObj"],
	receiveAudio: ["transId", "cmdObj", "bool"],
	receiveVideo: ["transId", "cmdObj", "bool"],
	publish: ["transId", "cmdObj", "streamName", "type"],
	seek: ["transId", "cmdObj", "ms"],
	pause: ["transId", "cmdObj", "pause", "ms"],
};

const rtmpDataCode: Record<string, string[]> = {
	"@setDataFrame": ["method", "dataObj"],
	onFI: ["info"],
	onMetaData: ["dataObj"],
	"|RtmpSampleAccess": ["bool1", "bool2"],
};

/* =========================
   High-level decode/encode utilities
   ========================= */

export type CmdObj = {
	tcUrl: string;
	app: number;
	objectEncoding: number;
};

export type InvokeMessage = {
	cmdObj: CmdObj;
	transId: number;
	cmd: string;
	streamName: string;
};
/**
 * Decode a data message (AMF0)
 */
export function decodeAmf0Data(dbuf: Buffer): Record<string, unknown> {
	let buffer = dbuf;
	const resp: Record<string, unknown> = {};

	const cmd = amf0DecodeOne(buffer);
	if (cmd) {
		resp.cmd = cmd.value;
		buffer = buffer.slice(cmd.len);

		const list = rtmpDataCode[String(cmd.value)];
		if (list) {
			list.forEach((n) => {
				if (buffer.length > 0) {
					const r = amf0DecodeOne(buffer);
					if (r) {
						buffer = buffer.slice(r.len);
						resp[n] = r.value;
					}
				}
			});
		} else {
			logger.error("Unknown command", resp);
		}
	}

	return resp;
}

/**
 * Decode an AMF0 command
 */
export function decodeAmf0Cmd(dbuf: Buffer): Record<string, unknown> {
	let buffer = dbuf;
	const resp: Record<string, unknown> = {};

	const cmd = amf0DecodeOne(buffer);
	if (!cmd) {
		logger.error("Failed to decode AMF0 command");
		return resp;
	}

	resp.cmd = cmd.value;
	buffer = buffer.slice(cmd.len);

	const list = rtmpCmdCode[String(cmd.value)];
	if (list) {
		list.forEach((n) => {
			if (buffer.length > 0) {
				const r = amf0DecodeOne(buffer);
				buffer = buffer.slice(r.len);
				resp[n] = r.value;
			}
		});
	} else {
		logger.error("Unknown command", resp);
	}
	return resp;
}

/**
 * Encode AMF0 command
 */
export function encodeAmf0Cmd(opt: {
	cmd: string;
	[k: string]: unknown;
}): Buffer {
	let data = amf0EncodeOne(opt.cmd as unknown as Amf0Value);

	const list = rtmpCmdCode[opt.cmd];
	if (list) {
		list.forEach((n) => {
			if (Object.hasOwn(opt, n)) {
				data = Buffer.concat([data, amf0EncodeOne(opt[n] as Amf0Value)]);
			}
		});
	} else {
		logger.error("Unknown command", opt);
	}
	return data;
}

/**
 * Encode AMF0 data
 */
export function encodeAmf0Data(opt: {
	cmd: string;
	[k: string]: unknown;
}): Buffer {
	let data = amf0EncodeOne(opt.cmd as unknown as Amf0Value);

	const list = rtmpDataCode[opt.cmd];
	if (list) {
		list.forEach((n) => {
			if (Object.hasOwn(opt, n)) {
				data = Buffer.concat([data, amf0EncodeOne(opt[n] as Amf0Value)]);
			}
		});
	} else {
		logger.error("Unknown data", opt);
	}
	return data;
}

/* =========================
   Exports
   ========================= */

export default {
	decodeAmf0Cmd,
	encodeAmf0Cmd,
	decodeAmf0Data,
	encodeAmf0Data,
	amf0Encode,
	amf0EncodeOne,
	amf0Decode,
	amf0DecodeOne,
};
