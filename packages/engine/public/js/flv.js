function parseFLV(uint8, state = {}) {
    const chunks = [];
    let offset = state.offset ?? 0;
    let maxTimestamp = 0;

    if (!state.headerSent) {
        if (
            uint8[0] === 0x46 && // F
            uint8[1] === 0x4c && // L
            uint8[2] === 0x56    // V
        ) {
            chunks.push(uint8.slice(0, 13));
            offset = 13;
            state.headerSent = true;
        }
    }

    while (offset + 11 <= uint8.length) {
        const dataSize =
            (uint8[offset + 1] << 16) |
            (uint8[offset + 2] << 8) |
            uint8[offset + 3];

        const tagTotalSize = 11 + dataSize + 4;

        if (offset + tagTotalSize > uint8.length) break;

        const tag = uint8.slice(offset, offset + tagTotalSize);

        // Ler timestamp original (3 bytes + 1 extended)
        const ts = (tag[4] << 16) | (tag[5] << 8) | tag[6] | (tag[7] << 24);
        if (ts > maxTimestamp) maxTimestamp = ts;

        chunks.push(tag);
        offset += tagTotalSize;
    }

    state.offset = offset;
    state.maxTimestamp = maxTimestamp;
    return chunks;
}

function adjustFLVTimestamp(tag, offset) {
    const newTag = new Uint8Array(tag);
    const ts = (newTag[4] << 16) | (newTag[5] << 8) | newTag[6] | (newTag[7] << 24);
    const newTs = ts + offset;

    newTag[4] = (newTs >> 16) & 0xFF;
    newTag[5] = (newTs >> 8) & 0xFF;
    newTag[6] = newTs & 0xFF;
    newTag[7] = (newTs >> 24) & 0xFF;
    return newTag;
}

function getHeader(){
    return new Uint8Array([
                0x46, 0x4C, 0x56, // "FLV"
                0x01,             // version
                0x05,             // flags (audio + video)
                0x00, 0x00, 0x00, 0x09, // data offset
                0x00, 0x00, 0x00, 0x00  // PreviousTagSize0
            ]).buffer
}