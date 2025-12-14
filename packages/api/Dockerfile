FROM oven/bun:1.2 AS build

RUN apt-get update && apt-get install -y git ffmpeg libgcc-s1 libssl3 ca-certificates

WORKDIR /app

COPY ./ ./
RUN bun install 

CMD ["bun", "run", "start"]
EXPOSE 3001