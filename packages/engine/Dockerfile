FROM oven/bun

WORKDIR /app

COPY bun.lockb package.json ./

RUN bun install --frozen-lockfile

COPY . .

EXPOSE 1935

CMD ["bun", "run", "start"]
