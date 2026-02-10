//loading ffmpeg
import { FFmpeg } from "/public/js/internals/index.js";
import { fetchFile } from "/public/js/util/index.js";

async function createFfmpegInstance() {
    const ffmpeg = new FFmpeg();

    ffmpeg.on("log", ({ message }) => {
        //console.log("[FFmpeg]", message);
    });

    ffmpeg.on("progress", ({ progress }) => {
        //console.log("[FFmpeg Progress]", Math.round(progress * 100) + "%");
    });

    await ffmpeg.load({
        coreURL: "/public/js/core/ffmpeg-core.js",
        wasmURL: "/public/js/core/ffmpeg-core.wasm",
    });

    console.log("FFmpeg carregado!");
    return ffmpeg
}

const getStream = () => window.streamPage.stream 

const getStreamKeyFromQuery = () => {
    const params = new URLSearchParams(window.location.search);
    const streamKey = params.get("stream_key");
    return streamKey ? streamKey.trim() : "test_av1";
}

//start and stop recording
document.addEventListener("DOMContentLoaded", async () => {
    const stremButton = document.getElementById("stream-btn");
    const encoders = await Promise.all(Array.from({ length: 4 }).map(async () => {
        const instance = await createFfmpegInstance()

        return {
            ffmpeg: instance,
            running: false,
            chunkIdx: 0,
            id: crypto.randomUUID()
        }
    }))

    const globals = {
        streaming: false,
        ws: null,
        timestampOffset: 0,
        chunk: null,
        encoders: encoders,
        encoded: [],
        dispatching: false,
        pendingChunks: [],  // Fila de chunks aguardando encoder
    }

    const dispatchChunksRoutine = async () => {
        if (globals.dispatching) return
        globals.dispatching = true
        //lets take the chunk more probable to send
        const mostLikelyChunk = [...globals.encoded].sort((a, b) => a.order - b.order)[0].order

        //now we check if theres some running encoder on lower orders
        const allLowerEncodingTasks = globals.encoders.filter((encoder) => encoder.running && encoder.chunkIdx < mostLikelyChunk)

        //if there still tasks, we need wait for then
        if (allLowerEncodingTasks.length) return

        //there are no lower tasks, so we can remove the chunk that we are sending rn
        const currentChunk = [...globals.encoded].find((task) => task.order == mostLikelyChunk)
        if (!currentChunk) return

        //remove the chunk from encoded
        globals.encoded = globals.encoded.filter((task) => task.id != currentChunk.id)

        //process to send 
        for (const tag of currentChunk.videoTags) {
            const adjustedTag = adjustFLVTimestamp(tag, globals.timestampOffset);
            globals.ws.send(adjustedTag);
        }

        globals.timestampOffset += currentChunk.state.maxTimestamp || 1000;

        //if we have the next already done, process it

        globals.dispatching = false
        if (globals.encoded.length) {
            await dispatchChunksRoutine()
        }
    }

    const processChunk = async (chunkData) => {
        try {
            const freeEncoder = globals.encoders.find((encoder) => encoder.running == false)
            if (!freeEncoder) {
                // Sem encoder livre, adiciona na fila
                globals.pendingChunks.push(chunkData)
                console.log(chunkData.order, "QUEUED - pending:", globals.pendingChunks.length)
                return
            }

            // Marca IMEDIATAMENTE antes de qualquer await (evita race condition)
            freeEncoder.running = true
            freeEncoder.chunkIdx = chunkData.order

            const file = chunkData.file
            const order = chunkData.order

            // Nomes únicos por encoder para evitar conflito de arquivos
            const inputFile = `chunk_in_${freeEncoder.id}.webm`
            const outputFile = `chunk_out_${freeEncoder.id}.flv`

            //process the file
            const data = await fetchFile(file)
            await freeEncoder.ffmpeg.writeFile(inputFile, data);
            await freeEncoder.ffmpeg.exec([
                "-i", inputFile,
                "-c:v", "libx264",
                "-preset", "ultrafast",
                "-tune", "zerolatency",
                "-pix_fmt", "yuv420p",
                "-profile:v", "baseline",
                "-level", "3.1",
                "-g", "15",                    // Keyframe a cada 15 frames
                "-keyint_min", "15",           // Mínimo também 15
                "-force_key_frames", "expr:eq(n,0)",  // FORÇA primeiro frame ser keyframe
                "-c:a", "aac",
                "-f", "flv",
                outputFile
            ]);
            const flv = await freeEncoder.ffmpeg.readFile(outputFile);


            const state = {};
            const tags = parseFLV(flv, state);

            const videoTags = tags.slice(2);

            //save the processed item
            globals.encoded.push({
                order,
                videoTags,
                state,
                id: crypto.randomUUID()
            })

            dispatchChunksRoutine()

            try {
                await freeEncoder.ffmpeg.deleteFile(inputFile);
                await freeEncoder.ffmpeg.deleteFile(outputFile);
            } catch (e) {
            }

            //free the encoder
            freeEncoder.running = false
            freeEncoder.chunkIdx = 0

            // Processa próximo chunk da fila se houver
            if (globals.pendingChunks.length > 0) {
                const nextChunk = globals.pendingChunks.shift()
                console.log(nextChunk.order, "DEQUEUED - remaining:", globals.pendingChunks.length)
                processChunk(nextChunk)
            }
        } catch (e) {
            console.log(e)
            // Mesmo com erro, libera o encoder e processa fila
            freeEncoder.running = false
            freeEncoder.chunkIdx = 0
            if (globals.pendingChunks.length > 0) {
                const nextChunk = globals.pendingChunks.shift()
                processChunk(nextChunk)
            }
        }
    }

    const provideProcessor = () => {
        const chunkData = { file: globals.chunk.file, order: globals.chunk.order }
        processChunk(chunkData)
    }

    const performChunk = async () => {
        globals.timestampOffset = 0;
        let order = 0;
        const SEGMENT_DURATION = 2000;
        const OVERLAP = 100; // 100ms de sobreposição - próximo começa antes do atual terminar

        const startSegment = () => {
            if (!globals.streaming) return;

            const chunks = [];
            const recorder = new MediaRecorder(getStream(), {
                mimeType: "video/webm;codecs=vp8,opus",
                videoBitsPerSecond: 2_500_000,
                audioBitsPerSecond: 128_000
            });

            order++;
            const currentOrder = order;

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunks.push(event.data);
                }
            };

            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: "video/webm" });
                const file = new File([blob], `input-${Date.now()}.webm`, { type: "video/webm" });
                globals.chunk = { file, order: currentOrder };
                provideProcessor();
            };

            recorder.start();

            // Inicia PRÓXIMO segmento ANTES de parar este (garante overlap)
            setTimeout(() => startSegment(), SEGMENT_DURATION - OVERLAP);

            // Para ESTE segmento depois
            setTimeout(() => {
                if (recorder.state === 'recording') {
                    recorder.stop();
                }
            }, SEGMENT_DURATION);
        };

        startSegment();
    };

    //ui actions
    stremButton.addEventListener("click", async () => {
        globals.streaming = window.streamPage.isStreaming
        if (globals.streaming) {
            const streamKey = getStreamKeyFromQuery();
            globals.ws = new WebSocket(`wss://api.stream.founderz.life/live/${encodeURIComponent(streamKey)}.flv`, "POST");//new WebSocket(`wss://api.stream.founderz.life/live/${encodeURIComponent(streamKey)}.flv`, "POST");//new WebSocket("ws://localhost:8000/live/test_av1.flv", "POST"); //
            globals.ws.binaryType = "arraybuffer";
            globals.chunk = {
                order: 0,
                file: null
            }
            globals.encoded = []
            globals.pendingChunks = []
            globals.dispatching = false
            await new Promise((resolve) => {
                globals.ws.onopen = () => {
                    resolve(true)
                };
            })

            globals.ws.send(getHeader())

            performChunk()
            return
        }

        close()
    })

    const close = () => {
        globals.streaming = false  

        if (globals.ws) {
            globals.ws.close()
            globals.ws = null
        }

        globals.chunk = null

    }
})
