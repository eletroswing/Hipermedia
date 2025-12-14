import crypto from "node:crypto";
import { constants } from "./constants";

const calcHmac = (payload: { data: crypto.BinaryLike, key: crypto.BinaryLike }) => {
  const hmac = crypto.createHmac("sha256", payload.key);
  hmac.update(payload.data);
  return hmac.digest();
}

const GetClientGenuineConstDigestOffset = (buf: Buffer) => {
  let offset =
    (buf[0] as number) +
    (buf[1] as number) +
    (buf[2] as number) +
    (buf[3] as number);
  offset = (offset % 728) + 12;
  return offset;
}

const GetServerGenuineConstDigestOffset = (buf: Buffer) => {
  let offset =
    (buf[0] as number) +
    (buf[1] as number) +
    (buf[2] as number) +
    (buf[3] as number);
  offset = (offset % 728) + 776;
  return offset;
}

const detectClientMessageFormat = (clientsig: Buffer) => {
  let sdl: number = GetServerGenuineConstDigestOffset(clientsig.subarray(772, 776));
  let msg: Buffer = Buffer.concat(
    [clientsig.subarray(0, sdl), clientsig.subarray(sdl + constants.crypto.sha256dl)],
    1504,
  );
  let computedSignature: Buffer<ArrayBuffer> = calcHmac({
    data: msg,
    key: constants.handshake.genuineFPConst
  });
  let providedSignature: Buffer = clientsig.subarray(sdl, sdl + constants.crypto.sha256dl);

  if (computedSignature.equals(providedSignature)) return constants.message.format.f2;

  sdl = GetClientGenuineConstDigestOffset(clientsig.subarray(8, 12));
  msg = Buffer.concat(
    [clientsig.subarray(0, sdl), clientsig.subarray(sdl + constants.crypto.sha256dl)],
    1504,
  );
  computedSignature = calcHmac({
    data: msg,
    key: constants.handshake.genuineFPConst
  });

  providedSignature = clientsig.slice(sdl, sdl + constants.crypto.sha256dl);

  if (computedSignature.equals(providedSignature)) return constants.message.format.f1
  return constants.message.format.f0
}

const generateS1 = (messageFormat: number) => {
  const randomBytes = crypto.randomBytes(constants.handshake.sigSize - 8);
  const handshakeBytes = Buffer.concat(
    [Buffer.from([0, 0, 0, 0, 1, 2, 3, 4]), randomBytes],
    constants.handshake.sigSize,
  );

  let serverDigestOffset: number = GetServerGenuineConstDigestOffset(
    handshakeBytes.subarray(772, 776),
  );

  if (messageFormat === 1) {
    serverDigestOffset = GetClientGenuineConstDigestOffset(
      handshakeBytes.subarray(8, 12),
    );
  }

  const msg = Buffer.concat(
    [
      handshakeBytes.subarray(0, serverDigestOffset),
      handshakeBytes.subarray(serverDigestOffset + constants.crypto.sha256dl),
    ],
    constants.handshake.sigSize - constants.crypto.sha256dl,
  );
  const hash = calcHmac({
    data: msg,
    key: constants.handshake.genuineFMSConst
  });
  hash.copy(handshakeBytes, serverDigestOffset, 0, 32);
  return handshakeBytes;
}

const generateS2 = (messageFormat: number, clientsig: Buffer) => {
  const randomBytes = crypto.randomBytes(constants.handshake.sigSize - 32);
  let challengeKeyOffset: number = GetServerGenuineConstDigestOffset(
    clientsig.subarray(772, 776),
  );
  if (messageFormat === 1) {
    challengeKeyOffset = GetClientGenuineConstDigestOffset(
      clientsig.subarray(8, 12),
    );
  }

  const challengeKey = clientsig.subarray(
    challengeKeyOffset,
    challengeKeyOffset + 32,
  );
  const hash = calcHmac({
    data: challengeKey,
    key: constants.handshake.genuineFMSConstCrud
  });
  const signature = calcHmac({
    data: randomBytes,
    key: hash
  });
  const s2Bytes = Buffer.concat([randomBytes, signature], constants.handshake.sigSize);
  return s2Bytes;
}

export const generateS0S1S2 = (clientsig: Buffer) => {
  const clientType = Buffer.alloc(1, 3);
  const messageFormat = detectClientMessageFormat(clientsig);
  let allBytes: Buffer = Buffer.concat([
    clientType,
    generateS1(messageFormat),
    generateS2(messageFormat, clientsig),
  ]);

  if (messageFormat === constants.message.format.f0) allBytes = Buffer.concat([clientType, clientsig, clientsig]);
  return allBytes;
}
