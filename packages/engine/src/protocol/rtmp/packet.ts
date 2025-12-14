export const Packet = (payload?: { fmt?: number, cid?: number }) => ({
  header: {
    fmt: payload?.fmt ?? 0,
    cid: payload?.cid ?? 0,
    timestamp: 0,
    length: 0,
    type: 0,
    stream_id: 0,
  },
  clock: 0,
  payload: Buffer.alloc(0),
  capacity: 0,
  bytes: 0,
})