export const constants = {
  flv: {
    media_type: {
      audio: 8,
      video: 9,
      script: 18
    },
    codec_id: {
      ex: 9,
      aac: 10,
      h264: 7
    },
    frame: {
      key: 1
    },
    avc: {
      sequence: {
        header: 0
      }
    }
  },
  four_cc: {
    av1: Buffer.from("av01"),
    vp9: Buffer.from("vp09"),
    hevc: Buffer.from("hvc1")
  },
  packet_type: {
    video: {
      sequence_start: 0,
      coded_frames: 1,
      coded_frames_x: 3,
      metadata: 4
    },
    audio: {
      sequence_start: 0
    }
  }

}