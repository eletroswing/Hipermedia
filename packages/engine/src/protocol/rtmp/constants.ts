export const constants = {
  handshake: {
    size: 1536,
    uninit: 0,
    c0: 1,
    c1: 2,
    c2: 3,
    sigSize: 1536,
    genuineFMSConst: "Genuine Adobe Flash Media Server 001",
    genuineFMSConstCrud: Buffer.concat([
      Buffer.from("Genuine Adobe Flash Media Server 001", "utf8"),
      Buffer.from([
        0xf0, 0xee, 0xc2, 0x4a, 0x80, 0x68, 0xbe, 0xe8, 0x2e, 0x00, 0xd0, 0xd1, 0x02,
        0x9e, 0x7e, 0x57, 0x6e, 0xec, 0x5d, 0x2d, 0x29, 0x80, 0x6f, 0xab, 0x93, 0xb8,
        0xe6, 0x36, 0xcf, 0xeb, 0x31, 0xae,
      ]),
    ]),
    genuineFPConst: "Genuine Adobe Flash Player 001",
  },

  parse: {
    init: 0,
    basicHeader: 1,
    messageHeader: 2,
    extendedTimestamp: 3,
    payload: 4,
  },

  chunk: {
    maxHeader: 18,
    type: {
      type0: 0,
      type1: 1,
      type2: 2,
      type3: 3,
    },
    channel: {
      invoke: 3,
      audio: 4,
      video: 5,
      data: 6,
    },
    defaultSize: 128,
    maxSize: 0xffff,
  },

  message: {
    format: {
      f0: 0,
      f1: 1,
      f2: 2,
    },
    headerSize: [11, 7, 3, 0],
    type: {
      setChunkSize: 1,
      abort: 2,
      acknowledgement: 3,
      windowAckSize: 5,
      setPeerBandwidth: 6,
      event: 4,
      audio: 8,
      video: 9,
      flexStream: 15,
      data: 18,
      flexMessage: 17,
      invoke: 20,
    },
  },

  stream: {
    begin: 0x00,
  },

  crypto: {
    sha256dl: 32,
    randomCrud: Buffer.from([
      0xf0, 0xee, 0xc2, 0x4a, 0x80, 0x68, 0xbe, 0xe8, 0x2e, 0x00, 0xd0, 0xd1, 0x02,
      0x9e, 0x7e, 0x57, 0x6e, 0xec, 0x5d, 0x2d, 0x29, 0x80, 0x6f, 0xab, 0x93, 0xb8,
      0xe6, 0x36, 0xcf, 0xeb, 0x31, 0xae,
    ]),
  },
};
